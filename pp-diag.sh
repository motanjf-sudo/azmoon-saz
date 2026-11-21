#!/bin/bash
# Safe diagnostic for Perplexity 403 (prints codes/headers/page title only, never keys). Run as root: bash pp-diag.sh
ENVF=/etc/pazmoonak/env
g() { sed -n "s/^$1=//p" "$ENVF" | tail -1; }
export PK="$(g PERPLEXITY_API_KEY)" RELAY="$(g AI_RELAY)" RKEY="$(g AI_RELAY_KEY)"
python3 -I - <<'PY'
import os, json, re, urllib.request, urllib.error
U = "https://api.perplexity.ai/v1/agent"
body = json.dumps({"model": "anthropic/claude-haiku-5-5", "instructions": "one word", "input": [{"role": "user", "content": "hi"}], "max_output_tokens": 40}).encode()
def go(label, url, method="GET", data=None, hdr=None):
    h = {"user-agent": "node", "content-type": "application/json"}; h.update(hdr or {})
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=h), timeout=40); code, hd, txt = r.status, r.headers, r.read(3000).decode("utf8", "replace")
    except urllib.error.HTTPError as e: code, hd, txt = e.code, e.headers, e.read(3000).decode("utf8", "replace")
    except Exception as e: print("%-34s ERROR %s" % (label, str(e)[:70])); return
    t = re.search(r"<title>(.*?)</title>", txt, re.S); extra = (t.group(1).strip()[:50] if t else txt.strip().replace("\n", " ")[:90])
    print("%-34s %s | %s | server=%s cf-mitigated=%s | %s" % (label, code, (hd.get("content-type") or "")[:16], hd.get("server"), hd.get("cf-mitigated"), extra))
K = {"authorization": "Bearer " + os.environ["PK"]}
go("1 GET site (no key)", "https://api.perplexity.ai/")
go("2 POST agent, no key", U, "POST", body)
go("3 POST agent, key", U, "POST", body, K)
go("4 POST agent, key, browser UA", U, "POST", body, dict(K, **{"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}))
if os.environ.get("RELAY"):
    R = {"x-relay-target": U, "x-relay-key": os.environ["RKEY"]}
    go("5 relay, no key", os.environ["RELAY"], "POST", body, R)
    go("6 relay, key", os.environ["RELAY"], "POST", body, dict(K, **R))
    go("7 relay GET site", os.environ["RELAY"], "GET", None, {"x-relay-target": "https://api.perplexity.ai/", "x-relay-key": os.environ["RKEY"]})
    go("8 relay deepseek (should be 401)", os.environ["RELAY"], "POST", b"{}", {"x-relay-target": "https://api.deepseek.com/chat/completions", "x-relay-key": os.environ["RKEY"]})
PY
