#!/usr/bin/env bash
# Stop the mongod + mongot stack (keeps the data volumes).

set -euo pipefail

cd "$(dirname "$0")/.."

docker compose down
