#!/bin/bash
# Pazmoonak: topic quiz ("ساخت آزمون با هوش مصنوعی") built in the background and never lost.
# After the user presses the button the pulaks are taken at once and the exam is built on the server (worker service "pazmoonak-gen"),
# even if the user closes the site, the browser or turns the phone off. Not delivered questions are refunded automatically.
# What it does: adds 1 table + functions to the database, wraps ai_reserve/ai_refund (normal calls pass through unchanged),
# installs the worker /opt/pazmoonak/gen-worker.js as a systemd service, runs self tests (one of them makes a real 1-question AI call).
# Run as root:  bash gen-install.sh      Safe to run more than once. Does NOT change node-api.js, server.js or any secret.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"
DB="${PZ_DB:-pazmoonak}"
ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
PORTV=$(grep -m1 "^PORT=" "$ENVF" 2>/dev/null | cut -d= -f2- | tr -d "\"' ")
API="${PZ_API:-http://127.0.0.1:${PORTV:-8787}}"
SVC="${PZ_SERVICE:-pazmoonak}"
UNIT="pazmoonak-gen"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
[ -f "$APP/server.js" ] && [ -d "$APP/fn" ] || { echo "ERR: $APP not found"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
PSQL() { su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -At -d $DB"; }
FAIL=0
BK="/root/gen-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

echo "[1/6] checking"
command -v node >/dev/null 2>&1 || { echo "ERR: node not found"; exit 1; }
NODE=$(systemctl cat "$SVC" 2>/dev/null | grep -m1 '^ExecStart=' | sed 's/^ExecStart=//' | tr ' ' '\n' | grep -m1 '/node$')
[ -x "${NODE:-}" ] || NODE=$(command -v node)
node -e 'if(typeof fetch!=="function"||typeof AbortSignal.timeout!=="function"){process.exit(1)}' || { echo "ERR: node is too old (needs node 18 or newer)"; exit 1; }
echo "select 1" | PSQL >/dev/null 2>&1 || { echo "ERR: cannot reach database $DB"; exit 1; }
MISS=$(PSQL <<'PZCHK_END'
select string_agg(x, ', ') from (
  select 'function ' || f x from unnest(array['session_uid','validate_questions','is_group_staff','group_sync_staff','ex_price','ai_reserve','ai_refund']) f
    where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f)
  union all select 'table ' || t from unnest(array['users','token_log','quizzes','user_quizzes','user_sessions','ex_models']) t where to_regclass('public.' || t) is null
  union all select 'column ' || c from unnest(array['quizzes.id','quizzes.title','quizzes.description','quizzes.questions','quizzes.admin_hash','quizzes.group_id','quizzes.creator_id','quizzes.duration_min','user_quizzes.secret','users.tokens']) c
    where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = split_part(c, '.', 1) and column_name = split_part(c, '.', 2))
) s;
PZCHK_END
)
[ -z "$MISS" ] || { echo "ERR: the database is missing: $MISS"; echo "(install the earlier updates first)"; exit 1; }
SIGS=$(echo "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and ((p.proname in ('ai_reserve', 'ai_refund')) and pg_get_function_identity_arguments(p.oid) in ('p_token text, p_amount integer', 'p_uid uuid, p_amount integer'))" | PSQL)
[ "$SIGS" = "2" ] || { echo "ERR: ai_reserve / ai_refund have a different signature than expected"; exit 1; }
grep -q -E "^(SUPABASE_SERVICE_ROLE_KEY|SERVICE_KEY)=." "$ENVF" 2>/dev/null || { echo "ERR: SERVICE_KEY not found in $ENVF"; exit 1; }
curl -fsS -m 8 "$API/healthz" >/dev/null 2>&1 || { echo "ERR: the API does not answer at $API/healthz"; exit 1; }
echo "OK (node: $NODE)"

echo "[2/6] updating database"
# a rollback script is written first; it puts ai_reserve / ai_refund back exactly as they are now
cat > "$BK/undo.sh" <<PZUNDO_END
#!/bin/bash
# Undo gen-install: stops the worker and puts the original ai_reserve / ai_refund back. Unfinished jobs are refunded first.
set -u
systemctl stop $UNIT 2>/dev/null; systemctl disable $UNIT 2>/dev/null
su postgres -c "psql -q -At -d $DB" <<'SQL'
select gen_fail(id, 'ساخت آزمون انجام نشد؛ پولک شما برگشت.') from gen_jobs where status in ('queued', 'running');
do \$\$ begin
  if exists (select 1 from pg_proc where proname = 'ai_reserve_orig') then
    drop function if exists public.ai_reserve(text, int); alter function public.ai_reserve_orig(text, int) rename to ai_reserve;
  end if;
  if exists (select 1 from pg_proc where proname = 'ai_refund_orig') then
    drop function if exists public.ai_refund(uuid, int); alter function public.ai_refund_orig(uuid, int) rename to ai_refund;
  end if;
end \$\$;
SQL
rm -f /etc/systemd/system/$UNIT.service; systemctl daemon-reload
echo "undone (the gen_jobs table and the gen_* functions are left in the database; they are harmless)"
PZUNDO_END
chmod 700 "$BK/undo.sh"
cat > "$T/gen.sql" <<'PZGEN_SQL_END'
-- Pazmoonak: topic quiz built in the background (durable). Idempotent. One transaction.
set client_min_messages = warning;
begin;

create table if not exists public.gen_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  idem text,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  params jsonb not null,
  q_count int not null check (q_count between 1 and 100),
  unit int not null check (unit between 1 and 100),
  paid int not null default 0,        -- everything taken from the user for this job
  held int not null default 0,        -- paid, not currently in an AI request
  inflight int not null default 0,    -- paid, currently inside an AI request
  returned int not null default 0,    -- given back to the user (paid = held + inflight + returned, always)
  tok_hash text,
  attempts int not null default 0,
  not_before timestamptz not null default now(),
  lease_until timestamptz,
  title text,
  quiz_id text,
  q_got int,
  err text,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gen_jobs_money check (held >= 0 and inflight >= 0 and returned >= 0 and paid = held + inflight + returned)
);
create unique index if not exists gen_jobs_idem on public.gen_jobs(user_id, idem) where idem is not null;
create index if not exists gen_jobs_user on public.gen_jobs(user_id, created_at desc);
create index if not exists gen_jobs_open on public.gen_jobs(status, created_at) where status in ('queued', 'running');
create index if not exists gen_jobs_tok on public.gen_jobs(tok_hash) where tok_hash is not null;
alter table public.gen_jobs enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table public.gen_jobs from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on table public.gen_jobs from authenticated; end if;
end $$;

-- ---------- the two money functions of the existing server code are wrapped: normal calls pass straight through ----------
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ai_reserve_orig') then
    alter function public.ai_reserve(text, int) rename to ai_reserve_orig;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ai_refund_orig') then
    alter function public.ai_refund(uuid, int) rename to ai_refund_orig;
  end if;
end $$;

