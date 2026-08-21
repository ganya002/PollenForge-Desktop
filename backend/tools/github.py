import httpx
import json
import subprocess
from pathlib import Path

TOOLS = [
    {
        "name": "github_list_repos",
        "description": "List repositories for the authenticated user",
        "params": {"token": "GitHub token (optional, uses GITHUB_TOKEN env var)", "per_page": "Results per page (default: 30)"},
        "handler": lambda token="", per_page=30: _github_request("GET", "/user/repos", token, params={"per_page": per_page})
    },
    {
        "name": "github_list_prs",
        "description": "List pull requests for a repository",
        "params": {"repo": "Owner/repo format", "state": "open/closed/all", "token": "GitHub token"},
        "handler": lambda repo="", state="open", token="": _github_request("GET", f"/repos/{repo}/pulls", token, params={"state": state}) if repo else {"error": "repo is required"}
    },
    {
        "name": "github_get_pr",
        "description": "Get details of a pull request",
        "params": {"repo": "Owner/repo", "pr_number": "PR number", "token": "GitHub token"},
        "handler": lambda repo="", pr_number=0, token="": _github_request("GET", f"/repos/{repo}/pulls/{pr_number}", token) if repo and pr_number else {"error": "repo and pr_number required"}
    },
    {
        "name": "github_create_pr",
        "description": "Create a pull request",
        "params": {"repo": "Owner/repo", "title": "PR title", "head": "Head branch", "base": "Base branch", "body": "PR description", "token": "GitHub token"},
        "handler": lambda repo="", title="", head="", base="main", body="", token="": _create_pr(repo, title, head, base, body, token)
    },
    {
        "name": "github_review_pr",
        "description": "Review a pull request",
        "params": {"repo": "Owner/repo", "pr_number": "PR number", "action": "approve/request_changes/comment", "body": "Review comment", "token": "GitHub token"},
        "handler": lambda repo="", pr_number=0, action="comment", body="", token="": _review_pr(repo, pr_number, action, body, token)
    },
    {
        "name": "github_list_issues",
        "description": "List issues in a repository",
        "params": {"repo": "Owner/repo", "state": "open/closed/all", "labels": "Comma-separated labels", "token": "GitHub token"},
        "handler": lambda repo="", state="open", labels="", token="": _github_request("GET", f"/repos/{repo}/issues", token, params={"state": state, "labels": labels}) if repo else {"error": "repo is required"}
    },
    {
        "name": "github_create_issue",
        "description": "Create an issue",
        "params": {"repo": "Owner/repo", "title": "Issue title", "body": "Issue description", "labels": "Comma-separated labels", "token": "GitHub token"},
        "handler": lambda repo="", title="", body="", labels="", token="": _create_issue(repo, title, body, labels, token)
    },
    {
        "name": "github_get_file",
        "description": "Get contents of a file from a repository",
        "params": {"repo": "Owner/repo", "path": "File path in repo", "ref": "Branch or commit (default: main)", "token": "GitHub token"},
        "handler": lambda repo="", path="", ref="main", token="": _github_request("GET", f"/repos/{repo}/contents/{path}", token, params={"ref": ref}) if repo and path else {"error": "repo and path required"}
    },
    {
        "name": "github_search_code",
        "description": "Search for code across GitHub",
        "params": {"query": "Search query", "repo": "Limit to repo (owner/repo)", "token": "GitHub token"},
        "handler": lambda query="", repo="", token="": _search_code(query, repo, token)
    },
    {
        "name": "github_clone",
        "description": "Clone a GitHub repository",
        "params": {"repo": "Owner/repo format", "dest": "Destination directory", "token": "GitHub token for private repos"},
        "handler": lambda repo="", dest="", token="": _github_clone(repo, dest, token)
    },
]


def _get_token(provided_token: str = "") -> str:
    import os
    token = provided_token or os.environ.get("GITHUB_TOKEN", "")
    if not token:
        config_path = Path.home() / ".local" / "share" / "pollenforge" / ".env"
        if config_path.exists():
            for line in config_path.read_text().split("\n"):
                if line.startswith("GITHUB_TOKEN="):
                    token = line.split("=", 1)[1].strip()
    return token


