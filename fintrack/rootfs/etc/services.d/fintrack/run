#!/usr/bin/with-contenv bashio
set -e

bashio::log.info "Starting FinTrack..."

export PORT=8099
export DB_PATH="/data/fintrack.db"

cd /app/server
exec node index.js
