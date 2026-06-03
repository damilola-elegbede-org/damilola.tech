#!/usr/bin/env bash
# smoke-test-consulting.sh — post-merge go-live gate for /consulting (ENG-502)
#
# PRECONDITIONS: ENG-447 / ENG-210 / ENG-495 / ENG-500 must all be merged to
# main and the production (or preview) deployment must be live before running.
#
# Usage:
#   ./scripts/smoke-test-consulting.sh [BASE_URL]
#
# Examples:
#   ./scripts/smoke-test-consulting.sh
#   ./scripts/smoke-test-consulting.sh https://damilola.tech
#   BYPASS=<secret> ./scripts/smoke-test-consulting.sh https://preview-abc.vercel.app
#
# The Vercel deployment-protection bypass secret is read from the BYPASS env var
# (not a positional arg) to keep it out of the process table and shell history.
# In CI: env BYPASS=${{ secrets.VERCEL_BYPASS }} ./scripts/smoke-test-consulting.sh
#
# NOTE: The valid API submission test will fire a real POST /api/v1/contact and
# send a Telegram notification to D. This is intentional — it's an end-to-end
# live check. The payload is clearly labeled "[ENG-502 smoke test — ignore]".

set -euo pipefail

BASE_URL="${1:-https://damilola.tech}"
BYPASS="${BYPASS:-}"
BASE_URL="${BASE_URL%/}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
ERRORS=()

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASS++)) || true
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ERRORS+=("$1")
  ((FAIL++)) || true
}

section() {
  echo ""
  echo -e "${YELLOW}${BOLD}$1${NC}"
}

curl_base_args=(-s --max-time 15)
curl_headers=()
if [[ -n "$BYPASS" ]]; then
  curl_headers+=(-H "x-vercel-protection-bypass: $BYPASS")
fi

http_status() {
  curl "${curl_base_args[@]}" "${curl_headers[@]}" -o /dev/null -w "%{http_code}" "$1"
}

html_body() {
  curl "${curl_base_args[@]}" "${curl_headers[@]}" "$1"
}

post_json() {
  curl "${curl_base_args[@]}" "${curl_headers[@]}" \
    -X POST \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -d "$2" \
    "$1"
}

check_status() {
  local label="$1" url="$2" expected="${3:-200}"
  local actual
  actual=$(http_status "$url")
  if [[ "$actual" == "$expected" ]]; then
    pass "$label ($expected)"
  else
    fail "$label — expected $expected, got $actual ($url)"
  fi
}

check_contains() {
  local label="$1" url="$2" pattern="$3"
  local body
  body=$(html_body "$url")
  if echo "$body" | grep -q "$pattern"; then
    pass "$label"
  else
    fail "$label — pattern not found: '$pattern' in $url"
  fi
}

check_not_contains() {
  local label="$1" url="$2" pattern="$3"
  local body
  body=$(html_body "$url")
  if ! echo "$body" | grep -q "$pattern"; then
    pass "$label"
  else
    fail "$label — unexpected pattern found: '$pattern' in $url"
  fi
}

check_api() {
  local label="$1" url="$2" payload="$3" expected_status="$4"
  local response body status
  response=$(post_json "$url" "$payload")
  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)
  if [[ "$status" == "$expected_status" ]]; then
    pass "$label ($expected_status)"
  else
    fail "$label — expected $expected_status, got $status; body: $body"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} /consulting smoke test — ENG-502${NC}"
echo -e "  Target: $BASE_URL"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"

# ── 1. Page reachability ────────────────────────────────────────────────────

section "1. Page reachability"
check_status "/consulting" "$BASE_URL/consulting"
check_status "/projects/rate-limiting" "$BASE_URL/projects/rate-limiting"
check_status "sitemap.xml" "$BASE_URL/sitemap.xml"
check_status "robots.txt" "$BASE_URL/robots.txt"
check_status "OG image" "$BASE_URL/consulting/opengraph-image"

# ── 2. HTML content ─────────────────────────────────────────────────────────

