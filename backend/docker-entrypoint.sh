#!/bin/sh
set -e

# Railway mounts the persistent volume at /data owned by root:root, but the
# app runs as the non-root `app` user (see Dockerfile). Fix ownership of the
# volume + the businesses dir as root, then drop privileges to `app`.
BIZ_DIR="${BUSINESSES_DIR:-/data/businesses}"
mkdir -p "$BIZ_DIR"
chown -R app:app /data 2>/dev/null || true

exec gosu app "$@"
