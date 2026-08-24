import html
import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import parse_qs, unquote, urlparse

import httpx

DDG_URL = "https://html.duckduckgo.com/html/"
POLLINATIONS_CHAT = "https://gen.pollinations.ai/v1/chat/completions"
SEARCH_MODELS = ("gemini-search", "perplexity")
FETCH_MAX_CHARS = 8000
FETCH_MAX_BYTES = 2_000_000
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

TOOLS = [
    {
        "name": "web_search",
        "description": (
            "Search the live web. Returns titles, snippets, and URLs. "
            "Use for current events, docs, prices, or when the user writes @web. "
            "Then fetch_url the best links. Do not invent live facts."
        ),
        "params": {
            "query": "Search query",
            "count": "Number of results (optional integer, default 5)",
        },
        "handler": None,
    },
    {
        "name": "fetch_url",
        "description": "Fetch a public http(s) page and return visible text (truncated).",
        "params": {
            "url": "http(s) URL to read",
        },
        "handler": None,
    },
]


def _as_count(value, default=5) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = default
    return max(1, min(10, n))


def _unwrap_ddg_href(href: str) -> str:
    raw = html.unescape(href or "").strip()
    if raw.startswith("//"):
        raw = "https:" + raw
    try:
        parsed = urlparse(raw)
    except Exception:
        return raw
    if "duckduckgo.com" in (parsed.netloc or "") and parsed.path.startswith("/l"):
        uddg = parse_qs(parsed.query).get("uddg", [""])[0]
        if uddg:
            return unquote(uddg)
    return raw


def _strip_tags(text: str) -> str:
    cleaned = re.sub(r"(?is)<[^>]+>", "", text or "")
    return html.unescape(re.sub(r"\s+", " ", cleaned)).strip()


class _DDGParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.results: list[dict] = []
        self._in_link = False
        self._in_snippet = False
        self._href = ""
        self._title_parts: list[str] = []
        self._snippet_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        classes = (attrs_d.get("class") or "").split()
        if tag == "a" and "result__a" in classes:
            self._in_link = True
            self._href = attrs_d.get("href") or ""
            self._title_parts = []
        elif "result__snippet" in classes:
            self._in_snippet = True
            self._snippet_parts = []

    def handle_endtag(self, tag):
        if tag == "a" and self._in_link:
            url = _unwrap_ddg_href(self._href)
            title = "".join(self._title_parts).strip()
            if url and title:
                self.results.append({"title": title, "url": url, "snippet": ""})
            self._in_link = False
            self._href = ""
            self._title_parts = []
        if self._in_snippet and tag in {"a", "div", "span", "td"}:
            snippet = "".join(self._snippet_parts).strip()
            if snippet and self.results and not self.results[-1].get("snippet"):
                self.results[-1]["snippet"] = snippet
            self._in_snippet = False
            self._snippet_parts = []

    def handle_data(self, data):
        if self._in_link:
            self._title_parts.append(data)
        elif self._in_snippet:
            self._snippet_parts.append(data)


def parse_ddg_html(html_text: str, count: int = 5) -> list[dict]:
    parser = _DDGParser()
    try:
        parser.feed(html_text or "")
    except Exception:
        pass
    out = []
    seen = set()
    for item in parser.results:
        url = item.get("url") or ""
        if not url or url in seen:
            continue
        seen.add(url)
        out.append({
            "title": item.get("title") or url,
            "url": url,
            "snippet": item.get("snippet") or "",
        })
        if len(out) >= count:
            break
    return out


def _blocked_hostname(host: str) -> bool:
    h = (host or "").strip().lower().rstrip(".")
    if h.startswith("[") and h.endswith("]"):
        h = h[1:-1]
    if not h:
        return True
    blocked = {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "::",
        "metadata.google.internal",
    }
    if h in blocked:
        return True
    if h.endswith(".localhost") or h.endswith(".local") or h.endswith(".internal"):
        return True
    return False


def _blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def assert_public_http_url(url: str) -> str | None:
    """Return an error string if the URL is not a public http(s) target."""
    text = (url or "").strip()
    if not text:
        return "url is required"
    try:
        parsed = urlparse(text)
    except Exception:
        return "Invalid URL"
    if parsed.scheme not in {"http", "https"}:
        return "Only http and https URLs are allowed"
    host = parsed.hostname or ""
    if _blocked_hostname(host):
        return "That host is not allowed"
    try:
        if ipaddress.ip_address(host) and _blocked_ip(host):
            return "That host is not allowed"
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        return f"Could not resolve host: {host}"
    for info in infos:
        sockaddr = info[4]
        ip = sockaddr[0]
        if _blocked_ip(ip):
            return "That host is not allowed"
    return None


