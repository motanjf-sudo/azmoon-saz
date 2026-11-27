#!/bin/bash
# sec-harden.sh — backend hardening for Pazmoonak (frontend untouched).
# Each step: backup -> change -> check -> automatic rollback on failure. Safe to re-run.
# Usage: bash sec-harden.sh            (all steps)
#        STEPS="db api" bash sec-harden.sh     (choose: db api nginx systemd)
APP=${PZ_APP:-/opt/pazmoonak}; DB=${PZ_DB:-pazmoonak}; SVC=${PZ_SVC:-pazmoonak}; WSVC=${PZ_WSVC:-pazmoonak-files}
PORTN=${PZ_PORT:-8787}; NGX=${PZ_NGINX:-/etc/nginx}; STEPS=${STEPS:-db api nginx systemd}
TS=$(date +%Y%m%d-%H%M%S); BK=/root/pz-harden-$TS; REPORT=/root/pz-harden-report.txt
[ "$(id -u)" = 0 ] || { echo "ERR: run as root"; exit 1; }
mkdir -p "$BK"; chmod 700 "$BK"; : > "$REPORT"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
say(){ echo "$*" | tee -a "$REPORT"; }
ok(){ say "  OK   $*"; }; bad(){ say "  FAIL $*"; }; warn(){ say "  WARN $*"; }
PGP=${PZ_PGPORT:+PGPORT=$PZ_PGPORT }
PSQL(){ su postgres -c "${PGP}PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -At -d $DB"; }
health(){ for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS -m 3 "http://127.0.0.1:$PORTN/healthz" 2>/dev/null | grep -q '"ok":true' && return 0; sleep 2; done; return 1; }
has(){ case " $STEPS " in *" $1 "*) return 0;; esac; return 1; }