-- a request made by the background worker carries a job token ("gj_" + 64 hex) instead of a login token:
-- the pulaks were already taken when the user pressed the button, so the request only moves them from "held" to "inflight".
create or replace function public.ai_reserve(p_token text, p_amount int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare j gen_jobs; use_ int; extra int; bal int;
begin
  if p_token is null or left(p_token, 3) <> 'gj_' then return public.ai_reserve_orig(p_token, p_amount); end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then raise exception 'مقدار نامعتبر است.'; end if;
  if p_token !~ '^gj_[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select * into j from gen_jobs where tok_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex') and status = 'running' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  use_ := least(j.held, p_amount);
  extra := p_amount - use_;
  if extra > 0 then
    update users set tokens = tokens - extra where id = j.user_id and tokens >= extra returning tokens into bal;
    if not found then
      select tokens into bal from users where id = j.user_id;
      return jsonb_build_object('ok', false, 'error', 'insufficient', 'tokens', coalesce(bal, 0));
    end if;
    insert into token_log(user_id, delta, balance, reason, note) values (j.user_id, -extra, bal, 'ai', 'gen');
  end if;
  update gen_jobs set held = held - use_, inflight = inflight + p_amount, paid = paid + extra, updated_at = now() where id = j.id;
  select tokens into bal from users where id = j.user_id;
  return jsonb_build_object('ok', true, 'uid', j.user_id, 'tokens', coalesce(bal, 0));
end $$;

-- while a job has pulaks inside an AI request, what that request gives back (partial result / failure) goes back to the job, not to the user:
-- the job settles once at the end, so the user never sees the money going up and down and a retry always has the money it needs.
create or replace function public.ai_refund(p_uid uuid, p_amount int)
returns integer
language plpgsql security definer set search_path = public as $$
declare j gen_jobs; d int; rest int;
begin
  if p_uid is null or p_amount is null or p_amount < 1 or p_amount > 1000 then return public.ai_refund_orig(p_uid, p_amount); end if;
  select * into j from gen_jobs where user_id = p_uid and status = 'running' and inflight > 0 order by started_at limit 1 for update;
  if not found then return public.ai_refund_orig(p_uid, p_amount); end if;
  d := least(p_amount, j.inflight);
  update gen_jobs set held = held + d, inflight = inflight - d, updated_at = now() where id = j.id;
  rest := p_amount - d;
  if rest > 0 then return public.ai_refund_orig(p_uid, rest); end if;
  return (select tokens from users where id = p_uid);
end $$;

