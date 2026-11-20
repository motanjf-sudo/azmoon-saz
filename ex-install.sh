#!/bin/bash
# Pazmoonak: choose the AI model when making an exam (with or without files).
# Price per question: 1 puluk = DeepSeek / GPT-6 Luna / Haiku 5.5, 2 = Gemini Hydrogen / Sonnet 5.5 / GPT Sol 6.2, 3 = Gemini Carbon / Argon / Opus 5.5, 6 = Astra 6.2 / Fable 5.2 (Gemini Neon: "soon").
# Run as root:  bash ex-install.sh      Safe to run more than once. Does not touch data, secrets or settings.
# Nothing is changed unless every step can be done: the code is prepared and checked first, then the database, then the files are replaced.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"
DB="${PZ_DB:-pazmoonak}"
API="${PZ_API:-http://127.0.0.1:8787}"
ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
RESTART="${PZ_RESTART:-systemctl restart pazmoonak}"
RESTART_W="${PZ_RESTART_W:-systemctl restart pazmoonak-files}"
if [ -z "${PZ_PSQLCMD:-}" ]; then PZ_PSQLCMD="su postgres -c \"psql -q -v ON_ERROR_STOP=1 -At -d $DB\""; fi
export PZ_PSQLCMD PZ_APP="$APP"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
[ -f "$APP/fn/node-api.js" ] && [ -f "$APP/files-worker.js" ] || { echo "ERR: node-api.js or files-worker.js not found in $APP"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERR: python3 is not installed (apt install -y python3)"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node not found"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/ex-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"; export PZ_BK="$BK"

echo "[1/6] checking database"
echo "select 1" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: cannot reach database $DB"; exit 1; }
echo "select 1 from file_jobs limit 0" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: file_jobs table not found (is files-install.sh installed?)"; exit 1; }
echo "OK"

cat > "$T/ex.sql" <<'PZSQL_END'
-- جدول قیمت و مدل‌های ساخت آزمون با هوش مصنوعی (قیمت = پولک برای هر سؤال). چندبار اجرا کردن بی‌خطر است.
set client_min_messages = warning;
begin;
create table if not exists public.ex_models (
  id text primary key,
  price int not null check (price between 1 and 100),
  on_topic boolean not null default true,
  on_files boolean not null default true,
  sort int not null default 0
);
insert into public.ex_models(id, price, on_topic, on_files, sort) values
  ('ds', 1, true, true, 10), ('luna', 1, true, true, 20), ('haiku', 1, true, true, 30),
  ('hyd', 2, true, true, 40), ('sonnet', 2, true, true, 50), ('sol', 2, true, true, 60), ('neon', 2, false, false, 70),
  ('carbon', 3, true, true, 80), ('argon', 3, true, true, 90), ('opus', 3, true, true, 100),
  ('astra', 6, true, true, 110), ('fable', 6, true, true, 120)
on conflict (id) do update set price = excluded.price, sort = excluded.sort;

create or replace function public.ex_models()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('files', true, 'models', coalesce(jsonb_agg(jsonb_build_object('id', id, 'price', price, 'on', on_topic, 'f', on_files) order by sort), '[]'::jsonb))
  from public.ex_models;
$$;

create or replace function public.ex_price(p_id text, p_files boolean default false)
returns int
language sql stable security definer set search_path = public as $$
  select price from public.ex_models where id = p_id and case when p_files then on_files else on_topic end;
$$;

revoke all on table public.ex_models from public;
revoke all on function public.ex_models() from public;
revoke all on function public.ex_price(text, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.ex_models from anon; grant execute on function public.ex_models() to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.ex_models from authenticated; grant execute on function public.ex_models() to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ex_models() to service_role; grant execute on function public.ex_price(text, boolean) to service_role;
  end if;
end $$;
commit;
PZSQL_END
cat > "$T/patch_sql.py" <<'PZPY_END'
# Patches the LIVE definitions of fj_create / fj_start / fj_retry / fj_finish so that every pulak amount is multiplied by the price of the
# chosen model. Nothing is executed unless every anchor is found exactly once (so a changed function is never half-patched).
import os, subprocess, sys
CMD = os.environ["PZ_PSQLCMD"]
BK = os.environ.get("PZ_BK", "")
def sql(q):
    r = subprocess.run(CMD, shell=True, input=q, capture_output=True, text=True)
    if r.returncode != 0:
        print("SQL error:", r.stderr.strip()[:400]); sys.exit(1)
    return r.stdout
def getdef(sig):
    out = sql("select pg_get_functiondef('public.%s'::regprocedure);" % sig).rstrip("\n")
    if not out.strip(): print("function not found:", sig); sys.exit(1)
    return out
SIG = {"fj_create": "fj_create(text,jsonb,jsonb)", "fj_start": "fj_start(text,text)", "fj_retry": "fj_retry(text,text)", "fj_finish": "fj_finish(uuid,int,jsonb,text,text,text,int)"}
defs = {k: getdef(v) for k, v in SIG.items()}
if "'unit'" in defs["fj_create"] and "unit" in defs["fj_start"] and "unit" in defs["fj_finish"]:
    print("already patched"); sys.exit(0)
if BK:
    open(os.path.join(BK, "fj-original.sql"), "w").write("\n;\n".join(defs.values()) + "\n;\n")
def edit(name, pairs):
    s = defs[name]
    for a, b in pairs:
        if s.count(a) != 1:
            print("ANCHOR NOT FOUND in %s (%d): %s" % (name, s.count(a), a[:80].replace("\n", " "))); sys.exit(3)
        s = s.replace(a, b)
    defs[name] = s
edit("fj_create", [
    ("uid uuid; jid uuid; prm jsonb;", "ai text; unit int; uid uuid; jid uuid; prm jsonb;"),
    ("  prm := jsonb_build_object(\n    'mode', mode, 'level', lvl,",
     "  ai := coalesce(nullif(p_params->>'ai', ''), 'ds');\n  select m.price into unit from ex_models m where m.id = ai and m.on_files;\n  if unit is null then\n    if ai = 'ds' then unit := 1; else return jsonb_build_object('ok', false, 'error', 'model'); end if;\n  end if;\n  prm := jsonb_build_object(\n    'mode', mode, 'level', lvl,"),
    ("'by_file', coalesce(p_params->>'by_file', 'false') = 'true'", "'by_file', coalesce(p_params->>'by_file', 'false') = 'true', 'ai', ai, 'unit', unit"),
])
edit("fj_start", [
    ("cntp int; len int; total int; bal int;", "cntp int; len int; total int; bal int; unit int;"),
    ("  select sum(q_count) into total from file_job_exams where job_id = jid;\n  bal := fj_charge(uid, total);",
     "  select coalesce((params->>'unit')::int, 1) into unit from file_jobs where id = jid;\n  select sum(q_count) * unit into total from file_job_exams where job_id = jid;\n  bal := fj_charge(uid, total);"),
    ("update file_job_exams set status = 'wait', charged = q_count where job_id = jid;", "update file_job_exams set status = 'wait', charged = q_count * unit where job_id = jid;"),
])
edit("fj_retry", [
    ("declare uid uuid; jid uuid; total int; bal int;", "declare uid uuid; jid uuid; total int; bal int; unit int;"),
    ("  if total = 0 then return jsonb_build_object('ok', false, 'error', 'nothing'); end if;",
     "  if total = 0 then return jsonb_build_object('ok', false, 'error', 'nothing'); end if;\n  select coalesce((params->>'unit')::int, 1) into unit from file_jobs where id = jid;\n  total := total * unit;"),
    ("update file_job_exams set status = 'wait', charged = q_count, err = null,", "update file_job_exams set status = 'wait', charged = q_count * unit, err = null,"),
])
edit("fj_finish", [
    ("fresh jsonb; hist jsonb;", "fresh jsonb; hist jsonb; unit int;"),
    ("  if ex.charged - kept > 0 then perform fj_refund(jb.user_id, ex.charged - kept); end if;",
     "  unit := coalesce((jb.params->>'unit')::int, 1);\n  if ex.charged - kept * unit > 0 then perform fj_refund(jb.user_id, ex.charged - kept * unit); end if;"),
    ("q_got = kept, charged = kept,", "q_got = kept, charged = kept * unit,"),
    ("set spent = spent + kept,", "set spent = spent + kept * unit,"),
])
body = "begin;\n" + "\n".join(d.rstrip().rstrip(";") + ";" for d in defs.values()) + "\ncommit;\n"
sql(body)
print("patched: fj_create, fj_start, fj_retry, fj_finish")
PZPY_END
cat > "$T/patch_js.py" <<'PZPY_END'
# Patches /opt/pazmoonak/fn/node-api.js and /opt/pazmoonak/files-worker.js (in place) so the chosen model is used and priced.
# Every anchor must be found exactly once, otherwise nothing is written.
import os, sys
APP = os.environ.get("PZ_APP", "/opt/pazmoonak")
def load(p): return open(p, encoding="utf-8").read()
def patch(path, pairs, marker):
    s = load(path)
    if marker in s: print("already patched:", os.path.basename(path)); return None
    for a, b in pairs:
        if s.count(a) != 1:
            print("ANCHOR NOT FOUND in %s (%d): %s" % (os.path.basename(path), s.count(a), a[:90].replace("\n", " "))); sys.exit(3)
        s = s.replace(a, b)
    return s
MODELS = '{ "glm-flash": "perplexity/glm-5.3-flash", glm: "perplexity/glm-5.3", luna: "openai/gpt-6-luna", haiku: "anthropic/claude-haiku-5-5", hyd: "google/gemini-4-hydrogen", sonnet: "anthropic/claude-sonnet-5-5", sol: "openai/gpt-6.2-sol", carbon: "google/gemini-4-carbon", argon: "google/gemini-4-argon", opus: "anthropic/claude-opus-5-5", astra: "openai/gpt-6.2-astra", fable: "anthropic/claude-fable-5-2" }'
api = patch(os.path.join(APP, "fn", "node-api.js"), [
    ('const PPLX_MODELS = { "glm-flash": "perplexity/glm-5.3-flash", glm: "perplexity/glm-5.3" };', "const PPLX_MODELS = " + MODELS + ";   /* EXPRICE */"),
    ("async function handle(req, ctx) {",
     "async function unitOf(pick) {   /* pulaks per question for this model (from the ex_models table); 0 = not available */\n  const id = pick === \"deepseek\" ? \"ds\" : pick;\n  try {\n    const n = Number(await dbRpc(\"ex_price\", { p_id: id, p_files: false }));\n    if (Number.isInteger(n) && n >= 1 && n <= 100) return n;\n  } catch (e) {\n    console.error(\"ex_price failed\", id, String(e));\n  }\n  return id === \"ds\" ? 1 : 0;\n}\nasync function handle(req, ctx) {"),
    ('  const key = Deno.env.get(pick === "deepseek" ? "DEEPSEEK_API_KEY" : "PERPLEXITY_API_KEY");',
     '  if (typeof b?.model === "string" && b.model && b.model !== "deepseek" && b.model !== "ds" && pick === "deepseek") return json({ error: "\\u0627\\u06CC\\u0646 \\u0645\\u062F\\u0644 \\u0647\\u0648\\u0634 \\u0645\\u0635\\u0646\\u0648\\u0639\\u06CC \\u062F\\u0631 \\u062F\\u0633\\u062A\\u0631\\u0633 \\u0646\\u06CC\\u0633\\u062A." }, 400);\n  const key = Deno.env.get(pick === "deepseek" ? "DEEPSEEK_API_KEY" : "PERPLEXITY_API_KEY");'),
    ('  let rs;\n  try {\n    rs = await dbRpc("ai_reserve", { p_token: String(b?.token || ""), p_amount: count });',
     '  const unit = await unitOf(pick);\n  if (!unit) return json({ error: "\\u0627\\u06CC\\u0646 \\u0645\\u062F\\u0644 \\u0647\\u0648\\u0634 \\u0645\\u0635\\u0646\\u0648\\u0639\\u06CC \\u062F\\u0631 \\u062F\\u0633\\u062A\\u0631\\u0633 \\u0646\\u06CC\\u0633\\u062A." }, 400);\n  let rs;\n  try {\n    rs = await dbRpc("ai_reserve", { p_token: String(b?.token || ""), p_amount: count * unit });'),
    ("tokens: Number(rs.tokens) || 0, need: count }, 402);", "tokens: Number(rs.tokens) || 0, need: count * unit }, 402);"),
    ("  ctx.reserved = count;\n", "  ctx.reserved = count * unit;\n"),
    ("  if (used < ctx.reserved) {\n    const back = ctx.reserved - used;", "  if (used * unit < ctx.reserved) {\n    const back = ctx.reserved - used * unit;"),
    ("used, tokens: bal });", "used, cost: used * unit, tokens: bal });"),
], "EXPRICE")
fw = patch(os.path.join(APP, "files-worker.js"), [
    ('const DSURL = process.env.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions";',
     'const DSURL = process.env.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions";\nconst PPKEY = process.env.PERPLEXITY_API_KEY || "";   /* EXPRICE */\nconst PPURL = process.env.PERPLEXITY_URL || "https://api.perplexity.ai/v1/agent";\nconst EXA = { luna: "openai/gpt-6-luna", haiku: "anthropic/claude-haiku-5-5", hyd: "google/gemini-4-hydrogen", sonnet: "anthropic/claude-sonnet-5-5", sol: "openai/gpt-6.2-sol", carbon: "google/gemini-4-carbon", argon: "google/gemini-4-argon", opus: "anthropic/claude-opus-5-5", astra: "openai/gpt-6.2-astra", fable: "anthropic/claude-fable-5-2" };'),
    ("  const prompt = buildPrompt(text, count, p, avoid);\n",
     "  const prompt = buildPrompt(text, count, p, avoid);\n  const pm = EXA[String((p && p.ai) || \"\")] || \"\";\n  if (pm && !PPKEY) return { ok: false, err: \"این مدل روی سرور تنظیم نشده است.\" };\n"),
    ("""      res = await fetch(DSURL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + DSKEY },
        body: JSON.stringify({
          model: DSMODEL,
          messages: [{ role: "system", content: "You write quizzes from a given text and answer only with valid json." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 8000,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(110000),
      });""",
"""      res = await fetch(pm ? PPURL : DSURL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + (pm ? PPKEY : DSKEY) },
        body: JSON.stringify(pm
          ? { model: pm, instructions: "You write quizzes from a given text and answer only with valid json.", input: [{ role: "user", content: prompt }], max_output_tokens: 10000 }
          : {
            model: DSMODEL,
            messages: [{ role: "system", content: "You write quizzes from a given text and answer only with valid json." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 8000,
            temperature: 0.4,
          }),
        signal: AbortSignal.timeout(pm ? 170000 : 110000),
      });"""),
    ("""    const quiz = clean(parseJson(String((((d || {}).choices || [])[0] || {}).message ? d.choices[0].message.content : "")), p.mode, count);""",
"""    let txt = "";
    if (pm) {
      txt = d && typeof d.output_text === "string" ? d.output_text : "";
      if (!txt) for (const it of Array.isArray(d && d.output) ? d.output : []) for (const c of Array.isArray(it && it.content) ? it.content : []) if (c && typeof c.text === "string" && (!c.type || c.type === "output_text")) txt += c.text;
    } else txt = String((((d || {}).choices || [])[0] || {}).message ? d.choices[0].message.content : "");
    const quiz = clean(parseJson(txt), p.mode, count);"""),
], "EXPRICE")
for path, new in ((os.path.join(APP, "fn", "node-api.js"), api), (os.path.join(APP, "files-worker.js"), fw)):
    if new is not None:
        open(path + ".new", "w", encoding="utf-8").write(new)
        print("prepared", os.path.basename(path))
PZPY_END

echo "[2/6] preparing code (nothing is replaced yet)"
cp -p "$APP/fn/node-api.js" "$BK/node-api.js"; cp -p "$APP/files-worker.js" "$BK/files-worker.js"
rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"
python3 -I "$T/patch_js.py" || { echo "ERR: the code on the server is different from what this installer expects; nothing was changed. Send me this message."; rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"; exit 1; }
if [ -f "$APP/fn/node-api.js.new" ]; then cp "$APP/fn/node-api.js.new" "$T/na.mjs"; "$NODE" --check "$T/na.mjs" || { echo "ERR: syntax check failed (node-api); nothing was changed"; rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"; exit 1; }; fi
if [ -f "$APP/files-worker.js.new" ]; then cp "$APP/files-worker.js.new" "$T/fw.js"; "$NODE" --check "$T/fw.js" || { echo "ERR: syntax check failed (files-worker); nothing was changed"; rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"; exit 1; }; fi
echo "OK"

echo "[3/6] updating database"
eval "$PZ_PSQLCMD" < "$T/ex.sql" >/dev/null || { echo "ERR: database step failed (ex.sql); files were not replaced"; rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"; exit 1; }
python3 -I "$T/patch_sql.py" || { echo "ERR: database functions differ from what this installer expects; files were not replaced. Send me this message."; rm -f "$APP/fn/node-api.js.new" "$APP/files-worker.js.new"; exit 1; }
echo "OK"

echo "[4/6] installing code"
for f in "$APP/fn/node-api.js" "$APP/files-worker.js"; do
  if [ -f "$f.new" ]; then chmod --reference="$f" "$f.new" 2>/dev/null; chown --reference="$f" "$f.new" 2>/dev/null; mv -f "$f.new" "$f"; echo "replaced $(basename "$f")"; else echo "$(basename "$f") already up to date"; fi
done

echo "[5/6] restarting services"
$RESTART
if systemctl cat pazmoonak-files >/dev/null 2>&1 || [ -n "${PZ_RESTART_W_FORCE:-}" ]; then $RESTART_W; fi
sleep 2
curl -fsS "$API/healthz" >/dev/null 2>&1 && echo "OK" || { echo "ERR: service did not come up. Old files are in $BK (copy node-api.js to $APP/fn/ and files-worker.js to $APP/, then restart)"; exit 1; }

echo "[6/6] checking"
b=$(curl -s -X POST -H 'content-type: application/json' -d '{}' "$API/rest/v1/rpc/ex_models")
case "$b" in *'"models"'*) echo "OK model list: $(echo "$b" | grep -o '"id"' | wc -l) models";; *) echo "WARN model list answered: $(echo "$b" | head -c 160)";; esac
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"token":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","topic":"x","count":1,"model":"neon"}' "$API/functions/v1/node-api")
case "$c" in 400) echo "OK unavailable model is refused (400)";; *) echo "WARN node-api answered $c for an unavailable model (expected 400)";; esac
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"token":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","topic":"x","count":1,"model":"sonnet"}' "$API/functions/v1/node-api")
case "$c" in 401) echo "OK model request reaches the account check (401)";; *) echo "WARN node-api answered $c (expected 401)";; esac
if grep -q "^PERPLEXITY_API_KEY=." "$ENVF" 2>/dev/null; then echo "OK Perplexity key is set"; else echo "WARN PERPLEXITY_API_KEY is missing in $ENVF: only DeepSeek will work"; fi
echo "backup of the old files: $BK"
echo "DONE"
