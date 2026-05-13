#!/usr/bin/env bash
# Post-merge production smoke test for damilola.tech
# Usage: bash scripts/smoke-test-dt.sh [BASE_URL]
# Default BASE_URL: https://www.damilola.tech
# Exits 0 if all checks pass, 1 if any fail.

set -euo pipefail

BASE_URL="${1:-https://www.damilola.tech}"
PASS=0
FAIL=0

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
HOMEPAGE=$(curl -s -o /tmp/dt-homepage.html -w "%{http_code}" "$BASE_URL/" 2>/dev/null)
check "GET / → 200" "$([ "$HOMEPAGE" = "200" ] && echo pass || echo "fail: HTTP $HOMEPAGE")"
check "Hero contains 'Distinguished Engineer'" "$(grep -q 'Distinguished Engineer' /tmp/dt-homepage.html && echo pass || echo 'fail: text not found')"

# 2. Case study routes
echo ""
echo "[ Case studies ]"
for path in /projects/cortex/case-study /projects/forge-intel/case-study /projects/alcbf/case-study; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null)
  check "GET $path → 200" "$([ "$CODE" = "200" ] && echo pass || echo "fail: HTTP $CODE")"
done

# 3. /api/health
echo ""
echo "[ Health endpoint ]"
HEALTH_CODE=$(curl -s -o /tmp/dt-health.json -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null)
check "GET /api/health → 200" "$([ "$HEALTH_CODE" = "200" ] && echo pass || echo "fail: HTTP $HEALTH_CODE")"
check "/api/health body has status:ok" "$(python3 -c \"import json; d=json.load(open('/tmp/dt-health.json')); exit(0 if d.get('status')=='ok' else 1)\" 2>/dev/null && echo pass || echo 'fail: status!=ok or parse error')"

# 4. score-job API with mock payload
echo ""
echo "[ score-job API ]"
SCORE_BODY='{"url":"https://example.com/jobs/1","title":"Senior Engineer","company":"Example Co"}'
SCORE_CODE=$(curl -s -o /tmp/dt-score.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/score-job" \
  -H "Content-Type: application/json" \
  -d "$SCORE_BODY" 2>/dev/null)
check "POST /api/v1/score-job → 200" "$([ "$SCORE_CODE" = "200" ] && echo pass || echo "fail: HTTP $SCORE_CODE")"
check "score-job response has score field" "$(python3 -c \"import json; d=json.load(open('/tmp/dt-score.json')); exit(0 if 'score' in d else 1)\" 2>/dev/null && echo pass || echo 'fail: no score field or parse error')"

# 5. sitemap.xml
echo ""
echo "[ Sitemap ]"
SITEMAP_CODE=$(curl -s -o /tmp/dt-sitemap.xml -w "%{http_code}" "$BASE_URL/sitemap.xml" 2>/dev/null)
check "GET /sitemap.xml → 200" "$([ "$SITEMAP_CODE" = "200" ] && echo pass || echo "fail: HTTP $SITEMAP_CODE")"
URL_COUNT=$(grep -c '<loc>' /tmp/dt-sitemap.xml 2>/dev/null || echo 0)
check "Sitemap has ≥10 URLs (found $URL_COUNT)" "$([ "$URL_COUNT" -ge 10 ] && echo pass || echo "fail: only $URL_COUNT URLs")"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "SMOKE TEST FAILED — see failures above"
  exit 1
fi
