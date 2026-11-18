#!/bin/sh
# Runs once, when the database volume is first created.
# hashi_indexer writes (and owns the tables); hashi_reader is the dashboard's read-only role.
#
# The passwords and the database name go to psql as variables and are quoted by psql itself
# (:'name' for a string literal, :"name" for an identifier), so any characters are safe: an
# apostrophe in a password cannot break the statements.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v writer_pw="$HASHI_WRITER_PASSWORD" \
    -v reader_pw="$HASHI_READER_PASSWORD" \
    -v dbname="$POSTGRES_DB" <<'SQL'
create role hashi_indexer login password :'writer_pw' connection limit 14;
create role hashi_reader  login password :'reader_pw' connection limit 5;

grant connect on database :"dbname" to hashi_indexer, hashi_reader;
grant usage, create on schema public to hashi_indexer;
grant usage on schema public to hashi_reader;

-- Tables are created by hashi_indexer; the dashboard may only read them
alter default privileges for role hashi_indexer in schema public grant select on tables to hashi_reader;

-- A runaway dashboard query must not hurt the indexer
alter role hashi_reader set statement_timeout = '8s';
alter role hashi_indexer set statement_timeout = '120s';
SQL
