#!/bin/bash
# Pazmoonak: new pricing for exams built from FILES
#   - file processing: 1 pulak per 2 MB of each file (whole 2 MB steps only: 57.99 MB = 28 pulaks; under 2 MB = free)
#   - each question costs the same as in topic mode (the "price" column of ex_models)
#   - if no exam gets built, the file processing pulaks are refunded too
# Run as root:   bash ex-filefee-install.sh        Safe to run more than once. Does not touch users, secrets or settings.
# Needs ex-studio-install.sh and ex-files-store-install.sh to be installed already.
# Order: run this FIRST, then upload the new app.js to GitHub and run pz-front (the new app.js needs this database step).
set -u
DB="${PZ_DB:-pazmoonak}"
API="${PZ_API:-http://127.0.0.1:8787}"
RESTART="${PZ_RESTART:-systemctl restart pazmoonak}"
if [ -z "${PZ_PSQLCMD:-}" ]; then PZ_PSQLCMD="su postgres -c \"psql -q -v ON_ERROR_STOP=1 -At -d $DB\""; fi
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/filefee-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

echo "[1/4] checking database"
echo "select 1" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: cannot reach database $DB"; exit 1; }
echo "select 1 from stored_files limit 0" | eval "$PZ_PSQLCMD" >/dev/null 2>&1 || { echo "ERR: run ex-files-store-install.sh first"; exit 1; }
echo "OK"

cat > "$T/filefee.sql" <<'PZSQL_END'
-- پازمونک: قیمت‌گذاری ساخت آزمون از روی فایل
--   • هزینه‌ی پردازش فایل: هر ۲ مگابایتِ کامل = ۱ پولک (برای هر فایل، اعشار حساب نمی‌شود؛ ۵۷٫۹۹ مگابایت = ۲۸ پولک)
--   • قیمت هر سؤال: همان قیمت ساخت آزمون با موضوع (ستون price؛ ستون price_files دیگر استفاده نمی‌شود)
--   • اگر هیچ آزمونی ساخته نشود، هزینه‌ی پردازش فایل هم برمی‌گردد
-- چندبار اجرا کردنش بی‌خطر است.
set client_min_messages = warning;
begin;
alter table public.file_jobs add column if not exists fee_paid int not null default 0;

