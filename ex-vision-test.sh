#!/bin/bash
# Pazmoonak: test which AI models can really SEE an image (sends one tiny test picture to each model).
# Run as root:  bash ex-vision-test.sh      Changes nothing on the server. Keys are never printed.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"; ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
[ "$(id -u)" = "0" ] || { [ -n "${PZ_APP:-}" ] || { echo "ERR: run as root"; exit 1; }; }
[ -f "$APP/deno-shim.js" ] && [ -f "$ENVF" ] || { echo "ERR: $APP/deno-shim.js or $ENVF not found"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node missing"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
g() { sed -n "s/^$1=//p" "$ENVF" | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
for k in PERPLEXITY_API_KEY DEEPSEEK_API_KEY PPLX_RELAY PPLX_RELAY_KEY AI_RELAY AI_RELAY_KEY DEEPSEEK_MODEL; do v="$(g $k)"; [ -n "$v" ] && export "$k=$v"; done
[ -n "${PERPLEXITY_API_KEY:-}" ] || { echo "ERR: PERPLEXITY_API_KEY is not set"; exit 1; }
echo "iVBORw0KGgoAAAANSUhEUgAAAeAAAADICAIAAAC/PqUtAAAWAklEQVR42u3de1xUdf7H8S86IBICakDagxUoSbMWNaXLrqmpJLqbiuJICA6JNzB0yyxNvK1koHbb1huaIGBeQrH0gYv1wFuriFuZSpGhtGpYriLIpIIsvz/6tY8eCfM9zMwZz8y8nn/KlzkzX/DN53zP9+LS2NgoAADa04ouAAACGgBAQAMAAQ0AIKABgIAGABDQAAACGgAIaAAAAQ0ABDQAgIAGABDQAEBAAwAIaAAgoAEABDQAENAAAAIaAEBAAwABDQAgoAGAgAYAENAAAAIaAAhoAAABDQAENACAgAYAAhoAQEADAAhoACCgAQAENAAQ0AAAAhoAQEADAAENACCgAcAR6Rz4s3WJqVTe+LvcTvw2ANAUl8bGRieMYyIbAAFtZ6FMWAMgoO0jl0lqAAS0HUQzMQ2AgNZuLpPUAAhoO4hmYhqA8wa0XUQzMQ1AONtCFbtLZzt9zwCooJ0r5iilAThgBe0YRSilNACHqqAdMtQopQHYfQXtqCUnpTQA+w5ox04xMhqAsMchDqcKL4Y7ANhNBe1spSWlNAD7CGjnTCsyGoDWA9qZc4qMBqDdgCah6AEAWgxosol+AKDFgCaV6A0AWgxo8og+ASA41RuA2SoqKoqLi0+cOHH27Nnz589XVVVVV1fX19c3NDTodDoPDw8fHx9fX9/AwMAHHnigZ8+eYWFhbdu2teIbuHr16hdffFFeXl5eXn7mzJnvv/++trbWaDTW1tYKIby9vb28vLy8vAIDA0N/0a5dO8FCFUpF4egLWM6dO9e7d2+zv93V1dXNzc3Ly8vPzy8gIKBr1649e/Z87LHHOnTo0KLXyczMfOmll2z82Xv06LFv3z6t/Xo0NjY+88wzR44ckbb08vIqLy83+0Lnz5/PycnJy8urqKho0Te6ubkNGDAgOjo6IiKidevW5l39ypUrRUVFR44cOXLkSFlZWYtCyc3NLSIiIiYmpn///q1atWxIYOzYsUVFRTb4OS5ZsmTKlClarKBJZ2n/OMwiw/r6+vr6eqPRWFlZefz48f8vAVxcwsLCoqKixo4da91SyxmsX79eSTpboqqqKjU1ddOmTfX19WZ8e11dXWFhYWFhYXBw8MKFCyMiIpR/78WLF3fv3r179+7Dhw/funXLvPdfV1e3c+fOnTt33n///StWrHjiiScEY9CkM72kvAYsLi6eNWtWaGjoypUr6+rq+Ikrv6FZsmSJqpcoLi7+4x//mJWVZV46/9qZM2fi4uKmT59+8+ZNhd8ybty4V1555eDBg2an8699++23I0eO/Mtf/mI0GglooMWV2oIFC8LDw0+fPk1vKKF21hQVFUVGRv74449WfM0tW7aMHz/+Tv0ZbmxszMnJGTFixJUrVwhoymf6qsVOnTo1dOjQ4uJifuimZWdn79+/X6j5MHDixIlqJOm+ffteffXVO9h1x48fHz9+vPJC3hkDmnSmx5pTU1Mzbty40tJSfujNqaysXLhwoaqXmD179rVr11R68czMzJKSkjvYgSUlJampqQQ0YI7a2toJEyZcv36drmjSiy++WFNTo97rf/nll2rPXnjrrbfubB+uXbv2m2++0UrOtmqloYCmfKbflNxiv/HGG9p5P926ddPIO9m6devevXtVvcQHH3ygpJmfn9+8efP27dt39uzZ77///tSpU7m5ucOGDVPyvZ988kl1dbV5by8gIOC5557LyMg4cODAmTNnKisry8rKPv7448WLF4eEhCh8kYaGhnfffVcj6Tx48GCtBDTpTO8plJGRUVVVpZF0Xr58uRbeyaVLl+bNm6f2VT799FNpm759+x48eHDGjBk9evTw9PR0dXX18/MLDw/PyspauXKltCRsaGho6ZMGd3f36OjoPXv2fPbZZ2lpaSNHjuzevXu7du10Ol2HDh1CQ0OnTZt26NChZcuWtWnTRskLfvjhh1qYNRQREREUFCRYSQgb8PX1vX34uLGxsba29uLFi5999lleXp7C22ej0Zifnx8fH/+bfzcYDAaDwfK3mpaWpiR227dvn5OT4+npqYXunT17tg3+aEkn0nh4eGRmZja3wigqKuqLL75Yu3at9Crh4eFK3o+np2dCQsK0adOka5pcXFwMBkNQUFB0dLR0aqDRaCwpKfnDH/5g4mbFwp588803X3vtNdNtkpKStDIGTfnsnH3o4uLSrl27rl276vX6rVu35uXlKVw9uGfPHpXe0q5du1asWCGvUHS6devWdenSRQvduHPnzl27djX5pQEDBljrKjdu3JCO/o8aNcrPz89Eg8mTJwsFEyulbVq3bm0wGEpKSl599VXlK0779+//wgsvKGl54sQJ9X5edXV169atk96I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" > "$T/img.b64"
cat > "$T/t.js" <<'JS'
const fs = require("fs");
require(process.argv[2]);
const IMG = "data:image/png;base64," + fs.readFileSync(process.argv[3], "utf8").trim();
const Q = "Look at the image. Reply in exactly this format: TEXT=<the text written in the image>; COLOR=<the color of the circle>";
const PP = [
  ["Luna (GPT-6)", "openai/gpt-6-luna"], ["Haiku 5.5", "anthropic/claude-haiku-5-5"], ["Gemini Hydrogen", "google/gemini-4-hydrogen"],
  ["Sonnet 5.5", "anthropic/claude-sonnet-5-5"], ["GPT Sol 6.2", "openai/gpt-6.2-sol"], ["Gemini Carbon", "google/gemini-4-carbon"],
  ["Gemini Argon", "google/gemini-4-argon"], ["Opus 5.5", "anthropic/claude-opus-5-5"], ["GPT Astra 6.2", "openai/gpt-6.2-astra"], ["Fable 5.2", "anthropic/claude-fable-5-2"],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function judge(txt) { const t = String(txt || ""); return /4827/.test(t) && /blue/i.test(t); }
async function callPP(id) {
  const body = { model: id, instructions: "You are a precise vision assistant. Answer very briefly.", input: [{ role: "user", content: [{ type: "input_text", text: Q }, { type: "input_image", image_url: IMG }] }], max_output_tokens: 800 };
  return fetch("https://api.perplexity.ai/v1/agent", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + process.env.PERPLEXITY_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
}
async function callDS() {
  const body = { model: process.env.DEEPSEEK_MODEL || "deepseek-flash", messages: [{ role: "user", content: [{ type: "text", text: Q }, { type: "image_url", image_url: { url: IMG } }] }], max_tokens: 300, temperature: 0 };
  return fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (process.env.DEEPSEEK_API_KEY || "") }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
}
function textOf(d, ds) {
  if (ds) return String((((d || {}).choices || [])[0] || {}).message ? d.choices[0].message.content : "");
  let t = d && typeof d.output_text === "string" ? d.output_text : "";
  if (!t) for (const it of Array.isArray(d && d.output) ? d.output : []) for (const c of Array.isArray(it && it.content) ? it.content : []) if (c && typeof c.text === "string") t += c.text;
  return t;
}
async function one(name, fn, ds) {
  let last = "";
  for (let k = 0; k < 4; k++) {
    let r = null;
    try { r = await fn(); } catch (e) { last = "network: " + String(e).slice(0, 60); }
    if (r) {
      const raw = await r.text().catch(() => "");
      let d = null; try { d = JSON.parse(raw); } catch (e) {}
      if (r.status === 200 && d) { const t = textOf(d, ds); return { name, status: "ok", sees: judge(t), reply: t.replace(/\s+/g, " ").slice(0, 70) }; }
      const msg = d && (d.error && (d.error.message || d.error) || d.message) ? String(d.error && d.error.message || d.error || d.message).slice(0, 110) : raw.replace(/\s+/g, " ").slice(0, 60);
      last = r.status + " " + msg;
      if ([400, 401, 402, 404, 422].includes(r.status)) return { name, status: "error", reply: last };
    }
    await sleep(+(process.env.PZ_SLEEP||6000));
  }
  return { name, status: "blocked", reply: last };
}
(async () => {
  const out = [];
  out.push(await one("DeepSeek (deepseek-flash)", callDS, true));
  for (const [n, id] of PP) out.push(await one(n, () => callPP(id), false));
  console.log("");
  for (const o of out) {
    const mark = o.status === "ok" ? (o.sees ? "YES  sees the image" : "NO   answered but did NOT read the image") : o.status === "error" ? "ERR  rejected" : "???  could not reach (blocked/timeout)";
    console.log(("  " + o.name).padEnd(28), mark, o.status === "ok" && !o.sees || o.status !== "ok" ? "| " + o.reply : "");
  }
  try { fs.writeFileSync("/root/ex-vision-result.json", JSON.stringify(out, null, 1)); console.log("\nsaved: /root/ex-vision-result.json"); } catch (e) {}
})();
JS
echo "Testing 11 models with a tiny picture (about 1-2 minutes)..."
"$NODE" "$T/t.js" "$APP/deno-shim.js" "$T/img.b64" 2>&1 | grep -v -E "^(perplexity (proxy|retry)|direct fetch)"