def _github_request(method: str, endpoint: str, token: str = "", params: dict = None) -> dict:
    try:
        auth_token = _get_token(token)
        headers = {"Accept": "application/vnd.github.v3+json"}
        if auth_token:
            headers["Authorization"] = f"token {auth_token}"
        
        with httpx.Client(timeout=30) as client:
            resp = client.request(method, f"https://api.github.com{endpoint}", headers=headers, params=params)
            
            if resp.status_code == 200:
                return {"data": resp.json(), "status": resp.status_code}
            elif resp.status_code == 204:
                return {"success": True, "status": resp.status_code}
            else:
                return {"error": resp.json().get("message", f"HTTP {resp.status_code}"), "status": resp.status_code}
    except Exception as e:
        return {"error": str(e)}


def _create_pr(repo: str, title: str, head: str, base: str, body: str, token: str) -> dict:
    if not repo or not title or not head:
        return {"error": "repo, title, and head are required"}
    
    data = {"title": title, "head": head, "base": base}
    if body:
        data["body"] = body
    
    auth_token = _get_token(token)
    headers = {"Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"token {auth_token}"
    
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(f"https://api.github.com/repos/{repo}/pulls", headers=headers, json=data)
            if resp.status_code == 201:
                pr = resp.json()
                return {"success": True, "pr_number": pr["number"], "url": pr["html_url"], "title": pr["title"]}
            else:
                return {"error": resp.json().get("message", f"HTTP {resp.status_code}")}
    except Exception as e:
        return {"error": str(e)}


def _review_pr(repo: str, pr_number: int, action: str, body: str, token: str) -> dict:
    if not repo or not pr_number:
        return {"error": "repo and pr_number are required"}
    
    event_map = {"approve": "APPROVE", "request_changes": "REQUEST_CHANGES", "comment": "COMMENT"}
    data = {"event": event_map.get(action, "COMMENT")}
    if body:
        data["body"] = body
    
    auth_token = _get_token(token)
    headers = {"Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"token {auth_token}"
    
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(f"https://api.github.com/repos/{repo}/pulls/{pr_number}/reviews", headers=headers, json=data)
            if resp.status_code == 200:
                return {"success": True, "review": resp.json().get("state")}
            else:
                return {"error": resp.json().get("message", f"HTTP {resp.status_code}")}
    except Exception as e:
        return {"error": str(e)}


def _create_issue(repo: str, title: str, body: str, labels: str, token: str) -> dict:
    if not repo or not title:
        return {"error": "repo and title are required"}
    
    data = {"title": title}
    if body:
        data["body"] = body
    if labels:
        data["labels"] = [l.strip() for l in labels.split(",")]
    
    auth_token = _get_token(token)
    headers = {"Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"token {auth_token}"
    
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(f"https://api.github.com/repos/{repo}/issues", headers=headers, json=data)
            if resp.status_code == 201:
                issue = resp.json()
                return {"success": True, "issue_number": issue["number"], "url": issue["html_url"]}
            else:
                return {"error": resp.json().get("message", f"HTTP {resp.status_code}")}
    except Exception as e:
        return {"error": str(e)}


def _search_code(query: str, repo: str, token: str) -> dict:
    if not query:
        return {"error": "query is required"}
    
    params = {"q": query}
    if repo:
        params["q"] = f"{query} repo:{repo}"
    
    return _github_request("GET", "/search/code", token, params=params)


def _github_clone(repo: str, dest: str, token: str) -> dict:
    if not repo:
        return {"error": "repo is required"}
    
    try:
        auth_token = _get_token(token)
        url = f"https://github.com/{repo}.git"
        if auth_token:
            url = f"https://{auth_token}@github.com/{repo}.git"
        
        cmd = ["git", "clone", url]
        if dest:
            cmd.append(dest)
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "success": result.returncode == 0
        }
    except Exception as e:
        return {"error": str(e)}
