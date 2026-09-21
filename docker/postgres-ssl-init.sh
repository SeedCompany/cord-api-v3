#!/bin/sh
# Runs once, on the first boot against an empty data dir
# (via /docker-entrypoint-initdb.d).
#
# The API's PG client always performs an SSL handshake — see
# src/core/drizzle/drizzle.service.ts: `sslmode=no-verify` in POSTGRES_URL only
# skips certificate verification, it never disables SSL — so even a local
# server must present a certificate.
set -e

openssl req -new -x509 -days 3650 -nodes \
  -subj "/CN=localhost" \
  -out "$PGDATA/server.crt" -keyout "$PGDATA/server.key"
chmod 600 "$PGDATA/server.key"

echo 'ssl = on' >> "$PGDATA/postgresql.conf"
