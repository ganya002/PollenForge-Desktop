import unittest
from unittest.mock import patch

from tools.web import assert_public_http_url, fetch_url, parse_ddg_html, web_search

DDG_HTML = """
<html><body>
  <div class="result">
    <a rel="nofollow" class="result__a" href="https://docs.python.org/3/">Python 3 docs</a>
    <a class="result__snippet">Official Python documentation</a>
  </div>
  <div class="result">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.rust-lang.org%2F">Rust</a>
    <div class="result__snippet">The Rust programming language</div>
  </div>
</body></html>
"""


class FakeResponse:
    def __init__(self, status=200, text="", json_data=None, headers=None, url="https://example.com"):
        self.status_code = status
        self.text = text
        self.content = text.encode("utf-8")
        self.headers = headers or {"content-type": "text/html"}
        self._json = json_data
        self.url = url

    def json(self):
        if self._json is not None:
            return self._json
        raise ValueError("no json")


class FakeAsyncClient:
    response = FakeResponse(text=DDG_HTML)

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, data=None, headers=None, json=None):
        return self.response

    async def get(self, url, headers=None):
        return self.response


class WebToolTests(unittest.IsolatedAsyncioTestCase):
    def test_parse_ddg_html(self):
        results = parse_ddg_html(DDG_HTML, count=5)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["title"], "Python 3 docs")
        self.assertEqual(results[0]["url"], "https://docs.python.org/3/")
        self.assertIn("Official", results[0]["snippet"])
        self.assertEqual(results[1]["url"], "https://www.rust-lang.org/")
        self.assertEqual(results[1]["title"], "Rust")

    async def test_web_search_parses_ddg(self):
        with patch("tools.web.httpx.AsyncClient", FakeAsyncClient):
            result = await web_search("python docs", count=5)
        self.assertEqual(result.get("source"), "duckduckgo")
        self.assertEqual(len(result.get("results") or []), 2)
        self.assertEqual(result["results"][1]["url"], "https://www.rust-lang.org/")

    def test_ssrf_helpers(self):
        self.assertIsNotNone(assert_public_http_url("http://127.0.0.1/secret"))
        self.assertIsNotNone(assert_public_http_url("http://localhost/x"))
        self.assertIsNotNone(assert_public_http_url("file:///etc/passwd"))
        self.assertIsNotNone(assert_public_http_url("http://169.254.169.254/latest"))
        self.assertIsNotNone(assert_public_http_url("http://192.168.1.9/admin"))

    async def test_fetch_url_rejects_localhost_and_file(self):
        local = await fetch_url("http://127.0.0.1/secret")
        self.assertIn("not allowed", local.get("error", "").lower())
        file_url = await fetch_url("file:///etc/passwd")
        self.assertIn("http", file_url.get("error", "").lower())

    async def test_query_required(self):
        result = await web_search("")
        self.assertEqual(result.get("error"), "query is required")


if __name__ == "__main__":
    unittest.main()
