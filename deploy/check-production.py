"""Read-only production smoke checks; run on the orderCup server after deployment."""
import http.cookiejar
import json
import time
import urllib.request
from pathlib import Path

BASE = "https://ordercup.duckdns.org"
secrets = dict(line.split("=", 1) for line in Path("/home/abdurrauf/ordercup/shared/.env").read_text().splitlines() if "=" in line)

def read(path, opener=None, body=None, cookie=None):
    headers = {"Origin": BASE}
    if cookie:
        headers["Cookie"] = cookie
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), headers=headers)
    with (opener or urllib.request.build_opener()).open(req, timeout=20) as response:
        data = response.read()
        assert response.status == 200, path
        return data, response.headers

health, _ = read("/api/health")
assert json.loads(health)["status"] == "ok", "Database health"
for locale in ("kk", "ru", "en"):
    html, _ = read("/", cookie="locale=" + locale)
    text = html.decode()
    assert '<html lang="' + locale + '"' in text, "Landing locale " + locale
    assert "orderCup" in text, "Brand"
    assert "restaurant-benefits" in text, "Benefits banner"
print("PASS HTTPS, database health, landing, branding, all three UI languages")

catalog, _ = read("/api/catalog/table-and-thyme")
catalog = json.loads(catalog)
assert (len(catalog["categories"]), len(catalog["menu"]), len(catalog["tables"])) == (5, 12, 12), "Demo catalog counts"
assert all(item.get("nameEn") for item in catalog["menu"]), "English menu translations"
assert any(not item.get("nameKk") for item in catalog["menu"]), "Russian menu fallback examples"
for path in ("/restaurant?slug=table-and-thyme", "/restaurant?slug=table-and-thyme&table=8", "/admin", "/icon.svg"):
    content, _ = read(path)
    assert content, path
login_html, _ = read("/admin", cookie="locale=en")
assert "LOCAL DEVELOPMENT ACCOUNTS" not in login_html.decode(), "Production hides development credential shortcuts"
print("PASS demo menu, translations, table QR entry, login, production mode, app icon")

for role in ("controller", "admin", "staff"):
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    data, headers = read("/api/auth/login", opener, {"email": role + "@tableandthyme.local", "password": secrets["SEED_PASSWORD"]})
    assert json.loads(data)["role"] == role.upper(), role + " login"
    session_cookie = next(cookie for cookie in cookies if cookie.name == "tt_user")
    assert session_cookie.secure and session_cookie.has_nonstandard_attr("HttpOnly"), "Secure HttpOnly session"
    workspace, _ = read("/api/workspace", opener)
    workspace = json.loads(workspace)
    assert workspace["user"]["role"] == role.upper(), role + " workspace"
    assert len(workspace["restaurants"]) == 1, "Exactly one demo restaurant"
    html, _ = read("/admin", opener)
    assert "orderCup" in html.decode(), "Signed-in workspace"
    if role == "staff":
        start = time.monotonic()
        with opener.open(BASE + "/api/events?staff=1", timeout=15) as stream:
            assert "text/event-stream" in stream.headers.get("Content-Type", ""), "SSE content type"
            for _ in range(8):
                line = stream.readline()
                if line.startswith(b"data:"):
                    assert json.loads(line[5:])["data"]["user"]["role"] == "STAFF", "SSE workspace snapshot"
                    break
            else:
                raise AssertionError("No live SSE data received")
            assert time.monotonic() - start < 15, "SSE must stream promptly through proxy"
    read("/api/auth/logout", opener, {})
    print("PASS", role, "sign-in, role workspace, secure cookies, sign-out" + (", live SSE" if role == "staff" else ""))
print("All production checks passed; no tenant, menu, order, or enquiry records were created or changed.")
