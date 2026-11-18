#!/bin/sh
# Runs once, when the database volume is first created.
# hashi_indexer writes (and owns the tables); hashi_reader is the dashboard's read-only role.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
create role hashi_indexer login password '${HASHI_WRITER_PASSWORD}' connection limit 14;
create role hashi_reader  login password '${HASHI_READER_PASSWORD}' connection limit 5;

grant connect on database ${POSTGRES_DB} to hashi_indexer, hashi_reader;
grant usage, create on schema public to hashi_indexer;
grant usage on schema public to hashi_reader;

-- Tables are created by hashi_indexer; the dashboard may only read them
alter default privileges for role hashi_indexer in schema public grant select on tables to hashi_reader;

-- A runaway dashboard query must not hurt the indexer
alter role hashi_reader set statement_timeout = '8s';
alter role hashi_indexer set statement_timeout = '120s';
SQL