revoke all on function public.ai_reserve(text, int), public.ai_refund(uuid, int), public.ai_reserve_orig(text, int), public.ai_refund_orig(uuid, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ai_reserve(text, int), public.ai_refund(uuid, int), public.ai_reserve_orig(text, int), public.ai_refund_orig(uuid, int) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on function public.ai_reserve(text, int), public.ai_refund(uuid, int), public.ai_reserve_orig(text, int), public.ai_refund_orig(uuid, int) from authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.ai_reserve(text, int), public.ai_refund(uuid, int), public.ai_reserve_orig(text, int), public.ai_refund_orig(uuid, int) to service_role; end if;
end $$;

-- ---------- internal: close the job's money. keeps p_keep pulaks as the price of what was delivered, gives everything else back to the user ----------
create or replace function public.gen_settle(p_job uuid, p_keep int)
returns int
language plpgsql security definer set search_path = public as $$
declare j gen_jobs; tot int; back int; bal int;
begin
  select * into j from gen_jobs where id = p_job for update;
  if not found then return 0; end if;
  tot := j.held + j.inflight;
  back := greatest(0, tot - greatest(coalesce(p_keep, 0), 0));
  if back > 0 then
    update users set tokens = tokens + back where id = j.user_id returning tokens into bal;
    if found then insert into token_log(user_id, delta, balance, reason, note) values (j.user_id, back, bal, 'refund', 'gen'); end if;
  end if;
  update gen_jobs set returned = returned + tot, held = 0, inflight = 0, updated_at = now() where id = p_job;
  return back;
end $$;
revoke all on function public.gen_settle(uuid, int) from public;

-- ---------- called by the site (login token) ----------
create or replace function public.gen_start(p_token text, p_params jsonb, p_idem text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; p jsonb := coalesce(p_params, '{}'::jsonb); v_mode text; v_level text; v_cnt int; v_topic text; v_ai text; v_unit int; v_total int;
  v_dm text; v_dmin int; v_grp text; v_idem text; jid uuid; bal int; ex gen_jobs;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  v_idem := nullif(left(coalesce(p_idem, ''), 80), '');
  -- lock the user's row: two quick clicks (or two tabs) are handled one after the other
  perform 1 from users where id = uid for update;
  if v_idem is not null then
    select * into ex from gen_jobs where user_id = uid and idem = v_idem;
    if found then return jsonb_build_object('ok', true, 'id', ex.id, 'dup', true, 'tokens', (select tokens from users where id = uid)); end if;
  end if;
  v_mode := case when p->>'mode' in ('mcq', 'tf', 'mixed') then p->>'mode' else 'mixed' end;
  v_level := case when p->>'level' in ('easy', 'medium', 'hard') then p->>'level' else 'medium' end;
  begin v_cnt := (p->>'count')::int; exception when others then v_cnt := null; end;
  if v_cnt is null or v_cnt < 1 then v_cnt := 10; end if;
  v_cnt := least(v_cnt, 30);
  v_topic := left(trim(coalesce(p->>'topic', '')), 300);
  if v_topic = '' then return jsonb_build_object('ok', false, 'error', 'topic'); end if;
  v_ai := coalesce(nullif(p->>'ai', ''), 'ds');
  v_unit := ex_price(v_ai, false);
  if v_unit is null then return jsonb_build_object('ok', false, 'error', 'model'); end if;
  v_dm := case when p->>'dur_mode' in ('none', 'auto', 'set') then p->>'dur_mode' else 'none' end;
  begin v_dmin := (p->>'dur_min')::int; exception when others then v_dmin := null; end;
  if v_dm = 'set' and (v_dmin is null or v_dmin < 1 or v_dmin > 600) then v_dm := 'none'; end if;
  v_grp := nullif(p->>'group', '');
  if v_grp is not null and not is_group_staff(uid, v_grp) then return jsonb_build_object('ok', false, 'error', 'group'); end if;
  if (select count(*) from gen_jobs where user_id = uid and status in ('queued', 'running')) >= 2 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  v_total := v_cnt * v_unit;
  update users set tokens = tokens - v_total where id = uid and tokens >= v_total returning tokens into bal;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'tokens', coalesce((select tokens from users where id = uid), 0), 'need', v_total);
  end if;
  insert into token_log(user_id, delta, balance, reason, note) values (uid, -v_total, bal, 'ai', 'gen');
  insert into gen_jobs(user_id, idem, params, q_count, unit, paid, held)
  values (uid, v_idem, jsonb_build_object('mode', v_mode, 'level', v_level, 'count', v_cnt, 'topic', v_topic, 'ai', v_ai,
    'dur_mode', v_dm, 'dur_min', case when v_dm = 'set' then v_dmin else null end, 'group', v_grp), v_cnt, v_unit, v_total, v_total)
  returning id into jid;
  return jsonb_build_object('ok', true, 'id', jid, 'tokens', bal, 'cost', v_total);
end $$;

create or replace function public.gen_status(p_token text, p_job text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; jid uuid; rows jsonb;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_job is not null then
    begin jid := p_job::uuid; exception when others then jid := null; end;
  end if;
  select coalesce(jsonb_agg(r order by (r->>'created') desc), '[]'::jsonb) into rows from (
    select jsonb_build_object('id', g.id, 'status', g.status, 'topic', g.params->>'topic', 'count', g.q_count, 'got', g.q_got, 'quiz', g.quiz_id,
      'title', g.title, 'err', g.err, 'seen', g.seen, 'created', g.created_at, 'finished', g.finished_at, 'cost', g.paid, 'spent', case when g.status = 'done' then coalesce(g.q_got, 0) * g.unit else 0 end,
      'ahead', case when g.status = 'queued' then (select count(*) from gen_jobs o where o.status in ('queued', 'running') and o.created_at < g.created_at) else 0 end,
      'level', g.params->>'level', 'mode', g.params->>'mode', 'ai', g.params->>'ai') as r
    from gen_jobs g
    where g.user_id = uid and (
      (jid is not null and g.id = jid)
      or (jid is null and (g.status in ('queued', 'running') or (g.seen = false and g.finished_at > now() - interval '3 days')))
    )
    order by g.created_at desc limit 8
  ) s;
  return jsonb_build_object('ok', true, 'tokens', (select tokens from users where id = uid), 'jobs', rows);
end $$;

create or replace function public.gen_seen(p_token text, p_job text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; jid uuid;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  begin jid := p_job::uuid; exception when others then return jsonb_build_object('ok', false, 'error', 'not_found'); end;
  update gen_jobs set seen = true where id = jid and user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- called by the worker (service key) ----------
create or replace function public.gen_claim()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare j gen_jobs; tok text;
begin
  perform pg_advisory_xact_lock(727001);
  select g.* into j from gen_jobs g
  where g.status = 'queued' and g.not_before <= now() and g.attempts < 3
    and not exists (select 1 from gen_jobs r where r.user_id = g.user_id and r.status = 'running')
  order by g.created_at limit 1 for update skip locked;
  if not found then return null; end if;
  tok := 'gj_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update gen_jobs set status = 'running', attempts = attempts + 1, tok_hash = encode(sha256(convert_to(tok, 'utf8')), 'hex'),
    started_at = coalesce(started_at, now()), lease_until = now() + interval '10 minutes', updated_at = now()
  where id = j.id;
  return jsonb_build_object('id', j.id, 'params', j.params, 'token', tok, 'attempts', j.attempts + 1, 'count', j.q_count, 'unit', j.unit);
end $$;

create or replace function public.gen_beat(p_job uuid)
returns boolean
language sql security definer set search_path = public as $$
  with u as (update gen_jobs set lease_until = now() + interval '10 minutes' where id = p_job and status = 'running' returning 1) select exists (select 1 from u);
$$;

-- success: save the quiz in the user's account, keep only the price of the delivered questions and give the rest back
create or replace function public.gen_finish(p_job uuid, p_qs jsonb, p_title text, p_desc text, p_dur int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare jb gen_jobs; got int := 0; qid text; secret text; v_title text; grp text; msg text; keep int; back int;
begin
  select * into jb from gen_jobs where id = p_job for update;
  if not found or jb.status <> 'running' then return jsonb_build_object('ok', false, 'error', 'not_running'); end if;
  if p_qs is not null and jsonb_typeof(p_qs) = 'array' then got := jsonb_array_length(p_qs); end if;
  if got = 0 then msg := 'سؤالی ساخته نشد.'; end if;
  if got > 0 then
    begin
      if got > jb.q_count then raise exception 'too many questions'; end if;
      perform validate_questions(p_qs);
      v_title := left(trim(coalesce(nullif(trim(p_title), ''), left(jb.params->>'topic', 80), 'آزمون')), 200);
      if char_length(v_title) = 0 then v_title := 'آزمون'; end if;
      grp := nullif(jb.params->>'group', '');
      if grp is not null and not is_group_staff(jb.user_id, grp) then raise exception 'گروه پیدا نشد یا شما مالک یا مدیر آن نیستید.'; end if;
      secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      qid := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into quizzes(id, title, description, questions, admin_hash, group_id, creator_id, duration_min)
      values (qid, v_title, left(coalesce(nullif(trim(p_desc), ''), ''), 2000), p_qs, encode(sha256(convert_to(secret, 'utf8')), 'hex'), grp, jb.user_id,
        case when p_dur between 1 and 600 then p_dur else null end);
      insert into user_quizzes(user_id, quiz_id, secret) values (jb.user_id, qid, secret)
      on conflict (user_id, quiz_id) do update set secret = excluded.secret;
      if grp is not null then perform group_sync_staff(grp, false); end if;
    exception when others then
      qid := null; got := 0; v_title := null;
      msg := 'ذخیره‌ی آزمون ناموفق بود: ' || left(sqlerrm, 200);
    end;
  end if;
  if got > 0 then
    keep := got * jb.unit;
    back := public.gen_settle(p_job, keep);
    update gen_jobs set status = 'done', quiz_id = qid, q_got = got, title = v_title, err = case when got < q_count then 'تعداد سؤال کمتر از خواسته‌شده ساخته شد؛ پولک بقیه برگشت.' else null end,
      seen = false, finished_at = now(), updated_at = now(), tok_hash = null, lease_until = null where id = p_job;
    return jsonb_build_object('ok', true, 'status', 'done', 'quiz', qid, 'got', got, 'back', back);
  end if;
  back := public.gen_settle(p_job, 0);
  update gen_jobs set status = 'failed', err = msg, q_got = 0, seen = false, finished_at = now(), updated_at = now(), tok_hash = null, lease_until = null where id = p_job;
  return jsonb_build_object('ok', true, 'status', 'failed', 'back', back);
end $$;

-- a failure that cannot be fixed by trying again (or the last try): everything is given back
create or replace function public.gen_fail(p_job uuid, p_err text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare jb gen_jobs; back int;
begin
  select * into jb from gen_jobs where id = p_job for update;
  if not found or jb.status not in ('running', 'queued') then return jsonb_build_object('ok', false, 'error', 'not_open'); end if;
  back := public.gen_settle(p_job, 0);
  update gen_jobs set status = 'failed', err = coalesce(nullif(left(p_err, 300), ''), 'ساخت آزمون انجام نشد.'), q_got = 0, seen = false,
    finished_at = now(), updated_at = now(), tok_hash = null, lease_until = null where id = p_job;
  return jsonb_build_object('ok', true, 'back', back);
end $$;

-- a temporary failure: the job goes back to the queue (the pulaks stay with it) and is tried again after a pause
create or replace function public.gen_release(p_job uuid, p_err text, p_wait int default 20)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare jb gen_jobs;
begin
  select * into jb from gen_jobs where id = p_job for update;
  if not found or jb.status <> 'running' then return jsonb_build_object('ok', false, 'error', 'not_running'); end if;
  if jb.attempts >= 3 then return public.gen_fail(p_job, p_err); end if;
  update gen_jobs set status = 'queued', held = held + inflight, inflight = 0, tok_hash = null, lease_until = null,
    not_before = now() + make_interval(secs => greatest(1, least(coalesce(p_wait, 20), 600))), err = left(p_err, 300), updated_at = now() where id = p_job;
  return jsonb_build_object('ok', true, 'retry', true);
end $$;

-- housekeeping: jobs whose worker died go back to the queue (or fail after 3 tries); very old jobs are removed
create or replace function public.gen_maintain(p_before timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare jr record; a int := 0; b int := 0; c int;
begin
  for jr in select id, attempts from gen_jobs where status = 'running' and (lease_until < now() or lease_until is null or updated_at < p_before) loop
    if jr.attempts >= 3 then
      perform public.gen_fail(jr.id, 'ساخت آزمون انجام نشد؛ پولک شما برگشت.'); b := b + 1;
    else
      -- a request may still be running inside the server (and give its refund back later): wait a few minutes before trying again
      update gen_jobs set status = 'queued', not_before = now() + case when inflight > 0 then interval '4 minutes' else interval '0' end,
        held = held + inflight, inflight = 0, tok_hash = null, lease_until = null, updated_at = now() where id = jr.id;
      a := a + 1;
    end if;
  end loop;
  for jr in select id from gen_jobs where status = 'queued' and (attempts >= 3 or created_at < now() - interval '24 hours') loop
    perform public.gen_fail(jr.id, 'ساخت آزمون انجام نشد؛ پولک شما برگشت.'); b := b + 1;
  end loop;
  delete from gen_jobs where status in ('done', 'failed') and finished_at < now() - interval '60 days';
  get diagnostics c = row_count;
  return jsonb_build_object('requeued', a, 'failed', b, 'deleted', c);
end $$;

-- ---------- permissions ----------
revoke all on function public.gen_start(text, jsonb, text), public.gen_status(text, text), public.gen_seen(text, text) from public;
revoke all on function public.gen_claim(), public.gen_beat(uuid), public.gen_finish(uuid, jsonb, text, text, int), public.gen_fail(uuid, text),
  public.gen_release(uuid, text, int), public.gen_maintain(timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.gen_start(text, jsonb, text), public.gen_status(text, text), public.gen_seen(text, text) to anon;
    revoke all on function public.gen_claim(), public.gen_beat(uuid), public.gen_finish(uuid, jsonb, text, text, int), public.gen_fail(uuid, text),
      public.gen_release(uuid, text, int), public.gen_maintain(timestamptz), public.gen_settle(uuid, int) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.gen_start(text, jsonb, text), public.gen_status(text, text), public.gen_seen(text, text) to authenticated;
    revoke all on function public.gen_claim(), public.gen_beat(uuid), public.gen_finish(uuid, jsonb, text, text, int), public.gen_fail(uuid, text),
      public.gen_release(uuid, text, int), public.gen_maintain(timestamptz), public.gen_settle(uuid, int) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.gen_claim(), public.gen_beat(uuid), public.gen_finish(uuid, jsonb, text, text, int), public.gen_fail(uuid, text),
      public.gen_release(uuid, text, int), public.gen_maintain(timestamptz) to service_role;
  end if;
end $$;
commit;
PZGEN_SQL_END
PSQL < "$T/gen.sql" || { echo "ERR: database update failed (it runs in one transaction, so nothing was left half-applied)"; exit 1; }
echo "OK"

echo "[3/6] installing the worker"
cat > "$T/gen-worker.js" <<'PZGEN_JS_END'
"use strict";
/* Pazmoonak: background worker for topic quizzes ("ساخت آزمون با هوش مصنوعی").
   The job lives in the database (gen_jobs); the pulaks were taken when the user pressed the button.
   This process claims a job, asks the site's own AI function (node-api) for the questions with a one-time job token
   (so the model choice, prices and proxy are exactly the same as everywhere else) and hands the result to gen_finish,
   which saves the quiz on the user's account and gives back what was not delivered.
   Nothing important is kept in memory: if this process or the server stops, unfinished jobs are picked up again. */
const API = (process.env.PZ_API || process.env.SUPABASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY || "";
const AIURL = (process.env.GEN_AI_URL || API + "/functions/v1/node-api");
const CONC = Math.max(1, Math.min(4, parseInt(process.env.GEN_CONC, 10) || 2));
const POLL = Math.max(500, parseInt(process.env.GEN_POLL_MS, 10) || 2000);
const AI_TIMEOUT = Math.max(20000, parseInt(process.env.GEN_AI_TIMEOUT_MS, 10) || 9 * 60 * 1000);
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(name, args) {
  const res = await fetch(API + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SKEY, Authorization: "Bearer " + SKEY },
    body: JSON.stringify(args || {}),
    signal: AbortSignal.timeout(30000),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(name + " HTTP " + res.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
/* a database call that must not be lost (tries again for a while) */
async function rpcKeep(name, args, tries) {
  let last;
  for (let i = 0; i < (tries || 8); i++) {
    try { return await rpc(name, args); } catch (e) { last = e; log(name, "failed, retrying:", String(e).slice(0, 160)); await sleep(Math.min(15000, 1500 * (i + 1))); }
  }
  throw last;
}

const LIM = { title: 200, desc: 2000, text: 500, opt: 300, min: 2, max: 8, qs: 100 };
function normalize(d) {
  const out = [];
  for (const q of Array.isArray(d && d.questions) ? d.questions : []) {
    const text = String((q && q.text) == null ? "" : q.text).trim().slice(0, LIM.text);
    if (!text || !q) continue;
    if (q.type === "tf") {
      if (q.correct === 0 || q.correct === 1) out.push({ type: "tf", text, options: ["درست", "نادرست"], correct: q.correct });
      continue;
    }
    const opts = (Array.isArray(q.options) ? q.options : []).map((o) => String(o == null ? "" : o).trim().slice(0, LIM.opt));
    if (opts.length < LIM.min || opts.length > LIM.max || opts.some((o) => !o)) continue;
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) continue;
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= opts.length) continue;
    out.push({ type: "mcq", text, options: opts, correct: q.correct });
  }
  return out.slice(0, LIM.qs);
}
function estimateMinutes(qs, level) {
  const per = { tf: [20, 30, 40], mcq: [40, 60, 90] }, li = level === "easy" ? 0 : level === "hard" ? 2 : 1;
  let sec = 0;
  qs.forEach((q) => { sec += per[q.type === "tf" ? "tf" : "mcq"][li] + (String(q.text).indexOf("$") >= 0 ? 30 : 0); });
  let d = Math.max(1, Math.ceil(sec / 60));
  if (d > 30) d = Math.ceil(d / 5) * 5;
  return Math.min(600, d);
}
const okDur = (v) => (Number.isInteger(v) && v >= 1 && v <= 600 ? v : null);

const M_NET = "ارتباط با هوش مصنوعی برقرار نشد.";
/* one request to the site's AI function. Returns {k:"ok",d,qs} | {k:"retry",err,wait} | {k:"fail",err} | {k:"lost"} */
async function askAI(job) {
  const p = job.params || {};
  const ai = String(p.ai || "ds");
  const body = { mode: p.mode, difficulty: p.level, count: p.count, topic: p.topic, model: ai === "ds" ? "deepseek" : ai, ai, token: job.token };
  let res;
  try {
    res = await fetch(AIURL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SKEY, Authorization: "Bearer " + SKEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT),
    });
  } catch (e) {
    /* no answer: the request may still be running inside the server, so wait a few minutes before trying again */
    return { k: "retry", err: M_NET, wait: 240 };
  }
  let d = null;
  try { d = await res.json(); } catch (e) { /* not json */ }
  const msg = d && typeof d.error === "string" && d.error ? d.error.slice(0, 300) : "";
  if (res.ok) {
    const qs = normalize(d);
    if (!qs.length) return { k: "fail", err: "آزمون معتبری ساخته نشد." };
    return { k: "ok", d, qs };
  }
  if (res.status === 401) return { k: "lost" };
  if (res.status === 402) return { k: "fail", err: "پولک شما برای ساخت این آزمون کافی نبود." };
  if (res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500) return { k: "retry", err: msg || "هوش مصنوعی شلوغ است.", wait: 20 * Math.max(1, job.attempts) };
  return { k: "fail", err: msg || "ساخت آزمون انجام نشد." };
}

async function runJob(job) {
  const t0 = Date.now(), id = job.id;
  const hb = setInterval(() => { rpc("gen_beat", { p_job: id }).catch(() => {}); }, 60000);
  let note = "";
  try {
    const r = await askAI(job);
    if (r.k === "ok") {
      const p = job.params || {}, d = r.d;
      const dur = p.dur_mode === "set" ? okDur(Number(p.dur_min)) : p.dur_mode === "auto" ? (okDur(Number(d.duration_min)) || estimateMinutes(r.qs, p.level)) : null;
      const title = String(d.title || "").trim().slice(0, LIM.title);
      const desc = String(d.description || "").trim().slice(0, LIM.desc);
      const f = await rpcKeep("gen_finish", { p_job: id, p_qs: r.qs, p_title: title, p_desc: desc, p_dur: dur }, 10);
      note = "finish " + JSON.stringify(f);
    } else if (r.k === "retry") {
      const f = await rpcKeep("gen_release", { p_job: id, p_err: r.err, p_wait: r.wait }, 6);
      note = "retry later (" + r.err + ") " + JSON.stringify(f);
    } else if (r.k === "fail") {
      const f = await rpcKeep("gen_fail", { p_job: id, p_err: r.err }, 8);
      note = "failed (" + r.err + ") " + JSON.stringify(f);
    } else {
      note = "lost (token no longer valid; the job was taken over)";
    }
  } catch (e) {
    note = "error " + String(e).slice(0, 200) + " (the job stays and is picked up again automatically)";
  } finally {
    clearInterval(hb);
  }
  log("job", String(id).slice(0, 8), "try " + job.attempts, note, Math.round((Date.now() - t0) / 1000) + "s");
}

let active = 0, stopping = false, warned = 0;
async function tick() {
  if (stopping) return;
  if (!SKEY) { if (Date.now() - warned > 60000) { warned = Date.now(); log("waiting: SERVICE_KEY is missing"); } return; }
  while (!stopping && active < CONC) {
    let job;
    try { job = await rpc("gen_claim", {}); } catch (e) { if (Date.now() - warned > 60000) { warned = Date.now(); log("claim failed:", String(e).slice(0, 200)); } return; }
    if (!job) return;
    active++;
    runJob(job).catch((e) => log("job crashed", String(e).slice(0, 200))).finally(() => { active--; });
  }
}
async function maintain(boot) {
  if (!SKEY) return;
  try { const r = await rpc("gen_maintain", boot ? { p_before: boot } : {}); if (r && (r.requeued || r.failed)) log("maintain", JSON.stringify(r)); } catch (e) { log("maintain failed:", String(e).slice(0, 200)); }
}

async function main() {
  log("gen worker started; api=" + API + " concurrency=" + CONC);
  /* a restart: jobs this worker started before it stopped are put back in the queue right away (only one worker runs) */
  await maintain(new Date(Date.now() - 2000).toISOString());
  const t1 = setInterval(tick, POLL);
  const t2 = setInterval(() => maintain(), 5 * 60 * 1000);
  tick();
  let bye_ = false;
  const bye = async () => {
    if (bye_) return; bye_ = true;
    stopping = true;
    clearInterval(t1); clearInterval(t2);
    log("stopping; waiting for " + active + " running job(s)");
    const until = Date.now() + 25000;
    while (active > 0 && Date.now() < until) await sleep(300);
    process.exit(0);
  };
  process.on("SIGTERM", bye);
  process.on("SIGINT", bye);
}
process.on("unhandledRejection", (e) => log("unhandled", String(e).slice(0, 200)));
main();
PZGEN_JS_END
"$NODE" --check "$T/gen-worker.js" || { echo "ERR: worker syntax check failed; nothing was installed"; exit 1; }
[ -f "$APP/gen-worker.js" ] && cp -p "$APP/gen-worker.js" "$BK/"
[ -f "/etc/systemd/system/$UNIT.service" ] && cp -p "/etc/systemd/system/$UNIT.service" "$BK/"
install -m 0644 "$T/gen-worker.js" "$APP/gen-worker.js"
echo "OK"

echo "[4/6] installing the service"
SU=$(systemctl show -p User --value "$SVC" 2>/dev/null); SG=$(systemctl show -p Group --value "$SVC" 2>/dev/null)
UG=""; [ -n "$SU" ] && UG="User=$SU"; [ -n "$SG" ] && UG="$UG
Group=$SG"
[ -n "$SU" ] && chown "$SU${SG:+:$SG}" "$APP/gen-worker.js" 2>/dev/null
cat > "/etc/systemd/system/$UNIT.service" <<PZUNIT_END
[Unit]
Description=Pazmoonak worker: topic quizzes built in the background
After=network-online.target postgresql.service $SVC.service
Wants=network-online.target

[Service]
Type=simple
$UG
EnvironmentFile=$ENVF
Environment=PZ_API=$API
ExecStart=$NODE $APP/gen-worker.js
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=40
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=yes
UMask=0077

[Install]
WantedBy=multi-user.target
PZUNIT_END
systemctl daemon-reload
systemctl enable "$UNIT" >/dev/null 2>&1
systemctl restart "$UNIT"
sleep 4
systemctl is-active --quiet "$UNIT" && echo "OK (service $UNIT is running)" || { echo "ERR: service $UNIT is not running:"; journalctl -u "$UNIT" -n 15 --no-pager 2>/dev/null | cut -c1-200; FAIL=1; }

echo "[5/6] self tests"
cat > "$T/selftest.sql" <<'PZGEN_TEST_END'
begin;
create or replace function pg_temp.eq(l text, a anyelement, b anyelement) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL %: got % expected %', l, a, b; else raise notice 'ok   %', l; end if; end $$;
do $$
declare
  u uuid; stok text := repeat('ab', 32);
  r jsonb; j uuid; tok text; bal int; c jsonb; q jsonb; n int; j2 uuid; j3 uuid; tok2 text;
begin
  select id into u from users x where not exists (select 1 from gen_jobs g where g.user_id = x.id and g.status in ('queued', 'running')) order by created_at limit 1;
  if u is null then raise exception 'no users in the database to test with'; end if;
  update gen_jobs set not_before = now() + interval '1 day' where status = 'queued';   -- real queued jobs stay out of the test (rolled back)
  update users set tokens = 100 where id = u;
  insert into user_sessions(token_hash, user_id, expires_at) values (encode(sha256(convert_to(stok,'utf8')),'hex'), u, now() + interval '1 day');
  q := (select jsonb_agg(jsonb_build_object('type','mcq','text','سؤال '||i,'options',jsonb_build_array('الف','ب','ج','د'),'correct',0)) from generate_series(1,10) i);

  -- T1 full success
  r := gen_start(stok, '{"topic":"زیست","count":10,"ai":"ds","mode":"mixed","level":"medium"}', 'k1');
  perform pg_temp.eq('T1 start ok', r->>'ok', 'true'); j := (r->>'id')::uuid;
  perform pg_temp.eq('T1 balance after click', (select tokens from users where id=u), 90);
  c := gen_claim(); perform pg_temp.eq('T1 claim id', (c->>'id')::uuid, j); tok := c->>'token';
  r := ai_reserve(tok, 10); perform pg_temp.eq('T1 reserve ok', r->>'ok', 'true');
  perform pg_temp.eq('T1 no double charge', (select tokens from users where id=u), 90);
  perform pg_temp.eq('T1 inflight', (select inflight from gen_jobs where id=j), 10);
  r := gen_finish(j, q, 'عنوان', 'توضیح', 7); perform pg_temp.eq('T1 finish', r->>'status', 'done');
  perform pg_temp.eq('T1 balance final', (select tokens from users where id=u), 90);
  perform pg_temp.eq('T1 quiz saved', (select count(*)::int from quizzes where id = r->>'quiz' and creator_id=u and duration_min=7), 1);
  perform pg_temp.eq('T1 user_quiz', (select count(*)::int from user_quizzes where user_id=u and quiz_id=r->>'quiz'), 1);
  perform pg_temp.eq('T1 settled', (select returned from gen_jobs where id=j), 10);
  r := ai_reserve(tok, 1); perform pg_temp.eq('T1 token dead after finish', r->>'error', 'no_session');
  r := gen_finish(j, q, 'x', 'y', null); perform pg_temp.eq('T1 finish twice refused', r->>'error', 'not_running');
  perform pg_temp.eq('T1 idem dup', gen_start(stok, '{"topic":"زیست","count":10}', 'k1')->>'dup', 'true');
  perform pg_temp.eq('T1 idem no extra charge', (select tokens from users where id=u), 90);

  -- T2 partial with a pricier model
  r := gen_start(stok, '{"topic":"فیزیک","count":10,"ai":"sonnet"}', 'k2'); j := (r->>'id')::uuid;
  perform pg_temp.eq('T2 charged 20', (select tokens from users where id=u), 70);
  c := gen_claim(); tok := c->>'token';
  perform ai_reserve(tok, 20);
  perform pg_temp.eq('T2 node refund returns balance', ai_refund(u, 6), 70);   -- diverted to the job, user sees no change
  perform pg_temp.eq('T2 held', (select held from gen_jobs where id=j), 6);
  r := gen_finish(j, (select jsonb_agg(e) from (select e from jsonb_array_elements(q) e limit 7) s), 't', '', null);
  perform pg_temp.eq('T2 done', r->>'status', 'done');
  perform pg_temp.eq('T2 user paid 14 net', (select tokens from users where id=u), 76);
  perform pg_temp.eq('T2 note partial', (select err is not null from gen_jobs where id=j), true);

  -- T3 handled failure then retry
  r := gen_start(stok, '{"topic":"شیمی","count":10}', 'k3'); j := (r->>'id')::uuid;
  perform pg_temp.eq('T3 charged', (select tokens from users where id=u), 66);
  c := gen_claim(); tok := c->>'token'; perform ai_reserve(tok, 10); perform ai_refund(u, 10);
  perform pg_temp.eq('T3 user balance unchanged while failing', (select tokens from users where id=u), 66);
  r := gen_release(j, 'شلوغ', 1); perform pg_temp.eq('T3 released', r->>'retry', 'true');
  perform pg_temp.eq('T3 claim blocked by not_before', gen_claim() is null, true);
  update gen_jobs set not_before = now() where id=j;
  c := gen_claim(); perform pg_temp.eq('T3 reclaimed attempts', (c->>'attempts')::int, 2); tok2 := c->>'token';
  perform pg_temp.eq('T3 new token differs', tok2 <> tok, true);
  perform pg_temp.eq('T3 old token dead', ai_reserve(tok, 10)->>'error', 'no_session');
  perform ai_reserve(tok2, 10);
  perform pg_temp.eq('T3 still no extra charge', (select tokens from users where id=u), 66);
  r := gen_finish(j, q, 'x', '', null); perform pg_temp.eq('T3 done', r->>'status', 'done');
  perform pg_temp.eq('T3 final balance', (select tokens from users where id=u), 66);

  -- T4 final failure refunds everything
  r := gen_start(stok, '{"topic":"ریاضی","count":10}'); j := (r->>'id')::uuid;
  c := gen_claim(); tok := c->>'token'; perform ai_reserve(tok, 10); perform ai_refund(u, 10);
  perform pg_temp.eq('T4 before fail', (select tokens from users where id=u), 56);
  r := gen_fail(j, 'خطا'); perform pg_temp.eq('T4 back 10', (r->>'back')::int, 10);
  perform pg_temp.eq('T4 balance', (select tokens from users where id=u), 66);
  perform pg_temp.eq('T4 status', (select status from gen_jobs where id=j), 'failed');
  perform pg_temp.eq('T4 fail twice refused', gen_fail(j,'x')->>'error', 'not_open');

  -- T5 crash while a request is in flight, then recovery
  r := gen_start(stok, '{"topic":"ادبیات","count":10}'); j := (r->>'id')::uuid;
  c := gen_claim(); tok := c->>'token'; perform ai_reserve(tok, 10);
  update gen_jobs set lease_until = now() - interval '1 minute' where id=j;
  r := gen_maintain(); perform pg_temp.eq('T5 requeued', (r->>'requeued')::int, 1);
  perform pg_temp.eq('T5 money back in held', (select held from gen_jobs where id=j), 10);
  perform pg_temp.eq('T5 balance untouched', (select tokens from users where id=u), 56);
  perform pg_temp.eq('T5 waits 4 min', (select not_before > now() + interval '3 minutes' from gen_jobs where id=j), true);
  update gen_jobs set not_before = now() where id=j;
  c := gen_claim(); tok := c->>'token'; perform ai_reserve(tok, 10);
  perform pg_temp.eq('T5 no double charge', (select tokens from users where id=u), 56);
  r := gen_finish(j, q, 'x', '', null); perform pg_temp.eq('T5 done', r->>'status', 'done');
  perform pg_temp.eq('T5 final', (select tokens from users where id=u), 56);

  -- T6 three crashes => failed and refunded
  r := gen_start(stok, '{"topic":"تاریخ","count":10}'); j := (r->>'id')::uuid;
  for n in 1..3 loop
    c := gen_claim(); perform pg_temp.eq('T6 claim '||n, c is not null, true); perform ai_reserve(c->>'token', 10);
    update gen_jobs set lease_until = now() - interval '1 minute' where id=j;
    perform gen_maintain(); update gen_jobs set not_before = now() where id=j;
  end loop;
  perform pg_temp.eq('T6 failed', (select status from gen_jobs where id=j), 'failed');
  perform pg_temp.eq('T6 refunded', (select tokens from users where id=u), 56);
  perform pg_temp.eq('T6 ledger', (select returned = paid from gen_jobs where id=j), true);

  -- T7 insufficient / T8 cap / T13 one running per user
  update users set tokens = 5 where id=u;
  r := gen_start(stok, '{"topic":"x","count":10}'); perform pg_temp.eq('T7 insufficient', r->>'error', 'insufficient'); perform pg_temp.eq('T7 need', (r->>'need')::int, 10);
  perform pg_temp.eq('T7 no job', (select count(*)::int from gen_jobs where user_id=u and status in ('queued','running')), 0);
  update users set tokens = 100 where id=u;
  r := gen_start(stok, '{"topic":"الف","count":5}'); j := (r->>'id')::uuid;
  r := gen_start(stok, '{"topic":"ب","count":5}'); j2 := (r->>'id')::uuid;
  r := gen_start(stok, '{"topic":"پ","count":5}'); perform pg_temp.eq('T8 busy', r->>'error', 'busy');
  perform pg_temp.eq('T8 only two charged', (select tokens from users where id=u), 90);
  c := gen_claim(); perform pg_temp.eq('T13 first', (c->>'id')::uuid, j);
  perform pg_temp.eq('T13 second blocked while first runs', gen_claim() is null, true);
  perform ai_reserve(c->>'token', 5);
  r := gen_finish(j, (select jsonb_agg(e) from (select e from jsonb_array_elements(q) e limit 5) s), 'a', '', null);
  c := gen_claim(); perform pg_temp.eq('T13 second after first', (c->>'id')::uuid, j2);
  r := gen_fail(j2, 'x'); perform pg_temp.eq('T13 refund second', (select tokens from users where id=u), 95);

  -- T9 normal tokens pass through
  r := ai_reserve(stok, 3); perform pg_temp.eq('T9 reserve ok', r->>'ok', 'true'); perform pg_temp.eq('T9 charged', (select tokens from users where id=u), 92);
  perform pg_temp.eq('T9 refund', ai_refund(u, 3), 95);
  perform pg_temp.eq('T9 insufficient passthrough', ai_reserve(stok, 999)->>'error', 'insufficient');
  perform pg_temp.eq('T9 bad token', ai_reserve('zzz', 1)->>'error', 'no_session');
  perform pg_temp.eq('T9 fake job token', ai_reserve('gj_' || repeat('0', 64), 1)->>'error', 'no_session');
  perform pg_temp.eq('T9 malformed job token', ai_reserve('gj_x', 1)->>'error', 'no_session');

  -- T10 refund diversion is bounded by what is in flight
  r := gen_start(stok, '{"topic":"ز","count":10}'); j := (r->>'id')::uuid; c := gen_claim(); perform ai_reserve(c->>'token', 10);
  bal := ai_refund(u, 15);
  perform pg_temp.eq('T10 held', (select held from gen_jobs where id=j), 10);
  perform pg_temp.eq('T10 rest to user', (select tokens from users where id=u), 90);
  perform gen_fail(j, 'x'); perform pg_temp.eq('T10 after fail', (select tokens from users where id=u), 100);

  -- T12 shortfall is charged to the user on a retry (price went up)
  r := gen_start(stok, '{"topic":"س","count":10}'); j := (r->>'id')::uuid; c := gen_claim();
  r := ai_reserve(c->>'token', 12); perform pg_temp.eq('T12 ok', r->>'ok', 'true');
  perform pg_temp.eq('T12 extra 2', (select tokens from users where id=u), 88);
  perform pg_temp.eq('T12 paid', (select paid from gen_jobs where id=j), 12);
  update users set tokens = 0 where id=u;
  r := gen_fail(j, 'x'); perform pg_temp.eq('T12 refund 12', (select tokens from users where id=u), 12);

  -- T14 invalid questions => failed and refunded in full
  update users set tokens = 100 where id=u;
  r := gen_start(stok, '{"topic":"ش","count":3}'); j := (r->>'id')::uuid; c := gen_claim(); perform ai_reserve(c->>'token', 3);
  r := gen_finish(j, '[{"type":"mcq","text":"x","options":["a"],"correct":5}]'::jsonb, 't', '', null);
  perform pg_temp.eq('T14 failed', r->>'status', 'failed'); perform pg_temp.eq('T14 refund', (select tokens from users where id=u), 100);

  -- T15 bad input
  update ex_models set on_topic = false where id = 'neon';
  perform pg_temp.eq('T15 empty topic', gen_start(stok, '{"topic":"  ","count":3}')->>'error', 'topic');
  perform pg_temp.eq('T15 off model', gen_start(stok, '{"topic":"a","count":3,"ai":"neon"}')->>'error', 'model');
  perform pg_temp.eq('T15 unknown model', gen_start(stok, '{"topic":"a","count":3,"ai":"zzz"}')->>'error', 'model');
  perform pg_temp.eq('T15 bad session', gen_start(repeat('0',64), '{"topic":"a"}')->>'error', 'no_session');
  perform pg_temp.eq('T15 group', gen_start(stok, '{"topic":"a","count":3,"group":"nope"}')->>'error', 'group');
  r := gen_start(stok, '{"topic":"a","count":99999,"mode":"zz","level":"qq","dur_mode":"set","dur_min":9999}'); j := (r->>'id')::uuid;
  perform pg_temp.eq('T15 count clamped', (select q_count from gen_jobs where id=j), 30);
  perform pg_temp.eq('T15 mode default', (select params->>'mode' from gen_jobs where id=j), 'mixed');
  perform pg_temp.eq('T15 dur reset', (select params->>'dur_mode' from gen_jobs where id=j), 'none');
  perform gen_fail(j, 'x');

  -- status
  r := gen_start(stok, '{"topic":"وضعیت","count":2}'); j := (r->>'id')::uuid;
  r := gen_status(stok, null); perform pg_temp.eq('S1 list has active', jsonb_array_length(r->'jobs') >= 1, true);
  r := gen_status(stok, j::text); perform pg_temp.eq('S2 one', r->'jobs'->0->>'status', 'queued');
  perform pg_temp.eq('S3 other session sees nothing', gen_status(repeat('0',64), j::text)->>'error', 'no_session');
exception when others then raise;
end $$;
rollback;
PZGEN_TEST_END
OUT=$(su postgres -c "PGOPTIONS='-c client_min_messages=notice' psql -q -v ON_ERROR_STOP=1 -At -d $DB" < "$T/selftest.sql" 2>&1); RC=$?
NOK=$(printf '%s\n' "$OUT" | grep -c "ok   ")
if [ "$RC" = "0" ] && [ "$NOK" -ge 60 ]; then echo "  ok   money rules: $NOK checks passed (nothing was saved: the test is rolled back)"
else echo "  FAIL money rules self test:"; printf '%s\n' "$OUT" | grep -v "ok   " | head -8 | cut -c1-220; FAIL=1; fi

get() { grep -m1 "^$1=" "$ENVF" 2>/dev/null | cut -d= -f2- | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'; }
SK=$(get SUPABASE_SERVICE_ROLE_KEY); [ -n "$SK" ] || SK=$(get SERVICE_KEY); AK=$(get SUPABASE_ANON_KEY)
[ -n "$AK" ] || AK=$(sed -n 's/.*SUPABASE_ANON_KEY[" ]*[:=][ ]*["\x27]\([^"\x27]*\)["\x27].*/\1/p' "${PZ_WEB:-/var/www/pazmoonak}/config.js" 2>/dev/null | head -1)
call() { # key name json  -> prints "HTTP-code body"
  curl -sS -m 30 -o "$T/r.out" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" -H "Content-Type: application/json" -H "apikey: $1" -H "Authorization: Bearer $1" -d "$3" 2>&1 | tr -d '\n'; echo " $(head -c 200 "$T/r.out" 2>/dev/null)"
}
R=$(call "$SK" gen_maintain '{}'); case "$R" in 200*) echo "  ok   the service key can run the worker functions";; *) echo "  FAIL service key cannot call gen_maintain: $R"; FAIL=1;; esac
if [ -n "$AK" ]; then
  R=$(call "$AK" gen_claim '{}'); case "$R" in 2*) echo "  FAIL the public key can call worker functions (must not): $R"; FAIL=1;; *) echo "  ok   the public key cannot call worker functions";; esac
  R=$(call "$AK" ai_reserve '{"p_token":"x","p_amount":1}'); case "$R" in 2*) echo "  FAIL the public key can call ai_reserve (must not): $R"; FAIL=1;; *) echo "  ok   the public key cannot call ai_reserve";; esac
  R=$(call "$AK" gen_status '{"p_token":"x"}'); case "$R" in 200*no_session*) echo "  ok   the site can call gen_status (login is checked)";; *) echo "  FAIL gen_status through the public key: $R"; FAIL=1;; esac
