#!/usr/bin/env bash
# check-no-leaks.sh — pre-commit guard for the public repo.
#
# Refuses staging diffs that look like they contain:
#   - phone numbers
#   - long-digit confirmation / reservation codes
#   - explicit home coordinates
#   - hard-coded API keys
#
# Best-effort, not exhaustive. The real guarantee is editorial discipline:
# anything sensitive does not enter the repo (ADR-0005). This is a tripwire.

set -euo pipefail

# Diff what's staged for commit, or what's in the working tree if not in a hook.
if git rev-parse --git-dir >/dev/null 2>&1; then
  staged=$(git diff --cached -U0 || true)
else
  staged=""
fi

if [[ -z $staged ]]; then
  staged=$(find src -type f \( -name '*.mdx' -o -name '*.md' \) -print0 2>/dev/null | xargs -0 cat 2>/dev/null || true)
fi

fail=0

check() {
  local label=$1 pattern=$2
  if echo "$staged" | grep -E -nq "$pattern"; then
    echo "✗ leak check FAILED — $label"
    echo "$staged" | grep -E -n "$pattern" | head -5
    fail=1
  fi
}

# Patterns are deliberately conservative — small false-positive rate is OK.
# Phone-number regex requires a phone-context word nearby; the raw digit shape
# alone over-matches lat/lng pairs, ISO dates, and ISBNs found in editorial text.
check "phone-number (with context)"        '(tel:|phone|whatsapp|wechat|mobile|cell)[^A-Za-z0-9]{0,12}[+(]?[0-9][0-9 ()\-]{8,16}[0-9]\b'
check "confirmation-code-style (8+ alnum)" '\b[A-Z0-9]{8,}\b.*confirm'
check "home_lat / home_lng marker"         'home_lat|home_lng|"home":\s*\{'
check "Anthropic API key"                  'sk-ant-[A-Za-z0-9_-]{20,}'
check "AWS access-key id (permanent)"      'AKIA[0-9A-Z]{16}'
check "AWS access-key id (temporary)"      'ASIA[0-9A-Z]{16}'
check "AWS secret-access-key assignment"   'aws_secret_access_key\s*[=:]\s*['\''"][A-Za-z0-9/+=]{40}'
check "Google API key"                     'AIza[0-9A-Za-z_-]{30,}'

if [[ $fail -eq 1 ]]; then
  echo
  echo "Refusing to commit. If a match is a false positive, narrow it or commit by-file."
  echo "See ADR-0005 for the no-sensitive-content-in-repo policy."
  exit 1
fi

echo "✓ leak check passed"
