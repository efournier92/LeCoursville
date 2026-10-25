#!/bin/bash
# Email health check for eric@lecoursville.com.
#
# Read-only. No credentials, no writes, no project access.
# Usage: bash scripts/email-healthcheck.sh      (or npm run email-healthcheck)
# Exit 0 = every automated check passed. Exit 1 = something needs attention.
#
# The manual half of the routine cannot be automated: Zoho Mail Free has no IMAP
# or forwarding, so nothing outside a browser can sign in or confirm delivery.
# Those items are printed at the end.

set -u

DOMAIN=${EMAIL_DOMAIN:-lecoursville.com}
NS=${EMAIL_NS:-ns03.domaincontrol.com}
PUBLIC=${EMAIL_PUBLIC_RESOLVER:-1.1.1.1}

fails=0
warns=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; warns=$((warns + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }
info() { printf 'INFO  %s\n' "$1"; }

if ! command -v dig >/dev/null 2>&1; then
  echo "FAIL  dig not found. Install bind-utils or run on macOS."
  exit 1
fi

# Quote-stripped, one record per line.
txt() { dig +short TXT "$1" "@$2" 2>/dev/null | sed 's/"//g'; }
# Chunks of one record joined, for values longer than 255 characters.
txt_joined() { dig +short TXT "$1" "@$2" 2>/dev/null | sed 's/" "//g; s/"//g'; }

echo "Email health: $DOMAIN"
echo

# 1. Apex MX
mx=$(dig +short MX "$DOMAIN" "@$NS" 2>/dev/null)
if [ -z "$mx" ]; then
  fail "no MX at $DOMAIN, inbound mail cannot be delivered"
else
  for rec in "10 mx.zoho.com." "20 mx2.zoho.com." "50 mx3.zoho.com."; do
    if printf '%s\n' "$mx" | grep -Fxq "$rec"; then
      pass "MX $rec"
    else
      fail "MX missing: $rec"
    fi
  done
  mx_count=$(printf '%s\n' "$mx" | grep -c .)
  [ "$mx_count" -eq 3 ] || warn "MX count is $mx_count, expected 3"
fi

# 2. Apex SPF
apex_txt=$(txt "$DOMAIN" "$NS")
spf_count=$(printf '%s\n' "$apex_txt" | grep -c '^v=spf1')
if [ "$spf_count" -eq 0 ]; then
  fail "no SPF record at apex"
elif [ "$spf_count" -gt 1 ]; then
  fail "$spf_count SPF records at apex, exactly one is required"
else
  spf=$(printf '%s\n' "$apex_txt" | grep '^v=spf1')
  case "$spf" in
    *include:_spf.firebasemail.com*) pass "SPF keeps the Firebase include" ;;
    *) fail "SPF lost include:_spf.firebasemail.com, app auth mail will fail" ;;
  esac
  case "$spf" in
    *include:zohomail.com*) pass "SPF authorizes Zoho" ;;
    *) fail "SPF missing include:zohomail.com, outbound from Zoho fails" ;;
  esac
fi

# 3. Zoho verification record
if printf '%s\n' "$apex_txt" | grep -q '^zoho-verification='; then
  pass "Zoho domain verification record present"
else
  warn "zoho-verification TXT missing, Zoho may revert the domain to unverified"
fi

# 4. DKIM
dkim=$(txt_joined "zoho._domainkey.$DOMAIN" "$NS")
if [ -z "$dkim" ]; then
  fail "DKIM record zoho._domainkey missing"
else
  case "$dkim" in
    "v=DKIM1; k=rsa; p="*) pass "DKIM record is a DKIM1 RSA key" ;;
    *) fail "DKIM record present but not a DKIM1 RSA key" ;;
  esac
  dkim_len=${#dkim}
  if [ "$dkim_len" -ge 400 ]; then
    pass "DKIM value $dkim_len chars (2048-bit)"
  elif [ "$dkim_len" -ge 200 ]; then
    warn "DKIM value $dkim_len chars looks 1024-bit, expected about 410"
  else
    fail "DKIM value only $dkim_len chars, likely truncated by the registrar"
  fi
fi

# 5. DMARC
dmarc=$(txt "_dmarc.$DOMAIN" "$NS")
if [ -z "$dmarc" ]; then
  fail "no DMARC record at _dmarc"
else
  case "$dmarc" in
    *v=DMARC1*) pass "DMARC record present" ;;
    *) fail "DMARC record present but not v=DMARC1" ;;
  esac
  case "$dmarc" in
    *p=quarantine*) pass "DMARC policy is quarantine" ;;
    *p=reject*) pass "DMARC policy is reject" ;;
    *p=none*) info "DMARC policy is p=none, spec step Z16 has not run" ;;
  esac
fi

# 6. Resend transactional path must stay untouched
resend_dkim=$(txt "resend._domainkey.auth.$DOMAIN" "$NS")
if [ -n "$resend_dkim" ]; then
  pass "Resend DKIM on auth subdomain present"
else
  fail "Resend DKIM on auth subdomain missing, app mail will lose DKIM"
fi

send_mx=$(dig +short MX "send.auth.$DOMAIN" "@$NS" 2>/dev/null)
if printf '%s\n' "$send_mx" | grep -q 'forge.rmta.net'; then
  pass "Resend return-path MX present"
else
  fail "Resend return-path MX on send.auth missing"
fi

for cname in send.auth rsend.auth; do
  target=$(dig +short CNAME "$cname.$DOMAIN" "@$NS" 2>/dev/null)
  if printf '%s\n' "$target" | grep -q 'forge.rmta.net'; then
    pass "CNAME $cname.$DOMAIN resolves"
  else
    fail "CNAME $cname.$DOMAIN missing or changed"
  fi
done

# 7. Authoritative versus public resolver agreement
pub_mx=$(dig +short MX "$DOMAIN" "@$PUBLIC" 2>/dev/null)
if [ "$(printf '%s' "$mx" | sort)" != "$(printf '%s' "$pub_mx" | sort)" ]; then
  warn "public resolver view of MX differs from authoritative, retry in an hour before acting"
fi

echo
echo "Manual, cannot be automated:"
echo "  1. Sign in at https://mail.zoho.com as eric@. Resets the idle clock."
echo "  2. Request a password reset for canary@ from the app, confirm it arrives."
echo "  3. Scan eric@ for an owner alert that should have arrived."
echo

if [ "$fails" -gt 0 ]; then
  echo "RESULT: $fails failing, $warns warning(s). Needs attention."
  exit 1
fi
if [ "$warns" -gt 0 ]; then
  echo "RESULT: healthy, $warns warning."
  exit 0
fi
echo "RESULT: healthy."
exit 0
