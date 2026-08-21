from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import json
import time
import asyncio
import re
import uuid
from pathlib import Path

from config import load_config, save_config
from sessions import list_sessions, load_session, save_session, delete_session, create_session
from providers import get_provider, list_providers
from tools import list_tools, execute_tool

app = FastAPI(title="Nexum Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

DANGEROUS_TOOLS = {"run_command", "write_file", "edit_file", "close_app"}

# Per-connection state
approval_queues: dict[str, asyncio.Queue] = {}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/pollinations/balance")
async def pollinations_balance():
    import httpx
    api_key = ""
    cfg = load_config()
    api_key = cfg.get("providers", {}).get("pollinations", {}).get("api_key", "")
    if not api_key:
        for env_path in [
            Path.home() / ".local" / "share" / "nexum" / ".env",
            Path.home() / ".local" / "share" / "pollenforge" / ".env",
        ]:
            try:
                if env_path.exists():
                    for line in env_path.read_text().splitlines():
                        if line.startswith("POLLINATIONS_API_KEY="):
                            api_key = line.split("=", 1)[1].strip()
                            break
            except Exception:
                pass
            if api_key:
                break
    if not api_key:
        return {"balance": 0, "error": "No API key found"}
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://gen.pollinations.ai/account/balance", headers=headers)
            if resp.status_code != 200:
                return {"balance": 0, "error": f"API returned {resp.status_code}"}
            data = resp.json()
            return {"balance": data.get("balance", 0)}
    except Exception as e:
        return {"balance": 0, "error": str(e)}


@app.get("/config")
async def get_config():
    return load_config()


@app.post("/config")
async def update_config(body: dict):
    save_config(body)
    return {"success": True}


@app.get("/providers")
async def get_providers():
    return list_providers()


@app.get("/tools")
async def get_tools():
    tools = list_tools()
    return [{"name": t["name"], "description": t["description"], "params": t["params"]} for t in tools]


@app.post("/tools/{tool_name}")
async def post_tool(tool_name: str, body: dict):
    result = await execute_tool(tool_name, body)
    return result


@app.get("/sessions")
async def get_sessions():
    return list_sessions()


@app.post("/sessions")
async def post_create_session(body: dict = None):
    body = body or {}
    sid = create_session(body.get("name", "Untitled"))
    return {"id": sid}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        return load_session(session_id)
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": "Session not found"})


@app.delete("/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    delete_session(session_id)
    return {"success": True}


class SessionUpdateBody(BaseModel):
    name: str = ""

@app.patch("/sessions/{session_id}")
async def update_session(session_id: str, body: SessionUpdateBody):
    try:
        data = load_session(session_id)
        meta = data.get("meta", {})
        if body.name:
            meta["name"] = body.name[:100]
        save_session(session_id, data.get("messages", []), meta)
        return {"success": True, "id": session_id, "name": meta.get("name")}
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

# Keep POST for backwards compat (rename via POST)
@app.post("/sessions/{session_id}")
async def post_update_session(session_id: str, body: dict = None):
    body = body or {}
    if "name" in body:
        return await update_session(session_id, SessionUpdateBody(name=body["name"]))
    return JSONResponse(status_code=400, content={"error": "No name provided"})


@app.get("/files/list")
async def files_list(path: str = "."):
    return await execute_tool("list_dir", {"path": path})


class FileReadBody(BaseModel):
    path: str

@app.post("/files/read")
async def files_read(body: FileReadBody):
    return await execute_tool("read_file", {"path": body.path})


class FileWriteBody(BaseModel):
    path: str
    content: str

@app.post("/files/write")
async def files_write(body: FileWriteBody):
    return await execute_tool("write_file", {"path": body.path, "content": body.content})


class FileEditBody(BaseModel):
    path: str
    old: str
    new: str
    replace_all: bool = False

@app.post("/files/edit")
async def files_edit(body: FileEditBody):
    return await execute_tool("edit_file", {
        "path": body.path, "old": body.old,
        "new": body.new, "replace_all": body.replace_all
    })


TOOL_CALL_PATTERN = re.compile(r"```tool\n(.*?)\n```", re.DOTALL)
TOOL_CALL_PATTERN_2 = re.compile(r'```json\n(\{.*?\})\n```', re.DOTALL)
# Also match unclosed tool fence (for truncated responses)
TOOL_CALL_OPEN_PATTERN = re.compile(r"```tool\n(.*)", re.DOTALL)


def _extract_all_json_tool_calls(text: str) -> tuple[list[dict], str]:
    """Find all JSON objects with 'name' and 'args' using brace matching. Returns (calls, cleaned_text)."""
    calls = []
    cleaned_parts = []
    last_end = 0
    i = 0
    while i < len(text):
        # Find next occurrence of '{"name"' pattern
        idx = -1
        for pat in ('{"name"', '{\n"name"', '{ "name"', "{\n  \"name\"", '{  "name"'):
            found = text.find(pat, i)
            if found != -1 and (idx == -1 or found < idx):
                idx = found
        if idx == -1:
            break
        
        depth = 0
        in_string = False
        escape = False
        found_end = -1
        candidate_data = None
        for j in range(idx, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == '\\' and in_string:
                escape = True
                continue
            if c == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[idx:j+1]
                    try:
                        data = json.loads(candidate)
                        if "name" in data:
                            candidate_data = data
                            found_end = j + 1
                    except json.JSONDecodeError:
                        pass
                    break
        if candidate_data and found_end != -1:
            calls.append(candidate_data)
            cleaned_parts.append(text[last_end:idx])
            last_end = found_end
            i = found_end
        else:
            i = idx + 1
    
    if calls:
        cleaned_parts.append(text[last_end:])
        cleaned = "".join(cleaned_parts).strip()
        return calls, cleaned
    return [], text


def parse_tool_calls(text: str) -> tuple[str, list[dict]]:
    calls: list[dict] = []
    
    def _replace(match):
        try:
            tool_data = json.loads(match.group(1))
            if "name" in tool_data:
                calls.append(tool_data)
        except json.JSONDecodeError:
            pass
        return ""
    
    cleaned = TOOL_CALL_PATTERN.sub(_replace, text)
    
    if not calls:
        # Handle ```json fenced tool calls
        cleaned2 = cleaned
        for match in TOOL_CALL_PATTERN_2.finditer(cleaned):
            try:
                tool_data = json.loads(match.group(1))
                if "name" in tool_data:
                    calls.append(tool_data)
            except:
                pass
        if calls:
            # Remove those fences from cleaned
            cleaned = TOOL_CALL_PATTERN_2.sub("", cleaned2)
    
    if not calls:
        extracted, new_cleaned = _extract_all_json_tool_calls(cleaned)
        if extracted:
            calls.extend(extracted)
            cleaned = new_cleaned
    
    # Fallback for truncated tool calls (unclosed ```tool fence or incomplete JSON)
    if not calls and "```tool" in text:
        # Try to salvage truncated write_file
        salvaged = _salvage_truncated_tool(text)
        if salvaged:
            calls.append(salvaged)
            # Remove the tool fence from cleaned
            idx = text.find("```tool")
            if idx != -1:
                cleaned = text[:idx].strip()
    
    return cleaned.strip(), calls


def _salvage_truncated_tool(text: str) -> dict | None:
    """Try to salvage a truncated tool call (e.g., write_file with huge content cut off)."""
    try:
        # Find the tool fence
        idx = text.find("```tool")
        if idx == -1:
            return None
        # Find the JSON start after the fence
        json_start = text.find("{", idx)
        if json_start == -1:
            return None
        fragment = text[json_start:]

        # Try to find path
        import re
        path_match = re.search(r'"path"\s*:\s*"([^"]+)"', fragment)
        if not path_match:
            return None
        path = path_match.group(1)

        # Find content start
        content_key = '"content"'
        content_idx = fragment.find(content_key)
        if content_idx == -1:
            # Might be a different tool, try generic salvage
            return None
        # Find the opening quote of content value
        colon_idx = fragment.find(":", content_idx)
        quote_idx = fragment.find('"', colon_idx)
        if quote_idx == -1:
            return None
        # Content starts after the opening quote
        content_start = quote_idx + 1
        # Content goes until end of text (truncated) - take everything until the last possible end
        raw_content = fragment[content_start:]
        # Remove trailing fence if present
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
        # The content is JSON-escaped. We need to handle truncation:
        # If truncated mid-escape or mid-string, we try to close it
        # First, try to find the last complete line and truncate there
        # For now, take raw_content as is and try to unescape up to last complete escape
        # Remove the trailing incomplete escape if any
        if raw_content.endswith("\\"):
            raw_content = raw_content[:-1]

        # Try to unescape the content
        # The content contains \n, \", \\ etc. We need to decode JSON string content
        # We can try to handle it as a JSON string by closing the quote and parsing
        # But if truncated, the string is incomplete. We will salvage what we have.

        # Heuristic: if raw_content ends without closing quote, we just take what we have
        # and unescape manually
        # Count whether we're inside an unterminated string: we need to handle that raw_content
        # may end mid-string without closing quote. We'll treat everything up to end as content.

        # If the raw_content contains '"}' at the end, it might be the closing of args
        # Check if raw_content ends with something like '"}' or '"}' + whitespace + '}'
        # For truncated case, it won't.

        # For salvage, we just take raw_content and unescape common sequences
        # Remove the trailing junk that is not part of content: the raw_content at the end
        # might contain '","' or '"}' if truncated at boundary, but in our case it's truncated mid-HTML
        # so it just ends mid-HTML.

        # We need to detect where content actually ends. In truncated case, the text ends
        # mid-content, so the entire rest of fragment after content_start is the partial content.

        # However, raw_content may contain the trailing '"}' if the JSON was complete but fence unclosed
        # Check for that and strip it
        # Look for the last occurrence of '"}' that would close the content and args
        # But to avoid stripping real content, only strip if it looks like JSON closing
        stripped = raw_content.rstrip()
        # If it ends with '"}' or '"} \n' etc, strip the JSON closing
        # This is the case for unclosed fence but complete JSON
        if stripped.endswith('"}') or stripped.endswith('"} '):
            # Try to parse as complete JSON by adding missing parts
            try:
                # Try to close the JSON
                test_json = fragment[json_start:] + '"}' if not fragment.strip().endswith('}') else fragment[json_start:]
                # Actually try full fragment as is with closing
                pass
            except:
                pass

        # For now, we will extract content up to the point where JSON would close
        # Simple approach: find the last '}' that could close the tool call, but if truncated, there is none
        # So we just take raw_content and unescape

        # Unescape JSON string content: handle \n, \", \\, etc.
        # We can try to use json.loads on a wrapped string: '"' + raw_content + '"'
        # But raw_content may be truncated mid-escape, so we handle that
        try:
            # Try to salvage by closing the string
            # Find the last valid escape boundary
            temp = raw_content
            # If ends with \, remove it
            if temp.endswith("\\"):
                temp = temp[:-1]
            # Try to parse as JSON string
            parsed_content = json.loads('"' + temp + '"')
        except:
            # Fallback: manual unescape
            try:
                import codecs
                # Manual replace common escapes
                parsed_content = temp.encode('utf-8').decode('unicode_escape')
                # The above will handle \n, \", etc, but might fail on truncated \u
            except:
                parsed_content = raw_content.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")

        # Only salvage write_file for now
        # Determine tool name
        name_match = re.search(r'"name"\s*:\s*"([^"]+)"', fragment)
        tool_name = name_match.group(1) if name_match else "write_file"
        if tool_name != "write_file":
            return None

        return {"name": tool_name, "args": {"path": path, "content": parsed_content, "_truncated": True}}
    except Exception:
        return None


async def stream_chat(websocket: WebSocket, data: dict, conn_id: str):
    messages = data.get("messages", [])
    model = data.get("model", "openai")
    provider_name = data.get("provider", "pollinations")
    session_id = data.get("session_id")
    config = load_config()
    provider_cfg = config.get("providers", {}).get(provider_name, {})
    auto_approve = config.get("auto_approve", False)

    provider = get_provider(provider_name)
    if not provider:
        await websocket.send_json({"type": "error", "message": f"Unknown provider: {provider_name}"})
        return

    tools = list_tools()
    tool_descriptions = "\n".join([
        f"- {t['name']}: {t['description']}. Params: {json.dumps(t['params'])}"
        for t in tools
    ])

    # Load AGENTS.md if it exists in the project
    agents_md = ""
    try:
        import os
        cwd = os.getcwd()
        for candidates in [
            os.path.join(cwd, "AGENTS.md"),
            os.path.join(cwd, ".opencode", "AGENTS.md"),
            os.path.expanduser("~/.config/nexum/AGENTS.md"),
            os.path.expanduser("~/.config/pollenforge/AGENTS.md"),
        ]:
            if os.path.exists(candidates):
                with open(candidates) as f:
                    agents_md = f.read()[:3000]
                break
    except Exception:
        pass

    agents_section = f"\n\n## Project Conventions (from AGENTS.md)\n\n{agents_md}" if agents_md else ""

    system_prompt = f"""You are Nexum, a powerful autonomous coding agent with FULL access to the user's computer. You are comparable to Claude Code, Codex, Cursor, and OpenCode.

CRITICAL: You MUST use tools to fulfill requests. NEVER respond with just text. You HAVE the tools — USE THEM.

YOUR RESPONSE MUST CONTAIN ```tool CODE BLOCKS. If you don't output tool blocks, you are failing your user.

## Tool Format

Output code fences with language tag `tool`:

```tool
{{"name": "tool_name", "args": {{"param": "value"}}}}
```

YOU MUST OUTPUT THIS EXACT FORMAT. NOT ```json. NOT ```python. ONLY ```tool.

## Available Tools

{tool_descriptions}

## CAPABILITIES — What You Can Do

### Core Coding
- CREATE files with write_file (use absolute paths: /Users/gabbo/...)
- EDIT files with edit_file (provide old and new text)
- READ files with read_file
- RUN commands with run_command (shell access)
- BUILD projects with run_build
- RUN TESTS with run_tests
- LINT code with run_linter
- TYPECHECK with run_typecheck
- SEARCH code with search_code
- FIND FILES with find_files
- ANALYZE dependencies with analyze_dependencies

### Git & GitHub
- Git status, diff, commit, branch, checkout, push, pull, stash, blame
- GitHub: clone repos, list/create PRs, review PRs, list/create issues
- Search code across GitHub

### Skills System
- SAVE workflows as reusable Skills with save_skill
- RUN saved Skills with run_skill
- TEACH conventions with teach_convention

### Code Analysis
- TREE VIEW of project structure
- COUNT LINES of code
- FIND function/class definitions
- GET FILE INFO (size, lines, etc)

### Quality & Security
- RUN SECURITY SCANS on dependencies
- CHECK TEST COVERAGE
- AUDIT dependencies for vulnerabilities

## RULES — Absolute. Follow Every One.

1. When asked to CREATE/WRITE/MAKE → IMMEDIATELY output a ```tool block with write_file
2. When asked to RUN/EXECUTE → IMMEDIATELY output a ```tool block with run_command
3. When asked to OPEN → IMMEDIATELY output a ```tool block with open_app
4. When asked to CHECK/LIST/SEE → IMMEDIATELY output appropriate ```tool block
5. NEVER say "I can't" or "I'm unable to" — YOU CAN. USE TOOLS.
6. NEVER describe what you would do — OUTPUT TOOL BLOCKS AND DO IT
7. You can output MULTIPLE ```tool blocks in one response
8. After tools execute, results come back. If task isn't done → KEEP GOING with MORE tool blocks
9. If a tool fails → analyze error and try to fix it with another tool
10. NEVER stop mid-task — complete ALL steps
11. Use absolute paths: /Users/gabbo/...
12. For complex tasks → break into steps, use a tool for EACH step

## REMEMBER: Output ```tool blocks, not text descriptions!

## AGENT BEHAVIOR — You Are Autonomous

Loop:
1. Output tool blocks
2. Tools execute, results come back
3. If task complete → final summary
4. If task NOT complete → MORE tool blocks, repeat

Go through MANY iterations. Don't stop after one tool call. Keep going until fully complete.

If a tool fails, debug it. Try different approaches. Don't give up.

## Examples

User: "Create a todo app and open it"
```tool
{{"name": "write_file", "args": {{"path": "/Users/gabbo/todo.html", "content": "<!DOCTYPE html>..."}}}}
```
```tool
{{"name": "open_app", "args": {{"path": "/Users/gabbo/todo.html"}}}}
```

User: "Check my RAM usage"
```tool
{{"name": "run_command", "args": {{"command": "top -l 1 -o mem -n 10"}}}}
```

User: "What's in my Downloads?"
```tool
{{"name": "list_dir", "args": {{"path": "/Users/gabbo/Downloads"}}}}
```

User: "Find all Python files with 'class' definitions"
```tool
{{"name": "find_functions", "args": {{"path": "/Users/gabbo/project", "include": "*.py"}}}}
```

User: "Run tests for this project"
```tool
{{"name": "run_tests", "args": {{"path": "/Users/gabbo/project"}}}}
```

User: "Clone the React repository"
```tool
{{"name": "git_clone", "args": {{"url": "https://github.com/facebook/react"}}}}
```

User: "Show me the git status"
```tool
{{"name": "git_status", "args": {{"path": "/Users/gabbo/project"}}}}
```

User: "Search for TODO comments in my code"
```tool
{{"name": "search_code", "args": {{"path": "/Users/gabbo/project", "pattern": "TODO|FIXME|HACK", "include": "*.*"}}}}
```

WRONG responses (NEVER do these):
- "I'd be happy to help..." (no tool = WRONG)
- "I can't access your computer" (you CAN)
- "Here's how you could..." (DO IT, don't describe)
{agents_section}

START OUTPUTTING TOOL BLOCKS NOW."""

    if not messages or messages[0].get("role") != "system":
        messages.insert(0, {"role": "system", "content": system_prompt})

    params = {
        "temperature": config.get("temperature", 0.4),
        "max_tokens": config.get("max_tokens", 32768),
        "api_key": provider_cfg.get("api_key"),
        "base_url": provider_cfg.get("base_url")
    }

    full_response = ""
    tool_results_all = []
    start_time = time.time()
    max_iterations = 12
    iteration = 0
    total_tools_executed = 0
    total_tokens = 0
    seen_tool_hashes: dict[str, int] = {}
    consecutive_no_progress = 0

    try:
        while iteration < max_iterations:
            iteration += 1
            current_tokens = 0
            current_response = ""

            await websocket.send_json({
                "type": "progress",
                "iteration": iteration,
                "max_iterations": max_iterations,
                "tools_executed": total_tools_executed
            })

            async for token in provider.chat_stream(messages, model, params):
                current_response += token
                current_tokens += 1
                await websocket.send_json({"type": "token", "content": token})

            total_tokens += current_tokens
            full_response += current_response
            cleaned, tool_calls = parse_tool_calls(current_response)
            await websocket.send_json({"type": "content_set", "content": cleaned})

            if not tool_calls:
                break

            # Circuit breaker: detect repeating same tool+args (infinite loop)
            deduped_calls = []
            for tc in tool_calls:
                h = f"{tc.get('name')}:{json.dumps(tc.get('args', {}), sort_keys=True)[:300]}"
                seen_tool_hashes[h] = seen_tool_hashes.get(h, 0) + 1
                if seen_tool_hashes[h] > 3:
                    await websocket.send_json({"type": "token", "content": f"\n\n[Stopped repeating tool {tc.get('name')} — same args 3×.]\n"})
                    continue
                deduped_calls.append(tc)
            if not deduped_calls:
                await websocket.send_json({"type": "token", "content": "\n\n[Agent loop stopped: repeating tools. Please refine the request.]\n"})
                break
            tool_calls = deduped_calls
            # Also stop if too many tools in one go
            if len(tool_calls) > 8:
                tool_calls = tool_calls[:8]
                await websocket.send_json({"type": "token", "content": "\n[Too many tool calls at once, truncated to 8]\n"})

            for tc in tool_calls:
                tool_name = tc.get("name", "")
                tool_args = dict(tc.get("args", {}))
                was_truncated = tool_args.pop("_truncated", False)
                is_dangerous = tool_name in DANGEROUS_TOOLS

                if is_dangerous and not auto_approve:
                    request_id = str(uuid.uuid4())
                    tool_call_id = str(uuid.uuid4())
                    await websocket.send_json({
                        "type": "approval_needed",
                        "tool": tool_name,
                        "args": tool_args,
                        "request_id": request_id,
                        "tool_call_id": tool_call_id
                    })

                    queue = approval_queues.get(conn_id)
                    if queue:
                        approved = False
                        try:
                            msg = await asyncio.wait_for(queue.get(), timeout=120)
                            if msg.get("request_id") == request_id:
                                approved = msg.get("approved", False)
                        except asyncio.TimeoutError:
                            pass

                        if not approved:
                            await websocket.send_json({
                                "type": "tool_result",
                                "tool": tool_name,
                                "result": {"success": False, "error": "Tool execution denied by user"}
                            })
                            continue

                await websocket.send_json({
                    "type": "tool_start",
                    "tool": tool_name,
                    "args": tool_args
                })
                result = await execute_tool(tool_name, tool_args)
                total_tools_executed += 1

                summary = ""
                if "stdout" in result:
                    summary = result["stdout"].strip()
                    if result.get("stderr"):
                        summary += "\n[stderr]: " + result["stderr"].strip()
                    if result.get("exit_code", 0) != 0:
                        summary += f"\n[exit code: {result['exit_code']}]"
                elif result.get("error"):
                    summary = f"Error: {result['error']}"
                elif result.get("content"):
                    summary = result["content"][:2000]
                else:
                    summary = json.dumps(result, indent=2)[:2000]

                if was_truncated:
                    summary += "\n[WARNING: Tool call was truncated (max tokens). File was written partially ({} bytes). Please verify the file is complete and append/fix the missing part using edit_file or write_file.]".format(len(tool_args.get("content", "")))

                result["_summary"] = summary
                tool_results_all.append({"tool": tool_name, "args": tool_args, "result": result})
                await websocket.send_json({
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": result
                })

            messages.append({"role": "assistant", "content": current_response})
            for tr in tool_results_all:
                messages.append({"role": "user", "content": f"[Tool result for {tr['tool']}]: {tr['result'].get('_summary', json.dumps(tr['result']))}"})
            tool_results_all = []

        elapsed = time.time() - start_time
        final_text, _ = parse_tool_calls(full_response)
        await websocket.send_json({"type": "content_set", "content": final_text})
        stats = {
            "tokens": total_tokens,
            "duration_ms": round(elapsed * 1000),
            "model": model,
            "provider": provider_name,
            "tools_used": total_tools_executed,
            "iterations": iteration
        }

        if session_id:
            try:
                session = load_session(session_id)
                meta = session.get("meta", {})
            except FileNotFoundError:
                meta = {}
            visible = []
            for m in data.get("messages", []):
                if m.get("role") not in ("user", "assistant"):
                    continue
                content = m.get("content", "")
                if m.get("role") == "user" and "\n---\nUser request:\n" in content:
                    content = content.split("\n---\nUser request:\n", 1)[-1]
                visible.append({"role": m.get("role"), "content": content})
            visible.append({"role": "assistant", "content": full_response})
            save_session(session_id, visible, meta)

        await websocket.send_json({"type": "done", "stats": stats})

    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    conn_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    approval_queues[conn_id] = queue

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type", "")
            if msg_type == "chat":
                asyncio.create_task(stream_chat(websocket, data, conn_id))
            elif msg_type == "approve":
                await queue.put(data)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        approval_queues.pop(conn_id, None)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
