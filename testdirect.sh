#!/usr/bin/env bash
# آزمایش: DeepSeek مستقیم از سرور (بدون Cloudflare) در برابر از طریق Cloudflare. با root:  bash testdirect.sh
set -uo pipefail
ENV_FILE=/etc/pazmoonak/env
[ "$(id -u)" = "0" ] || { echo "این اسکریپت باید با کاربر root اجرا شود."; exit 1; }
g() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
export RELAY="$(g AI_RELAY)" RKEY="$(g AI_RELAY_KEY)" DKEY="$(g DEEPSEEK_API_KEY)"
[ -n "$DKEY" ] || { echo "کلید DeepSeek پیدا نشد."; exit 1; }
command -v python3 >/dev/null || { echo "python3 نصب نیست."; exit 1; }
echo "آزمایش DeepSeek (۸ بار مستقیم و ۸ بار از طریق Cloudflare) ؛ حدود ۵ تا ۸ دقیقه. تا پایان صبر کنید..."
python3 - <<'PY'
import os, json, time, urllib.request
R, RK, DK = os.environ["RELAY"], os.environ["RKEY"], os.environ["DKEY"]
U = "https://api.deepseek.com/chat/completions"
P = "درباره‌ی توان در ریاضی هفتم توضیح بده و کلمه‌های کلیدی را پررنگ کن."
def run(name, via):
    body = json.dumps({"model": "deepseek-chat", "stream": True, "max_tokens": 700, "messages": [{"role": "user", "content": P}]}).encode()
    h = {"user-agent": "node", "content-type": "application/json", "authorization": "Bearer " + DK, "accept-encoding": "gzip, deflate"}
    if via: h.update({"x-relay-target": U, "x-relay-key": RK})
    req = urllib.request.Request(R if via else U, data=body, method="POST", headers=h)
    t0 = last = time.time(); mx = 0.0; n = 0; res = "سالم"; got = 0
    try:
        r = urllib.request.urlopen(req, timeout=25)
        while True:
            c = r.read1(8192)
            if not c: break
            now = time.time(); mx = max(mx, now - last); last = now; n += 1; got += len(c)
    except Exception as e:
        mx = max(mx, time.time() - last); res = "❌ گیر کرد/قطع شد: " + str(e)[:40]
    print("%-28s کل=%5.1fث بسته=%3d طولانی‌ترین مکث=%5.1fث %s" % (name, time.time() - t0, n, mx, res), flush=True)
    return res == "سالم"
a = b = 0
for i in range(8):
    a += run("مستقیم #%d" % (i + 1), False)
    b += run("با Cloudflare #%d" % (i + 1), True)
print("\nنتیجه: مستقیم %d از 8 سالم | با Cloudflare %d از 8 سالم" % (a, b))
PY