create or replace function public.fj_create(p_token text, p_params jsonb, p_exams jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ai text; unit int; kind text; tp text; uid uuid; jid uuid; prm jsonb; e jsonb; c jsonb; i int := 0; cnt int; csum int; grp text; mode text; lvl text; dm text; dmin int;
  nopts int; lng text; ncalls int; fids uuid[]; nf int; allf uuid[] := '{}'; fee int := 0;
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
  /* قیمت هر سؤال در هر دو حالت (موضوع و فایل) یکی است؛ هزینه‌ی پردازش فایل جدا حساب می‌شود (fee) */
  if kind = 'topic' then
    select m.price into unit from ex_models m where m.id = ai and m.on_topic;
  else
    select m.price into unit from ex_models m where m.id = ai and m.on_files;
  end if;
  if unit is null then
    if ai = 'ds' then unit := 1; else return jsonb_build_object('ok', false, 'error', 'model'); end if;
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
    if kind = 'files' and coalesce(cardinality(fids), 0) = 0 then raise exception 'no_files'; end if;
    allf := allf || fids;
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
  /* هزینه‌ی پردازش فایل: هر ۲ مگابایتِ کامل = ۱ پولک (برای هر فایل جدا، اعشار حساب نمی‌شود)؛ اندازه از خودِ بایت‌های ذخیره‌شده خوانده می‌شود */
  select coalesce(sum(z.sz / 2097152), 0)::int into fee
  from (select (select coalesce(sum(octet_length(p.data)), 0) from stored_file_parts p where p.file_id = d.f) as sz
        from (select distinct unnest(allf) as f) d) z;
  update file_jobs set params = params || jsonb_build_object('fee', fee) where id = jid;
  return jsonb_build_object('ok', true, 'id', jid, 'unit', unit, 'fee', fee);
exception when others then
  if sqlerrm = 'bad_request' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if sqlerrm = 'no_files' then return jsonb_build_object('ok', false, 'error', 'no_files'); end if;
  raise;
end $$;

create or replace function public.fj_start(p_token text, p_job text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; jid uuid; ex record; i int; cl jsonb; cntp int; len int; nimg int; total int; bal int; unit int; kind text; fee int; paid int; due int;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  jid := fj_uuid(p_job);
  perform 1 from file_jobs where id = jid and user_id = uid and status = 'draft' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if exists (select 1 from file_jobs where user_id = uid and status in ('queued', 'running')) then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  select coalesce(params->>'kind', 'files'), coalesce((params->>'unit')::int, 1) into kind, unit from file_jobs where id = jid;
  if kind <> 'topic' then
    for ex in select * from file_job_exams where job_id = jid order by n loop
      for i in 0 .. jsonb_array_length(ex.calls) - 1 loop
        cl := ex.calls->i;
        select count(*), coalesce(sum(char_length(body)), 0) into cntp, len from file_job_texts where job_id = jid and n = ex.n and call_i = i;
        select count(*) into nimg from file_job_images where job_id = jid and n = ex.n and call_i = i;
        if cntp <> (cl->>'parts')::int or nimg <> coalesce((cl->>'imgs')::int, 0) then return jsonb_build_object('ok', false, 'error', 'incomplete'); end if;
        if coalesce((cl->>'imgs')::int, 0) = 0 and len < 200 then return jsonb_build_object('ok', false, 'error', 'incomplete'); end if;
      end loop;
    end loop;
  end if;
  select sum(q_count) * unit into total from file_job_exams where job_id = jid;
  select coalesce((params->>'fee')::int, 0), fee_paid into fee, paid from file_jobs where id = jid;
  due := case when paid = 0 then fee else 0 end;   /* هزینه‌ی پردازش فایل یک بار گرفته می‌شود */
  total := total + due;
  bal := fj_charge(uid, total);
  if bal is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'tokens', coalesce((select tokens from users where id = uid), 0), 'need', total);
  end if;
  update file_job_exams set status = 'wait', charged = q_count * unit where job_id = jid;
  update file_jobs set status = 'queued', started_at = now(), updated_at = now(), seen = false, fee_paid = paid + due, spent = spent + due where id = jid;
  return jsonb_build_object('ok', true, 'id', jid, 'tokens', bal, 'total', total, 'fee', due);
end $$;

create or replace function public.fj_retry(p_token text, p_job text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; jid uuid; total int; bal int; unit int; kind text; fee int; paid int; due int;
begin
  uid := session_uid(p_token);
  if uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  jid := fj_uuid(p_job);
  perform 1 from file_jobs where id = jid and user_id = uid and status in ('done', 'cancelled') for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if exists (select 1 from file_jobs where user_id = uid and status in ('queued', 'running')) then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  select coalesce(params->>'kind', 'files'), coalesce((params->>'unit')::int, 1) into kind, unit from file_jobs where id = jid;
  select coalesce(sum(q_count), 0) into total from file_job_exams where job_id = jid and status in ('fail', 'cancelled');
  if total = 0 then return jsonb_build_object('ok', false, 'error', 'nothing'); end if;
  total := total * unit;
  select coalesce((params->>'fee')::int, 0), fee_paid into fee, paid from file_jobs where id = jid;
  due := case when paid = 0 then fee else 0 end;   /* اگر هزینه‌ی پردازش فایل قبلاً برگشت خورده بود، دوباره گرفته می‌شود */
  total := total + due;
  if kind <> 'topic' and exists (
    select 1 from file_job_exams e where e.job_id = jid and e.status in ('fail', 'cancelled')
      and ((select count(distinct t.call_i) from file_job_texts t where t.job_id = jid and t.n = e.n) <> jsonb_array_length(e.calls)
        or (select count(*) from file_job_images i where i.job_id = jid and i.n = e.n) <> (select coalesce(sum((c->>'imgs')::int), 0) from jsonb_array_elements(e.calls) c))
  ) then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  bal := fj_charge(uid, total);
  if bal is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'tokens', coalesce((select tokens from users where id = uid), 0), 'need', total);
  end if;
  update file_job_exams set status = 'wait', charged = q_count * unit, err = null, qs = '[]'::jsonb, done = 0, q_got = 0, partial = false, title = null
  where job_id = jid and status in ('fail', 'cancelled');
  update file_jobs set status = 'queued', cancel_requested = false, finished_at = null, seen = false, updated_at = now(), fee_paid = paid + due, spent = spent + due where id = jid;
  return jsonb_build_object('ok', true, 'tokens', bal, 'total', total);
end $$;

create or replace function public.fj_finalize_job(p_job uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare jb file_jobs;
begin
  if not exists (select 1 from file_job_exams where job_id = p_job and status in ('wait', 'run')) then
    update file_jobs set status = case when cancel_requested then 'cancelled' else 'done' end, finished_at = now(), updated_at = now(), seen = false
    where id = p_job and status in ('queued', 'running') returning * into jb;
    /* اگر هیچ آزمونی ساخته نشد، هزینه‌ی پردازش فایل هم برمی‌گردد */
    if found and jb.fee_paid > 0 and not exists (select 1 from file_job_exams where job_id = p_job and status = 'ok') then
      perform fj_refund(jb.user_id, jb.fee_paid);
      update file_jobs set spent = greatest(0, spent - jb.fee_paid), fee_paid = 0 where id = p_job;
    end if;
  end if;
end $$;

commit;
PZSQL_END

echo "[2/4] backing up the current functions -> $BK"
echo "select string_agg(pg_get_functiondef(p.oid), E';\n\n') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('fj_create','fj_start','fj_retry','fj_finalize_job')" | eval "$PZ_PSQLCMD" > "$BK/functions.sql"
echo "OK"

echo "[3/4] updating database"
eval "$PZ_PSQLCMD" < "$T/filefee.sql" >/dev/null || { echo "ERR: database step failed (it runs as one transaction, nothing was half-applied)."; exit 1; }
$RESTART
sleep 3
curl -fsS "$API/healthz" >/dev/null 2>&1 && echo "OK site service is up" || { echo "ERR: service did not come up"; exit 1; }

echo "[4/4] checking"
call() { curl -s -X POST -H 'content-type: application/json' -d "$2" "$API/rest/v1/rpc/$1"; }
TK=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
r=$(call fj_create "{\"p_token\":\"$TK\",\"p_params\":{\"kind\":\"files\"},\"p_exams\":[]}"); case "$r" in *no_session*) echo "OK fj_create answers";; *) echo "WARN fj_create answered: $(echo "$r" | head -c 160)";; esac
echo "select format('column fee_paid: %s', (select count(*) from information_schema.columns where table_name='file_jobs' and column_name='fee_paid'))" | eval "$PZ_PSQLCMD"
echo "select format('%-7s question price (topic and files): %s', id, price) from ex_models where on_files order by sort" | eval "$PZ_PSQLCMD"
echo "Backup: $BK"
echo "DONE - now upload the new app.js to GitHub and run pz-front"
