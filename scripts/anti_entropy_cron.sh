set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
INTERVAL="${INTERVAL:-60}"
LOG_FILE="logs/shell-repair.log"
PID_FILE="/tmp/anti_entropy.pid"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${CYAN}[INFO]${NC}  $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[OK]${NC}    $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERR]${NC}   $*" | tee -a "$LOG_FILE"; }

mkdir -p logs

ONCE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --interval) INTERVAL="$2"; shift 2 ;;
    --once)     ONCE=true;     shift   ;;
    *)          shift                  ;;
  esac
done

trigger_repair() {
  log "Triggering cluster repair via Express API…"

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_BASE}/repair/cluster" \
    -H "Content-Type: application/json" \
    --connect-timeout 5 \
    --max-time 30 2>/dev/null || echo -e "\n000")

  body=$(echo "$response" | head -n -1)
  http_code=$(echo "$response" | tail -n 1)

  if [[ "$http_code" == "200" ]]; then
    local repaired
    repaired=$(echo "$body" | grep -o '"repaired":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
    ok "Repair complete. Records repaired: ${repaired}"
  else
    err "Repair API returned HTTP ${http_code}. Body: ${body:0:200}"
  fi
}

run_scan() {
  log "Running mismatch scan…"
  curl -s "${API_BASE}/repair/scan" \
    --connect-timeout 5 \
    --max-time 15 2>/dev/null \
    | python3 -m json.tool 2>/dev/null \
    | grep -E '(nodeA|nodeB|diverged|consistent)' \
    | tee -a "$LOG_FILE" || warn "Scan unavailable (server not running?)"
}

commit_policy() {
  log "Committing policy state to Git…"
  curl -s -X POST "${API_BASE}/git/commit" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Scheduled repair run at $(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}" \
    --connect-timeout 5 2>/dev/null | grep -o '"success":[a-z]*' || true
}

check_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      warn "Another instance is running (PID $old_pid). Exiting."
      exit 0
    fi
  fi
  echo $$ > "$PID_FILE"
}

cleanup() {
  rm -f "$PID_FILE"
  log "Anti-entropy daemon stopped."
}
trap cleanup EXIT INT TERM

check_pid

log "╔══════════════════════════════════════════╗"
log "║  Anti-Entropy Shell Scheduler started    ║"
log "║  Interval: ${INTERVAL}s | PID: $$            ║"
log "╚══════════════════════════════════════════╝"

run_once() {
  trigger_repair
  run_scan
  commit_policy
}

if $ONCE; then
  run_once
else
  while true; do
    run_once
    log "Sleeping ${INTERVAL}s until next window…"
    sleep "$INTERVAL"
  done
fi