def _html_to_text(raw: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript|iframe)[^>]*>.*?</\1>", " ", raw or "")
    text = re.sub(r"(?is)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)</(p|div|h[1-6]|li|tr)>", "\n", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def _pollinations_search(query: str, api_key: str) -> dict:
    from providers.pollinations import pollinations_headers

    last_error = ""
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in SEARCH_MODELS:
            try:
                response = await client.post(
                    POLLINATIONS_CHAT,
                    headers=pollinations_headers(api_key),
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "user",
                                "content": f"Search the web for this query and cite source URLs:\n{query}",
                            }
                        ],
                        "stream": False,
                    },
                )
            except Exception as exc:
                last_error = str(exc)
                continue
            if response.status_code != 200:
                last_error = f"{model} returned {response.status_code}"
                continue
            try:
                data = response.json()
            except Exception:
                last_error = f"{model} returned non-JSON"
                continue
            content = ""
            if isinstance(data, dict):
                choices = data.get("choices") or []
                if choices and isinstance(choices[0], dict):
                    content = ((choices[0].get("message") or {}).get("content") or "").strip()
            if content:
                return {
                    "query": query,
                    "source": "pollinations",
                    "model": model,
                    "answer": content[:8000],
                    "results": [],
                }
            last_error = f"{model} returned an empty answer"
    return {"error": last_error or "Pollinations search failed"}


async def web_search(query: str = "", count: int = 5) -> dict:
    query = (query or "").strip()
    if not query:
        return {"error": "query is required"}
    limit = _as_count(count)
    html_text = ""
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.post(
                DDG_URL,
                data={"q": query},
                headers={
                    "User-Agent": BROWSER_UA,
                    "Accept": "text/html",
                    "Referer": "https://duckduckgo.com/",
                },
            )
            if response.status_code == 200:
                html_text = response.text or ""
    except Exception:
        html_text = ""

    results = parse_ddg_html(html_text, limit) if html_text else []
    if results:
        return {"query": query, "source": "duckduckgo", "results": results}

    from config import resolve_provider_api_key

    api_key = resolve_provider_api_key("pollinations")
    if api_key:
        fallback = await _pollinations_search(query, api_key)
        if not fallback.get("error"):
            return fallback
        return {
            "query": query,
            "source": "none",
            "results": [],
            "error": fallback.get("error") or "No search results",
        }
    return {"query": query, "source": "none", "results": [], "error": "No search results"}


async def fetch_url(url: str = "") -> dict:
    err = assert_public_http_url(url)
    if err:
        return {"error": err}
    target = url.strip()
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            current = target
            response = None
            for _ in range(5):
                hop_err = assert_public_http_url(current)
                if hop_err:
                    return {"error": hop_err}
                response = await client.get(
                    current,
                    headers={"User-Agent": BROWSER_UA, "Accept": "text/html,text/plain,*/*"},
                )
                if response.status_code in {301, 302, 303, 307, 308}:
                    nxt = response.headers.get("location") or ""
                    if not nxt:
                        break
                    current = str(httpx.URL(current).join(nxt))
                    continue
                break
            if response is None:
                return {"error": "Empty response"}
    except Exception as exc:
        return {"error": f"Fetch failed: {exc}"}

    if response.status_code >= 400:
        return {"error": f"HTTP {response.status_code}", "url": str(response.url), "status": response.status_code}

    data = response.content[:FETCH_MAX_BYTES]
    ctype = (response.headers.get("content-type") or "").lower()
    if any(bin_t in ctype for bin_t in ("image/", "audio/", "video/", "octet-stream", "zip", "pdf")):
        return {"error": f"Unsupported content type: {ctype.split(';')[0]}", "url": str(response.url)}
    try:
        text = data.decode(response.encoding or "utf-8", errors="replace")
    except Exception:
        text = data.decode("utf-8", errors="replace")
    if "html" in ctype or "<html" in text[:400].lower():
        text = _html_to_text(text)
    truncated = len(text) > FETCH_MAX_CHARS
    return {
        "url": str(response.url),
        "status": response.status_code,
        "content": text[:FETCH_MAX_CHARS],
        "truncated": truncated,
        "chars": len(text),
    }


TOOLS[0]["handler"] = web_search
TOOLS[1]["handler"] = fetch_url