section "2. HTML content"
check_contains "page title tag" "$BASE_URL/consulting" "Fractional VPE"
check_contains "hero headline" "$BASE_URL/consulting" "Engineering leadership"
check_contains "availability badge" "$BASE_URL/consulting" "Taking on 1"
check_contains '"Is this you?" section' "$BASE_URL/consulting" "Is this you"
check_contains '"How it works" section' "$BASE_URL/consulting" "How it works"
check_contains "Advisory service card" "$BASE_URL/consulting" "Strategic Engineering Guidance"
check_contains "Architecture Review service card" "$BASE_URL/consulting" "System Design Assessment"
check_contains "Team Building service card" "$BASE_URL/consulting" "Hiring &amp; Org Design"
check_contains "CTA section headline" "$BASE_URL/consulting" "Let"
check_contains "contact form name field" "$BASE_URL/consulting" "contact-name"
check_contains "contact form email field" "$BASE_URL/consulting" "contact-email"
check_contains "contact form message field" "$BASE_URL/consulting" "contact-message"
check_contains "send message button" "$BASE_URL/consulting" "Send message"

# ── 3. SEO metadata ─────────────────────────────────────────────────────────

section "3. SEO metadata"
check_contains "og:title" "$BASE_URL/consulting" 'og:title'
check_contains "og:description" "$BASE_URL/consulting" 'og:description'
check_contains "og:url points to /consulting" "$BASE_URL/consulting" 'damilola.tech/consulting'
check_contains "twitter:card" "$BASE_URL/consulting" 'twitter:card'
check_contains "/consulting in sitemap.xml" "$BASE_URL/sitemap.xml" '/consulting'
check_not_contains "/consulting not blocked in robots.txt" "$BASE_URL/robots.txt" 'Disallow: /consulting'

# ── 4. POST /api/v1/contact contract ────────────────────────────────────────

section "4. POST /api/v1/contact contract"

# NOTE: The valid submission below fires a real Telegram notification.
check_api \
  "valid payload → 201" \
  "$BASE_URL/api/v1/contact" \
  '{"name":"Remy Smoke Test","email":"remy+smoke-eng502@test.invalid","message":"[ENG-502 smoke test — ignore]"}' \
  "201"

check_api \
  "missing name → 400" \
  "$BASE_URL/api/v1/contact" \
  '{"name":"","email":"test@test.com","message":"Hello"}' \
  "400"

check_api \
  "missing message → 400" \
  "$BASE_URL/api/v1/contact" \
  '{"name":"Test","email":"test@test.com","message":""}' \
  "400"

check_api \
  "invalid email → 400" \
  "$BASE_URL/api/v1/contact" \
  '{"name":"Test","email":"not-an-email","message":"Hello"}' \
  "400"

check_api \
  "honeypot website field → 400" \
  "$BASE_URL/api/v1/contact" \
  '{"name":"Bot","email":"bot@spam.com","message":"spam","website":"http://spam.com"}' \
  "400"

# Confirm 201 response body contains confirmation but not submission contents.
raw=$(post_json "$BASE_URL/api/v1/contact" '{"name":"Remy Check","email":"remy+check@test.invalid","message":"[ENG-502 response-shape check]"}')
body=$(echo "$raw" | head -n -1)
if echo "$body" | grep -q '"success":true' && ! echo "$body" | grep -q '"name"'; then
  pass "201 body: success=true and no submission contents leaked"
else
  fail "201 body shape unexpected: $body"
fi

# ── 5. Rate-limiting case study ─────────────────────────────────────────────

section "5. Rate-limiting case study (ENG-495)"
check_contains "/projects/rate-limiting has h1" "$BASE_URL/projects/rate-limiting" '<h1'

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All $PASS checks passed.${NC}"
  echo -e "  ${GREEN}✅ /consulting is go-live ready.${NC}"
  echo ""
else
  echo -e "${RED}${BOLD}$FAIL check(s) failed, $PASS passed.${NC}"
  echo ""
  echo -e "${RED}Failed checks:${NC}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}•${NC} $err"
  done
  echo ""
  echo -e "  ${RED}❌ Do not promote to production until all checks pass.${NC}"
  exit 1
fi
