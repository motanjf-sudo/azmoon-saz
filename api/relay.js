// پروکسی «سرور به سرور» برای Perplexity، روی Vercel و خارج از ایران (منطقهٔ اجرا در vercel.json تعیین می‌شود).
// فقط سرور پازمونک با کلید مخفی RELAY_KEY (متغیر محیطی Vercel) از آن استفاده می‌کند.
const ALLOWED = /^api\.perplexity\.ai$/i;
const DROP_REQ = /^(host|connection|content-length|keep-alive|transfer-encoding|upgrade|x-relay-.*|x-vercel-.*|x-forwarded-.*|x-real-ip|forwarded|via|cdn-loop|true-client-ip|cf-.*|x-client-ip)$/i;
const DROP_RES = /^(content-encoding|content-length|transfer-encoding|connection|keep-alive)$/i;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
  }
  const parts = [];
  for await (const c of req) parts.push(c);
  return Buffer.concat(parts);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") { res.statusCode = 405; return res.end("method"); }
    const want = process.env.RELAY_KEY || "";
    if (!want || String(req.headers["x-relay-key"] || "") !== want) { res.statusCode = 403; return res.end("forbidden"); }
    let target;
    try { target = new URL(String(req.headers["x-relay-target"] || "")); } catch { res.statusCode = 400; return res.end("bad target"); }
    if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) { res.statusCode = 403; return res.end("host not allowed"); }
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!DROP_REQ.test(k) && v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : v;
    if (!headers["user-agent"] || /^(node|undici|python)/i.test(headers["user-agent"])) headers["user-agent"] = BROWSER_UA;
    if (!headers.origin) headers.origin = "https://console.perplexity.ai";
    if (!headers.referer) headers.referer = "https://console.perplexity.ai/";
    if (!headers["accept-language"]) headers["accept-language"] = "en-US,en;q=0.9";
    const body = await readBody(req);
    const ctl = new AbortController();
    res.on("close", () => { if (!res.writableEnded) ctl.abort(); });
    const r = await fetch(target.toString(), { method: req.method, headers, body, signal: ctl.signal });
    res.statusCode = r.status;
    r.headers.forEach((v, k) => { if (!DROP_RES.test(k)) res.setHeader(k, v); });
    if (!r.body) return res.end();
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise((ok) => res.once("drain", ok));
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) { res.statusCode = 502; res.end("relay error: " + String((e && e.message) || e).slice(0, 200)); } else { try { res.end(); } catch {} }
  }
};
