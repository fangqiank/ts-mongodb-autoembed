#!/usr/bin/env bash
# Bring up the mongod + mongot stack for the autoEmbed demo.
#
# mongot refuses to start if the Voyage key files (or pwfile) are readable
# by anyone other than the owner, and a fresh git clone / extract resets
# them to 0644. We normalize perms here before `docker compose up`.

set -euo pipefail

cd "$(dirname "$0")/.."

KEY_FILES=(voyage-api-query-key voyage-api-indexing-key pwfile)

for f in "${KEY_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "error: required secret file '$f' not found in $(pwd)" >&2
    exit 1
  fi
  chmod 400 "$f"
done

echo "Secret file permissions locked to 0400:"
ls -l "${KEY_FILES[@]}"

echo
echo "Starting mongod + mongot via docker compose..."
docker compose up -d

echo
echo "Waiting for mongot to reach steady state..."
for _ in $(seq 1 30); do
  # Process substitution avoids SIGPIPE-from-`docker logs` tripping `pipefail`
  # when `grep -q` short-circuits on a match.
  if grep -Eq "Transitioning from (INITIAL_SYNC|INITIALIZING) to STEADY_STATE" \
      < <(docker logs mongot-community 2>&1); then
    echo "mongot is up."
    docker ps --filter name=mongo --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    exit 0
  fi
  sleep 1
done

echo "warning: mongot did not report STEADY_STATE within 30s; check 'docker logs mongot-community'." >&2
docker ps --filter name=mongo --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
exit 1
