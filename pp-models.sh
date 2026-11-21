#!/bin/bash
# Tests every exam model with a tiny request (about 10 output tokens each, negligible cost): directly and through the relay. Never prints keys.
# Run as root:  bash pp-models.sh
ENVF=/etc/pazmoonak/env
g() { sed -n "s/^$1=//p" "$ENVF" | tail -1; }
export PK="$(g PERPLEXITY_API_KEY)" RELAY="$(g AI_RELAY)" RKEY="$(g AI_RELAY_KEY)"
python3 -I - <<'PY'
import os, json, urllib.request, urllib.error
U = "https://api.perplexity.ai/v1/agent"
M = [("luna", "openai/gpt-6-luna"), ("haiku", "anthropic/claude-haiku-5-5"), ("hyd", "google/gemini-4-hydrogen"), ("sonnet", "anthropic/claude-sonnet-5-5"), ("sol", "openai/gpt-6.2-sol"),
     ("carbon", "google/gemini-4-carbon"), ("argon", "google/gemini-4-argon"), ("opus", "anthropic/claude-opus-5-5"), ("astra", "openai/gpt-6.2-astra"), ("fable", "anthropic/claude-fable-5-2")]
BR = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36", "origin": "https://console.perplexity.ai", "referer": "https://console.perplexity.ai/", "accept-language": "en-US,en;q=0.9"}
def call(model, via):
    body = json.dumps({"model": model, "instructions": "Reply with one word.", "input": [{"role": "user", "content": "hi"}], "max_output_tokens": 16}).encode()
    h = {"content-type": "application/json", "authorization": "Bearer " + os.environ["PK"]}; h.update(BR)
    if via: h.update({"x-relay-target": U, "x-relay-key": os.environ["RKEY"]})
    try:
        r = urllib.request.urlopen(urllib.request.Request(os.environ["RELAY"] if via else U, data=body, method="POST", headers=h), timeout=60)
        return str(r.status)
    except urllib.error.HTTPError as e:
        t = (e.headers.get("content-type") or "")
        if "html" in t: return "%d html" % e.code
        try: return "%d %s" % (e.code, e.read(200).decode("utf8", "replace").replace("\n", " ")[:70])
        except Exception: return str(e.code)
    except Exception as e: return "err " + str(e)[:30]
print("%-8s %-30s %-18s %s" % ("id", "model", "direct", "relay"))
for k, m in M:
    print("%-8s %-30s %-18s %s" % (k, m, call(m, False), call(m, True) if os.environ.get("RELAY") else "-"), flush=True)
PY