else
  echo "  skip the site's public key was not found (config.js); public-key checks not run"
fi

# the real path: a throw-away user + a job with a job token -> the site's own AI function (node-api) -> the answer is saved by gen_finish
echo "  ... real test: one question from the AI through the live node-api (takes up to a minute)"
TU=$(node -e 'process.stdout.write(require("crypto").randomUUID())')
TK="gj_$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
TH=$(printf '%s' "$TK" | sha256sum | cut -d' ' -f1)
TP="0900$(node -e 'process.stdout.write(String(Math.floor(1e6+Math.random()*9e6)))')"
cleanup_test() { echo "delete from user_quizzes where user_id = '$TU'; delete from quizzes where creator_id = '$TU'; delete from users where id = '$TU';" | PSQL >/dev/null 2>&1; }
if echo "insert into users(id, phone, tokens) values ('$TU', '$TP', 5);" | PSQL >/dev/null 2>&1; then
  echo "insert into gen_jobs(id, user_id, status, params, q_count, unit, paid, held, tok_hash, attempts, lease_until, started_at)
    values ('$TU', '$TU', 'running', '{\"mode\":\"mcq\",\"level\":\"easy\",\"count\":1,\"topic\":\"جمع دو عدد\",\"ai\":\"ds\",\"dur_mode\":\"none\"}', 1, 1, 1, 1, '$TH', 1, now() + interval '5 minutes', now());" | PSQL >/dev/null 2>&1
  CODE=$(curl -sS -m 170 -o "$T/ai.out" -w "%{http_code}" -X POST "$API/functions/v1/node-api" -H "Content-Type: application/json" -H "apikey: $SK" -H "Authorization: Bearer $SK" \
    -d "{\"mode\":\"mcq\",\"difficulty\":\"easy\",\"count\":1,\"topic\":\"جمع دو عدد\",\"model\":\"deepseek\",\"ai\":\"ds\",\"token\":\"$TK\"}" 2>&1 | tr -d '\n')
  ST=$(echo "select held || '/' || inflight || '/' || (select tokens from users where id = '$TU') from gen_jobs where id = '$TU'" | PSQL 2>/dev/null)
  if [ "$CODE" = "200" ] && [ "$ST" = "0/1/5" ]; then
    echo "  ok   the live AI function accepted the job token and charged nothing extra"
    node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(JSON.stringify({p_job:process.argv[2],p_qs:d.questions,p_title:d.title||"",p_desc:d.description||"",p_dur:null}))' "$T/ai.out" "$TU" > "$T/fin.json" 2>/dev/null
    R=$(curl -sS -m 30 -X POST "$API/rest/v1/rpc/gen_finish" -H "Content-Type: application/json" -H "apikey: $SK" -H "Authorization: Bearer $SK" -d @"$T/fin.json")
    S2=$(echo "select status || '/' || (select count(*) from quizzes where creator_id = '$TU') || '/' || (select tokens from users where id = '$TU') from gen_jobs where id = '$TU'" | PSQL 2>/dev/null)
    if [ "$S2" = "done/1/5" ]; then echo "  ok   the finished exam was saved on the account and the balance is right"
    else echo "  FAIL saving the result: $R / $S2"; FAIL=1; fi
  else
    echo "  FAIL the live AI function did not take the job token: HTTP $CODE state $ST body: $(head -c 300 "$T/ai.out" 2>/dev/null)"; FAIL=1
  fi
  cleanup_test
else
  echo "  skip could not create a throw-away user (the users table needs other columns); the real test was not run. Build one small exam on the site as the final check."
fi
sleep 1
journalctl -u "$UNIT" -n 5 --no-pager 2>/dev/null | grep -qi "claim failed" && { echo "  FAIL the worker cannot reach the API:"; journalctl -u "$UNIT" -n 5 --no-pager | cut -c1-200; FAIL=1; } || echo "  ok   the worker is polling without errors"

echo "[6/6] result"
if [ "$FAIL" = "0" ]; then
  echo "DONE. Now upload app.js to GitHub and run pz-front."
else
  echo "FINISHED WITH PROBLEMS (see FAIL lines above). Do not upload the site files yet."
  echo "To go back to how it was:  bash $BK/undo.sh"
  exit 2
fi
echo "Logs:   journalctl -u $UNIT -f"
echo "Pause:  systemctl stop $UNIT   (queued jobs wait; nothing is lost)"
echo "Undo:   bash $BK/undo.sh"
