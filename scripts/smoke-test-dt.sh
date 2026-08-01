#!/usr/bin/env bash
# Post-merge production smoke test for damilola.tech
# Usage: bash scripts/smoke-test-dt.sh [BASE_URL]
# Default BASE_URL: https://www.damilola.tech
# Exits 0 if all checks pass, 1 if any fail.

set -euo pipefail

BASE_URL="${1:-https://www.damilola.tech}"
PASS=0
FAIL=0

# Response bodies land in a private directory, not predictable /tmp paths: a
# local attacker could pre-create /tmp/dt-*.json as a symlink and redirect
# curl's output into another writable file. Removed on any exit.
SMOKE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/dt-smoke.XXXXXX")"
trap 'rm -rf "$SMOKE_TMP"' EXIT

# Extract <loc> values with a real XML parser. A line-based regex silently skips
# elements that span lines or carry a namespace prefix, and leaves entities like
# &amp; unescaped — either of which would let this check pass while not actually
# checking every URL, which is the exact failure it exists to catch.
extract_sitemap_locs() {
  python3 - "$SMOKE_TMP/sitemap.xml" <<'PYEOF'
import sys, xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception as e:
    print(f"SITEMAP_PARSE_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
for el in root.iter():
    # Strip any namespace: '{http://...}loc' -> 'loc'
    if el.tag.rsplit('}', 1)[-1] == 'loc' and el.text:
        print(el.text.strip())
PYEOF
}

CURL_TIMEOUT_OPTS=(--connect-timeout 5 --max-time 15)

check() {
  local label="$1"
  local result="$2"  # "pass" or "fail: <reason>"
  if [[ "$result" == "pass" ]]; then
    echo "  ✓ PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAIL  $label — ${result#fail: }"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== damilola.tech smoke test ==="
echo "Target: $BASE_URL"
echo ""

# 1. Homepage 200 + hero h1
echo "[ Homepage ]"
HOMEPAGE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o "$SMOKE_TMP/homepage.html" -w "%{http_code}" "$BASE_URL/" 2>/dev/null)
check "GET / → 200" "$([ "$HOMEPAGE" = "200" ] && echo pass || echo "fail: HTTP $HOMEPAGE")"
check "Hero contains 'Damilola Elegbede'" "$(grep -q 'Damilola Elegbede' "$SMOKE_TMP/homepage.html" && echo pass || echo 'fail: text not found')"

# 2. Case study routes
echo ""
echo "[ Case studies ]"
for path in /projects/bareclaude/case-study /projects/alcbf/case-study; do
  CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null)
  check "GET $path → 200" "$([ "$CODE" = "200" ] && echo pass || echo "fail: HTTP $CODE")"
done
# Legacy cortex path must keep redirecting permanently (308) so its SEO signal
# consolidates onto the bareclaude URL.
CORTEX_CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o /dev/null -w "%{http_code}" "$BASE_URL/projects/cortex/case-study" 2>/dev/null)
check "GET /projects/cortex/case-study → 308 (permanent)" "$([ "$CORTEX_CODE" = "308" ] && echo pass || echo "fail: HTTP $CORTEX_CODE")"

# 3. /api/health
echo ""
echo "[ Health endpoint ]"
HEALTH_CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o "$SMOKE_TMP/health.json" -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null)
check "GET /api/health → 200" "$([ "$HEALTH_CODE" = "200" ] && echo pass || echo "fail: HTTP $HEALTH_CODE")"
check "/api/health body has status:ok" "$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("status")=="ok" else 1)' "$SMOKE_TMP/health.json" 2>/dev/null && echo pass || echo 'fail: status!=ok or parse error')"

# 4. score-job API — auth gate must reject unauthenticated calls.
#    The endpoint is protected by requireApiKey(); a 200 here would be a
#    regression (open endpoint), so 401 is the passing condition and no
#    credential is needed to run this smoke test.
echo ""
echo "[ score-job API ]"
SCORE_BODY='{"url":"https://example.com/jobs/1","title":"Senior Engineer","company":"Example Co"}'
SCORE_CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/score-job" \
  -H "Content-Type: application/json" \
  -d "$SCORE_BODY" 2>/dev/null)
check "POST /api/v1/score-job unauthenticated → 401" "$([ "$SCORE_CODE" = "401" ] && echo pass || echo "fail: HTTP $SCORE_CODE (expected 401 — auth gate)")"

# 5. sitemap.xml
echo ""
echo "[ Sitemap ]"
SITEMAP_CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o "$SMOKE_TMP/sitemap.xml" -w "%{http_code}" "$BASE_URL/sitemap.xml" 2>/dev/null)
check "GET /sitemap.xml → 200" "$([ "$SITEMAP_CODE" = "200" ] && echo pass || echo "fail: HTTP $SITEMAP_CODE")"
URL_COUNT=$(extract_sitemap_locs | grep -c . || echo 0)
check "Sitemap has ≥10 URLs (found $URL_COUNT)" "$([ "$URL_COUNT" -ge 10 ] && echo pass || echo "fail: only $URL_COUNT URLs")"

# Every advertised URL must actually resolve. A page removed from the site but
# left in the sitemap keeps pointing search engines at a dead URL — that is
# exactly how the removed Forge Intel case study survived its own takedown
# (#215 -> #218). Redirects fail too: a sitemap should list canonical targets,
# not URLs that bounce.
BAD_URLS=""
while IFS= read -r loc; do
  [ -z "$loc" ] && continue
  LOC_CODE=$(curl -s "${CURL_TIMEOUT_OPTS[@]}" -o /dev/null -w "%{http_code}" "$loc" 2>/dev/null)
  if [ "$LOC_CODE" != "200" ]; then
    BAD_URLS="${BAD_URLS}\n    $LOC_CODE $loc"
  fi
done < <(extract_sitemap_locs)

if [ -z "$BAD_URLS" ]; then
  check "Every sitemap URL returns 200 ($URL_COUNT checked)" "pass"
else
  check "Every sitemap URL returns 200 ($URL_COUNT checked)" "fail: non-200 entries:$(printf "%b" "$BAD_URLS")"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "SMOKE TEST FAILED — see failures above"
  exit 1
fi
