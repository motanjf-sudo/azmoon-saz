#!/bin/bash
# Pazmoonak security check (READ-ONLY). Changes nothing, prints no passwords/keys.
# Run as root:  bash sec-audit.sh        Full report is also saved to /root/pz-sec-report.txt
APP="${PZ_APP:-/opt/pazmoonak}"; DB="${PZ_DB:-pazmoonak}"; ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
OUT=/root/pz-sec-report.txt; [ -w /root ] || OUT=/tmp/pz-sec-report.txt
PSQL() { if [ -n "${PZ_PSQL:-}" ]; then $PZ_PSQL -At -c "$1" 2>/dev/null; else su postgres -c "psql -At -d $DB" <<<"$1" 2>/dev/null; fi; }
ok(){ echo "OK   $*"; }; warn(){ echo "WARN $*"; }; bad(){ echo "BAD  $*"; }; inf(){ echo "INFO $*"; }
{
echo "== pazmoonak security check $(date '+%F %H:%M') =="
# --- system
. /etc/os-release 2>/dev/null; inf "os: ${PRETTY_NAME:-?} kernel $(uname -r)"
U=$(apt list --upgradable 2>/dev/null | grep -c security); A=$(apt list --upgradable 2>/dev/null | grep -vc Listing)
[ "${U:-0}" -gt 0 ] && warn "security updates pending: $U (all upgradable: $A)" || ok "no pending security updates (upgradable: $A)"
dpkg -s unattended-upgrades >/dev/null 2>&1 && ok "unattended-upgrades installed" || warn "unattended-upgrades not installed"
inf "node: $(node -v 2>/dev/null)  nginx: $(nginx -v 2>&1 | sed 's/.*\///')  postgres: $(PSQL 'show server_version' | cut -d' ' -f1)"
# --- ssh
if command -v sshd >/dev/null; then
  S=$(sshd -T 2>/dev/null)
  P=$(echo "$S" | awk '/^port /{print $2}' | xargs); inf "ssh port: $P"
  R=$(echo "$S" | awk '/^permitrootlogin /{print $2}'); PA=$(echo "$S" | awk '/^passwordauthentication /{print $2}')
  [ "$R" = "yes" ] && warn "ssh root login: yes" || ok "ssh root login: $R"
  [ "$PA" = "yes" ] && warn "ssh password login: yes" || ok "ssh password login: $PA"
  K=$(cat /root/.ssh/authorized_keys 2>/dev/null | grep -c '^ssh-\|^ecdsa-'); inf "root ssh keys: $K"
  F=$(journalctl --since "-24h" -q 2>/dev/null | grep -cE "Failed password|Invalid user|authentication failure"); [ "${F:-0}" -gt 50 ] && warn "failed ssh logins (24h): $F" || inf "failed ssh logins (24h): $F"
fi
systemctl is-active --quiet fail2ban && ok "fail2ban active" || warn "fail2ban not active"
# --- firewall + open ports
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then ok "ufw active: $(ufw status | grep -c ALLOW) allow rules"; else
  NR=$(nft list ruleset 2>/dev/null | grep -cE "drop|reject"); IR=$(iptables -S 2>/dev/null | grep -cE "DROP|REJECT"); [ $((NR+IR)) -gt 0 ] && inf "firewall rules (nft/iptables drop): $NR/$IR" || warn "no host firewall rules"; fi
ss -Htlnp 2>/dev/null | awk '{print $4" "$6}' | while read a p; do case "$a" in 127.*|"[::1]"*|::1*) ;; *) n=$(echo "$p" | sed -E 's/.*\(\("([^"]+)".*/\1/'); port=${a##*:}; case "$port" in 22|80|443) inf "public port $port ($n)";; *) warn "public port $port ($n)";; esac;; esac; done
# --- postgres
LA=$(PSQL "show listen_addresses"); case "$LA" in localhost|127.0.0.1|"127.0.0.1,::1"|"localhost,127.0.0.1") ok "postgres listens on: $LA";; *) warn "postgres listens on: $LA";; esac
HBA=$(PSQL "select count(*) from pg_hba_file_rules where type like 'host%' and address is not null and address not in ('127.0.0.1','::1') and coalesce(netmask,'') not in ('255.255.255.255','ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')"); [ "${HBA:-0}" = 0 ] && ok "pg_hba: no remote host rules" || warn "pg_hba remote rules: $HBA"
DU=$(grep -m1 '^DATABASE_URL=' "$ENVF" 2>/dev/null | sed -E 's#^DATABASE_URL=["'"'"']?[a-z]+://([^:@/]+).*#\1#')
SU=$(PSQL "select rolsuper from pg_roles where rolname='${DU//\'/}'")
if [ -z "$DU" ]; then inf "app DB user: unknown (DATABASE_URL not read)"; elif [ "$SU" = "t" ]; then bad "app connects to DB as SUPERUSER ($DU)"; else ok "app DB user is not superuser ($DU)"; fi
inf "superuser roles: $(PSQL "select string_agg(rolname, ',') from pg_roles where rolsuper")"
# --- database privileges
T=$(PSQL "select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m','S') and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))")
[ -z "$T" ] && ok "anon has no direct table access" || bad "anon can read/write tables: $T"
NA=$(PSQL "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute')")
NT=$(PSQL "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")
inf "functions callable from the internet (anon): $NA of $NT"
RISK=$(PSQL "select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('fj_create','fj_put','fj_put_image','fj_start','fj_status','fj_cancel','fj_retry','fj_seen','sf_begin','sf_put','quiz_start','group_set_role') and p.proname ~ '(credit|refund|reserve|charge|_issue|_verify|consume|_due|attach|_fail|_maintain|finalize|sync_|_set_|grant|_put|_begin|_finish|_start|_retry|^ai_|^pay_|^fj_|^sf_|^otp|session_|is_admin|group_role|quiz_access|validate)'")
[ -z "$RISK" ] && ok "no sensitive-looking function is open to anon" || warn "check these anon-callable functions: $RISK"
ND=$(PSQL "select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')")
[ -z "$ND" ] && ok "all SECURITY DEFINER functions pin search_path" || bad "SECURITY DEFINER without search_path: $ND"
PUBX=$(PSQL "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))")
[ "${PUBX:-0}" = 0 ] && ok "no SECURITY DEFINER function is executable by PUBLIC" || warn "SECURITY DEFINER functions executable by PUBLIC: $PUBX"
ADM=$(PSQL "select prosrc from pg_proc where proname='is_admin' limit 1" | grep -cE "09[0-9]{9}"); [ "${ADM:-0}" -gt 0 ] && warn "is_admin() uses a hard-coded phone number" || inf "is_admin(): no hard-coded phone"
inf "users: $(PSQL 'select count(*) from users')  new 24h: $(PSQL "select count(*) from users where created_at > now()-interval '1 day'")  active sessions: $(PSQL 'select count(*) from user_sessions where expires_at > now()')"
inf "otp sends 24h (phones): $(PSQL "select count(*) from auth_otps where sent_at > now()-interval '1 day'")"
# --- nginx
NT2=$(nginx -T 2>/dev/null)
echo "$NT2" | grep -qE "^\s*server_tokens\s+off" && ok "nginx hides version" || warn "nginx shows its version (server_tokens)"
LR=$(echo "$NT2" | grep -cE "^\s*limit_req\s"); [ "${LR:-0}" -gt 0 ] && ok "nginx limit_req rules: $LR" || bad "nginx has no rate limiting (limit_req)"
echo "$NT2" | grep -qE "^\s*limit_conn\s" && ok "nginx limit_conn present" || warn "no limit_conn"
echo "$NT2" | grep -qi "Strict-Transport-Security" && ok "HSTS header present" || warn "no HSTS header"
inf "client_max_body_size: $(echo "$NT2" | grep -oE "client_max_body_size\s+[^;]+" | awk '{print $2}' | sort -u | xargs)"
SP=$(echo "$NT2" | grep -oE "ssl_protocols\s+[^;]+" | sed 's/ssl_protocols//' | sort -u | xargs); echo "$SP" | grep -qE "TLSv1(\.1)?( |$)" && warn "old TLS allowed: $SP" || inf "ssl_protocols: $SP"
echo "$NT2" | grep -oE "ssl_certificate\s+[^;]+" | awk '{print $2}' | sort -u | while read c; do e=$(openssl x509 -enddate -noout -in "$c" 2>/dev/null | cut -d= -f2); [ -n "$e" ] && d=$(( ($(date -d "$e" +%s) - $(date +%s)) / 86400 )) && { [ $d -lt 15 ] && warn "cert $c expires in $d days" || ok "cert $(basename $(dirname $c)) valid $d days"; }; done
inf "server names: $(echo "$NT2" | grep -oE "server_name\s+[^;]+" | sed 's/server_name//' | sort -u | xargs)"
echo "$NT2" | grep -qE "proxy_set_header\s+X-Real-IP" && ok "api gets real client IP (X-Real-IP)" || warn "api does not get X-Real-IP"
# --- services
for s in pazmoonak pazmoonak-files; do us=$(systemctl show -p User --value $s 2>/dev/null); [ -z "$us" ] || [ "$us" = root ] && warn "service $s runs as root" || ok "service $s runs as $us"
  sc=$(systemd-analyze security $s --no-pager 2>/dev/null | tail -1 | grep -oE "[0-9]+\.[0-9]+ [A-Z_]+"); [ -n "$sc" ] && inf "  systemd exposure $s: $sc"; done
