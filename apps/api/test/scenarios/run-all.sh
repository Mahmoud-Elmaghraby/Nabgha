#!/usr/bin/env bash
# تشغيل كل سيناريوهات الاختبار. من جذر apps/api:  bash test/scenarios/run-all.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
export TS_NODE_TRANSPILE_ONLY=1
REQ="-r ./test/scenarios/support/alias.js -r tsconfig-paths/register"
fail=0
for t in wa.check auth.check exam-pdf-html.check scan.check credits.scenarios exams.scenarios; do
  echo; echo "════ $t ════"
  npx ts-node $REQ "test/scenarios/$t.ts" || fail=1
done
exit $fail
