#!/usr/bin/env bash
# آزمایش Perplexity (مستقیم در برابر Cloudflare) و Gemini (از طریق Cloudflare). با root:  bash testall.sh
set -uo pipefail
ENV_FILE=/etc/pazmoonak/env
[ "$(id -u)" = "0" ] || { echo "این اسکریپت باید با کاربر root اجرا شود."; exit 1; }
g() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
export RELAY="$(g AI_RELAY)" RKEY="$(g AI_RELAY_KEY)" PKEY="$(g PERPLEXITY_API_KEY)" GPROJ="$(g GOOGLE_PROJECT)"
[ -n "$PKEY" ] || { echo "کلید Perplexity پیدا نشد."; exit 1; }
command -v python3 >/dev/null || { echo "python3 نصب نیست."; exit 1; }
echo "آزمایش Perplexity و Gemini (هرکدام ۶ بار)؛ حدود ۸ تا ۱۲ دقیقه. تا پایان صبر کنید..."
python3 - <<'PY'
import os, json, time, urllib.request, urllib.error
R, RK, PK = os.environ["RELAY"], os.environ["RKEY"], os.environ["PKEY"]
U = "https://api.perplexity.ai/v1/agent"
P = "درباره‌ی توان در ریاضی هفتم توضیح بده و کلمه‌های کلیدی را پررنگ کن."
def run(name, via, gem=False):
    if gem:
        U2 = "https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse" % os.environ["GPROJ"]
        body = json.dumps({"contents": [{"role": "user", "parts": [{"text": P}]}], "generationConfig": {"maxOutputTokens": 700}}).encode()
        h = {"user-agent": "node", "content-type": "application/json", "accept-encoding": "gzip, deflate", "x-relay-gauth": "1", "x-relay-target": U2, "x-relay-key": RK}
        req = urllib.request.Request(R, data=body, method="POST", headers=h)
    else:
        body = json.dumps({"model": "anthropic/claude-haiku-5-5", "instructions": "پاسخ فارسی بده.", "input": [{"role": "user", "content": P}], "max_output_tokens": 700, "stream": True}).encode()
        h = {"user-agent": "node", "content-type": "application/json", "authorization": "Bearer " + PK, "accept-encoding": "gzip, deflate"}
        if via: h.update({"x-relay-target": U, "x-relay-key": RK})
        req = urllib.request.Request(R if via else U, data=body, method="POST", headers=h)
    t0 = last = time.time(); mx = 0.0; n = 0; res = "سالم"; ok = True
    try:
        r = urllib.request.urlopen(req, timeout=25)
        while True:
            c = r.read1(8192)
            if not c: break
            now = time.time(); mx = max(mx, now - last); last = now; n += 1
    except urllib.error.HTTPError as e:
        res = "❌ پاسخ HTTP %d (مستقیم بسته شده؟)" % e.code; ok = False
    except Exception as e:
        mx = max(mx, time.time() - last); res = "❌ گیر کرد/قطع شد: " + str(e)[:40]; ok = False
    print("%-28s کل=%5.1fث بسته=%3d طولانی‌ترین مکث=%5.1fث %s" % (name, time.time() - t0, n, mx, res), flush=True)
    return ok
a = b = 0
for i in range(6):
    a += run("مستقیم #%d" % (i + 1), False)
    b += run("با Cloudflare #%d" % (i + 1), True)
c = 0
if os.environ.get("GPROJ"):
    for i in range(6):
        c += run("Gemini با Cloudflare #%d" % (i + 1), True, True)
print("\nنتیجه: Perplexity مستقیم %d از 6 سالم | Perplexity با Cloudflare %d از 6 سالم | Gemini با Cloudflare %d از 6 سالم" % (a, b, c))
PY