cat > "$W/admins.sql" <<'PZ_SQL_END'
-- Admin identity moves from a number hard-coded in a function to a table (read by is_admin). Safe to run more than once.
set client_min_messages = warning;
begin;
create table if not exists public.admins (
  phone text primary key check (phone ~ '^09[0-9]{9}$'),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from public, anon, authenticated;
do $$ declare src text; ph text; begin
  select prosrc into src from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace limit 1;
  for ph in select (regexp_matches(coalesce(src, ''), '''(09[0-9]{9})''', 'g'))[1] loop
    insert into public.admins(phone) values (ph) on conflict do nothing;
  end loop;
end $$;
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select p_uid is not null and exists (select 1 from users u join admins a on a.phone = u.phone where u.id = p_uid);
$$;
revoke all on function public.is_admin(uuid) from public, anon, authenticated;
commit;
PZ_SQL_END
cat > "$W/patch_server.py" <<'PZ_PY_END'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
if 'PZ-HARDEN' in s: print('already'); sys.exit(0)
n=0
# 1) limiter + security headers (before function send)
A="function send(res, status, obj, extra) {"
BLOCK='''/* PZ-HARDEN: per-IP request limit (service key exempt), security headers, no raw DB errors */
const RL = new Map();
const RL_RPC = Number(process.env.RL_RPC || 900), RL_FN = Number(process.env.RL_FN || 150);
function clientIp(req) { return String(req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '').slice(0, 64); }
function rateHit(key, limit) {
  const now = Date.now(); let e = RL.get(key);
  if (!e || now - e.t > 60000) { e = { t: now, n: 0 }; RL.set(key, e); }
  e.n++; return e.n > limit;
}
setInterval(() => { const now = Date.now(); for (const [k, e] of RL) if (now - e.t > 120000) RL.delete(k); }, 60000).unref();
Object.assign(CORS, { 'Strict-Transport-Security': 'max-age=15552000', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });

'''
if A in s: s=s.replace(A,BLOCK+A,1); n+=1
else: print('MISS limiter anchor')
# 2) apply limiter before rpc route
B="    let m = /^\\/rest\\/v1\\/rpc\\/([A-Za-z0-9_]+)$/.exec(p);"
C="    if (/^\\/(rest|functions)\\//.test(p) && !isService(req) && rateHit((p.startsWith('/rest') ? 'r:' : 'f:') + clientIp(req), p.startsWith('/rest') ? RL_RPC : RL_FN)) return send(res, 429, { message: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.' }, { 'Retry-After': '30' });\n"
if B in s: s=s.replace(B,C+B,1); n+=1
else: print('MISS route anchor')
# 3) mask raw DB errors
D="    if (code === 'P0001' || /^(22|23|42)/.test(code)) return { status: 400, body: { code, message: e.message } };"
E="    if (code === 'P0001') return { status: 400, body: { code, message: e.message } };\n    if (/^(22|23|42)/.test(code)) { console.error('rpc db error', name, code, String(e.message).slice(0, 200)); return { status: 400, body: { code, message: 'درخواست نامعتبر است.' } }; }"
if D in s: s=s.replace(D,E,1); n+=1
else: print('MISS error anchor')
if n==3: open(p,'w',encoding='utf-8').write(s); print('patched')
else: print('PARTIAL', n); sys.exit(2)
PZ_PY_END
cat > "$W/patch_nginx.py" <<'PZ_PY2_END'
import sys,os,re,glob
root=sys.argv[1]; log=[]
HSTS='add_header Strict-Transport-Security "max-age=15552000" always;'
def rd(p): return open(p,encoding='utf-8').read()
def wr(p,s): open(p,'w',encoding='utf-8').write(s)
# files: main + conf.d + sites-enabled (resolved)
files=[]
for pat in ('nginx.conf','conf.d/*.conf','sites-enabled/*','sites-available/*'):
    for f in glob.glob(os.path.join(root,pat)):
        r=os.path.realpath(f)
        if os.path.isfile(r) and r not in files and not r.endswith('options-ssl-nginx.conf'): files.append(r)
# 1) old TLS
for f in files:
    s=rd(f); n=re.sub(r'^(\s*)ssl_protocols\s+[^;]*TLSv1(?:\.1)?\b(?!\.[23])[^;]*;',r'\1ssl_protocols TLSv1.2 TLSv1.3;',s,flags=re.M)
    if n!=s: wr(f,n); log.append('tls: '+os.path.basename(f))
# 2) http-level extras in conf.d (only if not present anywhere)
allt='\n'.join(rd(f) for f in files)
extra=[]
if not re.search(r'^\s*server_tokens\s+off\s*;',allt,re.M): extra.append('server_tokens off;')
if 'zone=pz_conn' not in allt and not re.search(r'limit_conn_zone[^;]*\$binary_remote_addr[^;]*zone=pz_conn',allt): extra.append('limit_conn_zone $binary_remote_addr zone=pz_conn:10m;')
if not re.search(r'^\s*limit_conn_status',allt,re.M): extra.append('limit_conn_status 429;')
hp=os.path.join(root,'conf.d','pz-hardening.conf')
if extra and 'pz-hardening' not in allt.replace(hp,''):
    inc=re.search(r'include\s+[^;]*conf\.d/\*\.conf\s*;',rd(os.path.join(root,'nginx.conf')))
    if inc:
        os.makedirs(os.path.dirname(hp),exist_ok=True); wr(hp,'# Pazmoonak hardening (managed)\n'+'\n'.join(extra)+'\n'); log.append('http: '+', '.join(extra))
    else: log.append('SKIP http extras: nginx.conf does not include conf.d/*.conf')
# server blocks
def blocks(s,kw):
    out=[];i=0
    for m in re.finditer(r'(?m)^\s*'+kw+r'\s*(?:[^{;\n]*)\{',s):
        st=m.end();d=1;j=st
        while j<len(s) and d>0:
            if s[j]=='{':d+=1
            elif s[j]=='}':d-=1
            j+=1
        out.append((m.start(),m.end(),j-1))
    return out
use_conn='zone=pz_conn' in allt or any('limit_conn_zone' in x and 'pz_conn' in x for x in extra)
for f in files:
    if f.endswith('pz-hardening.conf'): continue
    s=rd(f); changed=False
    for (a,b,e) in reversed(blocks(s,'server')):
        body=s[b:e]
        if not re.search(r'listen\s+[^;]*(443|ssl)',body): continue
        add=''
        if use_conn and 'limit_conn pz_conn' not in body: add+='\n    limit_conn pz_conn 80;'
        static='proxy_pass' not in body and 'fastcgi_pass' not in body
        nb=body
        if static and 'Strict-Transport-Security' not in body:
            # location blocks that set their own add_header lose server-level headers: add there too
            for (la,lb,le) in reversed(blocks(nb,'location')):
                lbody=nb[lb:le]
                m=re.search(r'(?m)^(\s*)add_header\s[^;]*;',lbody)
                if m: nb=nb[:lb]+lbody[:m.end()]+'\n'+m.group(1)+HSTS+lbody[m.end():]+nb[le:]
            add+='\n    '+HSTS
        if add:
            m=re.search(r'(?m)^\s*server_name\s[^;]*;',nb)
            pos=m.end() if m else 0
            nb=nb[:pos]+add+nb[pos:]
            s=s[:b]+nb+s[e:]; changed=True
    if changed: wr(f,s); log.append('server blocks: '+os.path.basename(f))
print('\n'.join(log) if log else 'nothing to change')
PZ_PY2_END
chmod 644 "$W"/*

say "== Pazmoonak backend hardening $TS =="
say "backups in: $BK"

# ---------------- 1) database ----------------
if has db; then
  say "[1] database: admin identity -> table"
  if ! echo "select 1" | PSQL >/dev/null 2>&1; then bad "cannot reach database $DB (skipped)";
  else
    su postgres -c "${PGP}pg_dump -Fc -d $DB" > "$BK/db-before.dump" 2>/dev/null && [ -s "$BK/db-before.dump" ] && ok "db backup: $BK/db-before.dump" || warn "pg_dump backup failed"
    echo "select pg_get_functiondef(p.oid) from pg_proc p where proname='is_admin' and pronamespace='public'::regnamespace limit 1" | PSQL > "$BK/is_admin.before.sql" 2>/dev/null
    chmod 600 "$BK"/*
    cp "$W/admins.sql" /tmp/pz-admins.sql; chmod 644 /tmp/pz-admins.sql
    if su postgres -c "${PGP}psql -q -v ON_ERROR_STOP=1 -d $DB -f /tmp/pz-admins.sql" >/dev/null 2>"$W/sqlerr"; then
      N=$(echo "select count(*) from public.admins" | PSQL 2>/dev/null)
      if [ "${N:-0}" -ge 1 ] 2>/dev/null; then ok "admins table ready ($N admin) - is_admin no longer has a number inside"
      else
        bad "no admin found in table -> restoring old function"
        [ -s "$BK/is_admin.before.sql" ] && PSQL < "$BK/is_admin.before.sql" >/dev/null 2>&1 && ok "old is_admin restored"
      fi
    else bad "SQL failed (nothing changed): $(head -c 200 "$W/sqlerr")"; fi
    rm -f /tmp/pz-admins.sql
  fi
fi

# ---------------- 2) API server.js ----------------
if has api; then
  say "[2] API: rate limit + security headers + hide DB errors"
  if ! command -v python3 >/dev/null; then bad "python3 not found (skipped)";
  elif [ ! -f "$APP/server.js" ]; then bad "$APP/server.js not found";
  elif grep -q PZ-HARDEN "$APP/server.js"; then ok "already applied";
  else
    cp -p "$APP/server.js" "$BK/server.js.bak"
    cp "$APP/server.js" "$W/server.js"
    if python3 "$W/patch_server.py" "$W/server.js" >"$W/pyout" 2>&1; then
      cp "$W/server.js" "$W/check.js"
      if node --check "$W/check.js" 2>/dev/null; then
        cat "$W/server.js" > "$APP/server.js"; systemctl restart "$SVC"
        if health; then ok "API restarted and healthy"
        else
          bad "API unhealthy after patch -> rollback"; cat "$BK/server.js.bak" > "$APP/server.js"; systemctl restart "$SVC"
          health && ok "rollback done, API healthy" || bad "API still unhealthy: journalctl -u $SVC -n 30"
        fi
      else bad "syntax check failed (nothing changed)"; fi
    else bad "patch did not match the live file (nothing changed): $(tr '\n' ' ' < "$W/pyout" | head -c 200)"; fi
  fi
fi

# ---------------- 3) nginx ----------------
if has nginx; then
  say "[3] nginx: hide version, TLS1.2+, HSTS, per-IP connection cap"
  if ! command -v nginx >/dev/null || [ ! -d "$NGX" ]; then warn "nginx not found (skipped)";
  else
    cp -a "$NGX" "$BK/nginx.bak"
    if ! nginx -t -c "$NGX/nginx.conf" >/dev/null 2>&1; then bad "nginx config already invalid before changes (skipped)";
    else
      python3 "$W/patch_nginx.py" "$NGX" > "$W/ngout" 2>&1; sed 's/^/       /' "$W/ngout" | tee -a "$REPORT"
      if nginx -t -c "$NGX/nginx.conf" >"$W/ngt" 2>&1; then
        systemctl reload nginx && ok "nginx reloaded" || bad "reload failed"
      else
        bad "nginx -t failed -> rollback"; head -3 "$W/ngt" | tee -a "$REPORT"
        rm -rf "$NGX" && cp -a "$BK/nginx.bak" "$NGX" && nginx -t -c "$NGX/nginx.conf" >/dev/null 2>&1 && systemctl reload nginx && ok "nginx rolled back"
      fi
    fi
  fi
fi

# ---------------- 4) systemd sandbox ----------------
if has systemd; then
  say "[4] services: sandbox (less damage if a bug is exploited)"
  DROP='[Service]
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
RestrictNamespaces=yes
LockPersonality=yes
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallArchitectures=native
UMask=0077'
  for U in "$SVC" "$WSVC"; do
    systemctl cat "$U" >/dev/null 2>&1 || { warn "$U not found (skipped)"; continue; }
    D=/etc/systemd/system/$U.service.d; F=$D/10-pz-harden.conf
    if [ -f "$F" ]; then ok "$U already sandboxed"; continue; fi
    mkdir -p "$D"; printf '%s\n' "$DROP" > "$F"; systemctl daemon-reload; systemctl restart "$U"
    sleep 6
    GOOD=1; systemctl is-active --quiet "$U" || GOOD=0
    [ "$U" = "$SVC" ] && { health || GOOD=0; }
    if [ "$GOOD" = 1 ]; then ok "$U running inside sandbox"
    else bad "$U failed with sandbox -> rollback"; rm -f "$F"; rmdir "$D" 2>/dev/null; systemctl daemon-reload; systemctl restart "$U"; sleep 4
         systemctl is-active --quiet "$U" && ok "$U restored" || bad "$U not active: journalctl -u $U -n 30"; fi
  done
fi

say ""
say "== final check =="
health && ok "API /healthz" || bad "API /healthz"
for U in "$SVC" "$WSVC"; do systemctl is-active --quiet "$U" && ok "$U active" || bad "$U NOT active"; done
H=$(curl -sI -m 5 https://api.pazmoonak.com/healthz 2>/dev/null | tr -d '\r')
echo "$H" | grep -qi '^strict-transport-security' && ok "HSTS header live" || warn "HSTS not seen on api.pazmoonak.com"
echo "$H" | grep -qi '^server: nginx/' && warn "nginx version still visible" || ok "nginx version hidden"
say ""
say "report: $REPORT   backups: $BK"
say "undo: server.js -> cp $BK/server.js.bak $APP/server.js && systemctl restart $SVC ; nginx -> restore $BK/nginx.bak ; sandbox -> rm /etc/systemd/system/*.service.d/10-pz-harden.conf && systemctl daemon-reload && systemctl restart $SVC $WSVC"
