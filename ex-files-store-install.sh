#!/bin/bash
# Pazmoonak: store the ORIGINAL uploaded files of file-based exams in the database
# and show them (with download) on the exam's results page.
# Run as root:   bash ex-files-store-install.sh        Safe to run more than once.
# Needs ex-studio-install.sh to be installed already. Order: run this FIRST, then upload the new app.js and run pz-front.
set -u
DB="${PZ_DB:-pazmoonak}"
API="${PZ_API:-http://127.0.0.1:8787}"
RESTART="${PZ_RESTART:-systemctl restart pazmoonak}"
if [ -z "${PZ_PSQLCMD:-}" ]; then PZ_PSQLCMD="su postgres -c \"psql -q -v ON_ERROR_STOP=1 -At -d $DB\""; fi
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/files-store-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

echo "[1/4] checking database"
echo "select 1" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: cannot reach database $DB"; exit 1; }
echo "select 1 from file_job_images limit 0" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: run ex-studio-install.sh first"; exit 1; }
echo "OK"

cat > "$T/files-store.sql" <<'PZSQL_END'
-- پازمونک: ذخیره‌ی فایل‌های اصلی آزمون‌های «از روی فایل» و نمایش آن‌ها در صفحه‌ی نتایج.
-- بعد از studio.sql اجرا می‌شود. چندبار اجرا کردنش بی‌خطر است.
set client_min_messages = warning;
begin;

create table if not exists public.stored_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  mime text not null default 'application/octet-stream',
  size bigint not null,
  parts int not null,
  complete boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists stored_files_user_idx on public.stored_files(user_id, created_at desc);
create table if not exists public.stored_file_parts (
  file_id uuid not null references public.stored_files(id) on delete cascade,
  part int not null,
  data bytea not null,
  primary key (file_id, part)
);
create table if not exists public.quiz_files (
  quiz_id text not null references public.quizzes(id) on delete cascade,
  file_id uuid not null references public.stored_files(id) on delete cascade,
  pos int not null default 0,
  primary key (quiz_id, file_id)
);
alter table public.file_job_exams add column if not exists file_ids uuid[] not null default '{}';
revoke all on table public.stored_files, public.stored_file_parts, public.quiz_files from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table public.stored_files, public.stored_file_parts, public.quiz_files from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on table public.stored_files, public.stored_file_parts, public.quiz_files from authenticated; end if;
end $$;

-- ---------- آپلود فایل اصلی (تکه‌تکه) ----------
create or replace function public.sf_begin(p_token text, p_name text, p_mime text, p_size bigint, p_parts int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; fid uuid;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_size is null or p_size < 1 or p_parts is null or p_parts < 1 or p_parts > 100000 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  insert into stored_files(user_id, name, mime, size, parts)
  values (uid, left(coalesce(nullif(btrim(p_name), ''), 'file'), 200), left(coalesce(nullif(p_mime, ''), 'application/octet-stream'), 120), p_size, p_parts) returning id into fid;
  return jsonb_build_object('ok', true, 'id', fid);
end $$;

create or replace function public.sf_put(p_token text, p_file text, p_part int, p_data text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; f stored_files; n int; raw bytea;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select * into f from stored_files where id = fj_uuid(p_file) and user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_part is null or p_part < 0 or p_part >= f.parts then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_data is null or char_length(p_data) < 1 or char_length(p_data) > 2000000 or p_data !~ '^[A-Za-z0-9+/=]+$' then return jsonb_build_object('ok', false, 'error', 'bad_data'); end if;
  begin raw := decode(p_data, 'base64'); exception when others then return jsonb_build_object('ok', false, 'error', 'bad_data'); end;
  insert into stored_file_parts(file_id, part, data) values (f.id, p_part, raw) on conflict (file_id, part) do update set data = excluded.data;
  select count(*) into n from stored_file_parts where file_id = f.id;
  if n = f.parts then update stored_files set complete = true where id = f.id; end if;
  return jsonb_build_object('ok', true, 'complete', n = f.parts);
end $$;

-- ---------- فهرست و دانلود فایل‌های یک آزمون (فقط با رمز مدیریت آزمون، مثل صفحه‌ی نتایج) ----------
create or replace function public.quiz_files_list(p_id text, p_secret text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q quizzes%rowtype;
begin
  select * into q from quizzes where id = p_id;
  if q.id is null or q.admin_hash <> encode(sha256(convert_to(coalesce(p_secret, ''), 'utf8')), 'hex') then
    raise exception 'دسترسی نامعتبر';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'parts', f.parts) order by qf.pos)
    from quiz_files qf join stored_files f on f.id = qf.file_id where qf.quiz_id = p_id and f.complete), '[]'::jsonb);