# --- files
for f in "$ENVF" /etc/pazmoonak/google-sa.json; do [ -e "$f" ] && { m=$(stat -c '%a %U' "$f"); case "$m" in "600 root"|"400 root"|"640 root") ok "$f perms $m";; *) warn "$f perms $m (should be 600 root)";; esac; }; done
WW=$(find "$APP" /var/www -xdev -type f -perm -0002 2>/dev/null | wc -l); [ "$WW" = 0 ] && ok "no world-writable files in app/site" || warn "world-writable files: $WW"
inf "app owner: $(stat -c '%U %a' "$APP" 2>/dev/null)  server.js md5: $(md5sum "$APP/server.js" 2>/dev/null | cut -c1-8)"
grep -qE "limitHit|rateLimit|RATE_" "$APP/server.js" 2>/dev/null && inf "server.js has its own rate limit" || inf "server.js has no own rate limit"
# --- backups
BK=$( (crontab -l 2>/dev/null; cat /etc/cron.d/* /etc/cron.daily/* 2>/dev/null; systemctl list-timers --all --no-pager 2>/dev/null) | grep -ciE "pg_dump|backup")
[ "${BK:-0}" -gt 0 ] && inf "backup jobs found: $BK" || bad "no database backup job found"
LB=$(find / -xdev \( -name "*.dump" -o -name "*.sql.gz" -o -name "*pazmoonak*.sql*" -o -name "*.backup" \) -mtime -3 2>/dev/null | grep -v "^/proc" | head -3 | xargs); [ -n "$LB" ] && inf "recent backup files: $LB" || warn "no backup file newer than 3 days found"
# --- secrets in code
SC=$(grep -rlE "(pplx-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})" "$APP" /var/www 2>/dev/null | grep -v node_modules | head -3 | xargs); [ -z "$SC" ] && ok "no API keys inside code/site files" || bad "API key inside files: $SC"
echo "== done =="
} 2>/dev/null | tee "$OUT"
echo "(saved: $OUT)"