end $$;

create or replace function public.quiz_file_part(p_id text, p_secret text, p_file text, p_part int)
returns text
language plpgsql stable security definer set search_path = public as $$
declare q quizzes%rowtype; d bytea;
begin
  select * into q from quizzes where id = p_id;
  if q.id is null or q.admin_hash <> encode(sha256(convert_to(coalesce(p_secret, ''), 'utf8')), 'hex') then
    raise exception 'دسترسی نامعتبر';
  end if;
  select p.data into d from stored_file_parts p join quiz_files qf on qf.file_id = p.file_id
  where qf.quiz_id = p_id and p.file_id = fj_uuid(p_file) and p.part = p_part;
  if d is null then raise exception 'فایل پیدا نشد'; end if;
  return replace(encode(d, 'base64'), E'\n', '');
end $$;

-- ---------- ساخت کار (حالا فایل‌های اصلی را هم به آزمون وصل می‌کند) ----------
create or replace function public.fj_create(p_token text, p_params jsonb, p_exams jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ai text; unit int; kind text; tp text; uid uuid; jid uuid; prm jsonb; e jsonb; c jsonb; i int := 0; cnt int; csum int; grp text; mode text; lvl text; dm text; dmin int;
  nopts int; lng text; ncalls int; fids uuid[]; nf int;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_exams is null or jsonb_typeof(p_exams) <> 'array' or jsonb_array_length(p_exams) < 1 or jsonb_array_length(p_exams) > 100 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if exists (select 1 from file_jobs where user_id = uid and status in ('queued', 'running')) then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  delete from file_jobs where user_id = uid and status = 'draft';

  kind := coalesce(p_params->>'kind', 'files'); if kind not in ('files', 'topic') then kind := 'files'; end if;
  tp := left(btrim(coalesce(p_params->>'topic', '')), 2000);
  if kind = 'topic' and char_length(tp) = 0 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  mode := coalesce(p_params->>'mode', 'mixed'); if mode not in ('tf', 'mcq', 'mixed') then mode := 'mixed'; end if;
  lvl := coalesce(p_params->>'level', 'medium'); if lvl not in ('easy', 'medium', 'hard') then lvl := 'medium'; end if;
  nopts := case when coalesce(p_params->>'opts', '') in ('3', '4', '5') then (p_params->>'opts')::int else 4 end;
  lng := coalesce(p_params->>'lang', 'auto'); if lng not in ('auto', 'fa', 'en') then lng := 'auto'; end if;
  dm := coalesce(p_params->>'dur_mode', 'none'); if dm not in ('none', 'auto', 'set') then dm := 'none'; end if;
  dmin := null;
  if dm = 'set' then
    if coalesce(p_params->>'dur_min', '') ~ '^[0-9]{1,3}$' then dmin := (p_params->>'dur_min')::int; end if;
    if dmin is null or dmin < 1 or dmin > 600 then dm := 'none'; dmin := null; end if;
  end if;
  grp := nullif(p_params->>'group', '');
  if grp is not null and not is_group_staff(uid, grp) then
    return jsonb_build_object('ok', false, 'error', 'group');
  end if;
  ai := coalesce(nullif(p_params->>'ai', ''), 'ds');
  if kind = 'topic' then
    select m.price into unit from ex_models m where m.id = ai and m.on_topic;
  else
    select coalesce(m.price_files, m.price) into unit from ex_models m where m.id = ai and m.on_files;
  end if;
  if unit is null then
    if ai = 'ds' then unit := case when kind = 'topic' then 1 else 2 end; else return jsonb_build_object('ok', false, 'error', 'model'); end if;
  end if;
  prm := jsonb_build_object(
    'kind', kind, 'topic', tp, 'mode', mode, 'level', lvl, 'opts', nopts, 'lang', lng,
    'focus', left(coalesce(p_params->>'focus', ''), 300),
    'notes', left(coalesce(p_params->>'notes', ''), 2000),
    'name', left(coalesce(p_params->>'name', ''), 120),
    'fallback', left(coalesce(nullif(p_params->>'fallback', ''), case when kind = 'topic' then left(tp, 80) else 'آزمون' end, 'آزمون'), 120),
    'group', grp, 'dur_mode', dm, 'dur_min', dmin,
    'by_file', coalesce(p_params->>'by_file', 'false') = 'true', 'ai', ai, 'unit', unit
  );

  insert into file_jobs(user_id, status, params, n_exams) values (uid, 'draft', prm, jsonb_array_length(p_exams)) returning id into jid;
  for e in select value from jsonb_array_elements(p_exams) loop
    i := i + 1;
    if jsonb_typeof(e) <> 'object' or coalesce(e->>'count', '') !~ '^[0-9]{1,3}$' then raise exception 'bad_request'; end if;
    cnt := (e->>'count')::int;
    if cnt < 1 or cnt > 300 then raise exception 'bad_request'; end if;
    if jsonb_typeof(e->'calls') <> 'array' then raise exception 'bad_request'; end if;
    ncalls := jsonb_array_length(e->'calls');
    if ncalls < 1 or ncalls > 24 then raise exception 'bad_request'; end if;
    fids := '{}';
    if e ? 'files' then
      if jsonb_typeof(e->'files') <> 'array' or jsonb_array_length(e->'files') > 500 then raise exception 'bad_request'; end if;
      select coalesce(array_agg(distinct fj_uuid(x)), '{}') into fids from jsonb_array_elements_text(e->'files') x;
      if array_position(fids, null) is not null then raise exception 'bad_request'; end if;
      select count(*) into nf from stored_files f where f.id = any(fids) and f.user_id = uid and f.complete;
      if nf <> coalesce(cardinality(fids), 0) then raise exception 'bad_request'; end if;
    end if;
    csum := 0;
    for c in select value from jsonb_array_elements(e->'calls') loop
      if jsonb_typeof(c) <> 'object' or coalesce(c->>'count', '') !~ '^[0-9]{1,2}$' or coalesce(c->>'parts', '') !~ '^[0-9]{1,2}$'
        or coalesce(c->>'imgs', '0') !~ '^[0-9]{1,3}$' then raise exception 'bad_request'; end if;
      if (c->>'count')::int < 1 or (c->>'count')::int > 25 then raise exception 'bad_request'; end if;
      if kind = 'topic' then
        if (c->>'parts')::int <> 0 or coalesce((c->>'imgs')::int, 0) <> 0 then raise exception 'bad_request'; end if;
      else
        if (c->>'parts')::int < 1 or (c->>'parts')::int > 40 then raise exception 'bad_request'; end if;
      end if;
      csum := csum + (c->>'count')::int;
    end loop;
    if csum <> cnt then raise exception 'bad_request'; end if;
    insert into file_job_exams(job_id, n, status, q_count, calls, file_name, file_ids)
    values (jid, i, 'draft', cnt,
      (select jsonb_agg(jsonb_build_object('count', (x->>'count')::int, 'parts', (x->>'parts')::int, 'imgs', coalesce((x->>'imgs')::int, 0)) order by o) from jsonb_array_elements(e->'calls') with ordinality t(x, o)),
      nullif(left(coalesce(e->>'file_name', ''), 120), ''), fids);
  end loop;
  return jsonb_build_object('ok', true, 'id', jid, 'unit', unit);
exception when others then
  if sqlerrm = 'bad_request' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  raise;
end $$;

create or replace function public.fj_finish(p_job uuid, p_n int, p_qs jsonb, p_title text, p_desc text, p_err text, p_dur int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ex file_job_exams; jb file_jobs; st text := 'fail'; msg text; qid text; secret text; got int := 0; kept int := 0; v_title text; grp text; fresh jsonb; hist jsonb; unit int;
begin
  select * into ex from file_job_exams where job_id = p_job and n = p_n for update;
  if not found or ex.status <> 'run' then return jsonb_build_object('ok', false, 'error', 'not_running'); end if;
  select * into jb from file_jobs where id = p_job for update;
  if p_qs is not null and jsonb_typeof(p_qs) = 'array' then got := jsonb_array_length(p_qs); end if;
  if got > 0 then
    begin
      if got > ex.q_count then raise exception 'too many questions'; end if;
      perform validate_questions(p_qs);
      v_title := left(trim(coalesce(nullif(trim(p_title), ''), nullif(jb.params->>'name', ''), nullif(jb.params->>'fallback', ''), 'آزمون')), 200);
      if char_length(v_title) = 0 then v_title := 'آزمون'; end if;
      grp := nullif(jb.params->>'group', '');
      if grp is not null and not is_group_staff(jb.user_id, grp) then raise exception 'گروه پیدا نشد یا شما مالک یا مدیر آن نیستید.'; end if;
      secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      qid := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into quizzes(id, title, description, questions, admin_hash, group_id, creator_id, duration_min)
      values (qid, v_title, left(coalesce(p_desc, ''), 2000), p_qs, encode(sha256(convert_to(secret, 'utf8')), 'hex'), grp, jb.user_id,
        case when p_dur between 1 and 600 then p_dur else null end);
      insert into user_quizzes(user_id, quiz_id, secret) values (jb.user_id, qid, secret)
      on conflict (user_id, quiz_id) do update set secret = excluded.secret;
      if grp is not null then perform group_sync_staff(grp, false); end if;
      insert into quiz_files(quiz_id, file_id, pos) select qid, x, o::int from unnest(ex.file_ids) with ordinality t(x, o) on conflict do nothing;
      st := 'ok'; kept := got;
    exception when others then
      st := 'fail'; kept := 0; qid := null;
      msg := 'ذخیره‌ی آزمون ناموفق بود: ' || left(sqlerrm, 200);
    end;
  else
    msg := coalesce(nullif(left(p_err, 300), ''), 'سؤالی ساخته نشد.');
  end if;
  unit := coalesce((jb.params->>'unit')::int, 1);
  if ex.charged - kept * unit > 0 then perform fj_refund(jb.user_id, ex.charged - kept * unit); end if;
  if st = 'ok' and kept < ex.q_count then msg := coalesce(nullif(left(p_err, 300), ''), 'تعداد سؤال کمتر از خواسته‌شده ساخته شد.'); end if;
  update file_job_exams set status = st, quiz_id = qid, q_got = kept, charged = kept * unit, qs = '[]'::jsonb, title = case when st = 'ok' then v_title else null end,
    partial = (st = 'ok' and kept < q_count), err = msg, done = jsonb_array_length(calls)
  where job_id = p_job and n = p_n;
  if st = 'ok' then
    select coalesce(jsonb_agg(left(q->>'text', 120)), '[]'::jsonb) into fresh from jsonb_array_elements(p_qs) q;
    select coalesce(jsonb_agg(v order by o), '[]'::jsonb) into hist
    from (select v, o from jsonb_array_elements(jb.avoid || fresh) with ordinality t(v, o) order by o desc limit 80) s;
    update file_jobs set spent = spent + kept * unit, avoid = hist, seen = false, updated_at = now() where id = p_job;
  else
    update file_jobs set updated_at = now(), seen = false where id = p_job;
  end if;
  perform fj_finalize_job(p_job);
  return jsonb_build_object('ok', true, 'status', st);
end $$;

create or replace function public.fj_maintain(p_stale int default 15, p_before timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; jr record;
begin
  update file_job_exams set status = 'wait' where status = 'run' and (started_at < now() - make_interval(mins => greatest(1, coalesce(p_stale, 15))) or started_at < p_before);
  get diagnostics a = row_count;
  for jr in select id from file_jobs where cancel_requested and status in ('queued', 'running') loop
    perform fj_cancel_waiting(jr.id);
    perform fj_finalize_job(jr.id);
  end loop;
  delete from file_jobs where status = 'draft' and updated_at < now() - interval '2 hours';
  get diagnostics b = row_count;
  delete from file_job_texts t using file_jobs j where j.id = t.job_id and j.status in ('done', 'cancelled') and j.finished_at < now() - interval '24 hours';
  get diagnostics c = row_count;
  delete from file_job_images t using file_jobs j where j.id = t.job_id and j.status in ('done', 'cancelled') and j.finished_at < now() - interval '24 hours';
  get diagnostics d = row_count;
  delete from file_jobs where status in ('done', 'cancelled') and finished_at < now() - interval '60 days';
  /* originals that no exam uses any more (failed, cancelled, abandoned, or the exam was deleted) are removed after 3 days */
  delete from stored_files f where f.created_at < now() - interval '3 days' and not exists (select 1 from quiz_files q where q.file_id = f.id);
  return jsonb_build_object('requeued', a, 'drafts', b, 'texts', c, 'images', d);
end $$;

revoke all on function public.sf_begin(text, text, text, bigint, int), public.sf_put(text, text, int, text), public.quiz_files_list(text, text), public.quiz_file_part(text, text, text, int) from public;
revoke all on function public.fj_create(text, jsonb, jsonb), public.fj_finish(uuid, int, jsonb, text, text, text, int), public.fj_maintain(int, timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.sf_begin(text, text, text, bigint, int), public.sf_put(text, text, int, text), public.quiz_files_list(text, text), public.quiz_file_part(text, text, text, int), public.fj_create(text, jsonb, jsonb) to anon;
    revoke all on function public.fj_finish(uuid, int, jsonb, text, text, text, int), public.fj_maintain(int, timestamptz) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.sf_begin(text, text, text, bigint, int), public.sf_put(text, text, int, text), public.quiz_files_list(text, text), public.quiz_file_part(text, text, text, int), public.fj_create(text, jsonb, jsonb) to authenticated;
    revoke all on function public.fj_finish(uuid, int, jsonb, text, text, text, int), public.fj_maintain(int, timestamptz) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fj_finish(uuid, int, jsonb, text, text, text, int), public.fj_maintain(int, timestamptz) to service_role;
  end if;
end $$;
commit;

PZSQL_END

echo "[2/4] backing up the current functions -> $BK"
echo "select string_agg(pg_get_functiondef(p.oid), E';\n\n') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('fj_create','fj_finish','fj_maintain')" | eval "$PZ_PSQLCMD" > "$BK/functions.sql"
echo "OK"

echo "[3/4] updating database"
eval "$PZ_PSQLCMD" < "$T/files-store.sql" >/dev/null || { echo "ERR: database step failed (it runs as one transaction, nothing was half-applied)."; exit 1; }
$RESTART
sleep 3
curl -fsS "$API/healthz" >/dev/null 2>&1 && echo "OK site service is up" || { echo "ERR: service did not come up"; exit 1; }

echo "[4/4] checking"
call() { curl -s -X POST -H 'content-type: application/json' -d "$2" "$API/rest/v1/rpc/$1"; }
TK=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
r=$(call sf_begin "{\"p_token\":\"$TK\",\"p_name\":\"x\",\"p_mime\":\"text/plain\",\"p_size\":1,\"p_parts\":1}"); case "$r" in *no_session*) echo "OK sf_begin answers";; *) echo "WARN sf_begin answered: $(echo "$r" | head -c 160)";; esac
r=$(call quiz_files_list '{"p_id":"zzzzzzzz","p_secret":"x"}'); [ -n "$r" ] && echo "OK quiz_files_list answers" || echo "WARN quiz_files_list gave no answer"
echo "select format('stored files: %s, linked to exams: %s', (select count(*) from stored_files), (select count(*) from quiz_files))" | eval "$PZ_PSQLCMD"
echo "Backup: $BK"
echo "DONE - now upload the new app.js to GitHub and run pz-front"
