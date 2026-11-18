# Hashi indexer

Stores [Hashi](https://mystenlabs.github.io/hashi/design) (Sui's Bitcoin orchestrator) state and
history in a small Postgres, so the dashboard can show what the chain does not keep: supply,
reserve, UTXOs and queue sizes over time, plus every request, batch and committee epoch.

One stack = one Postgres (`postgres:16-alpine`) + **one indexer for one network**.

```
Sui (GraphQL) ──► indexer ──► postgres ◄── dashboard (read-only role)
```

The indexer needs nothing from the Hashi node itself, only the Sui endpoint. It reads the same
on-chain state the dashboard does (`src/utils/hashi-chain.ts`, copied in at build time).

## What it stores

| Job | Every | Writes |
|---|---|---|
| snapshot | `SNAPSHOT_SECONDS` (600) | `hashi_snapshots` (supply, reserve, UTXOs, queues), `hashi_committee_epochs`, and, when the tables are small enough to read, `hashi_deposits`, `hashi_withdrawals`, `hashi_batches` (upserted, statuses move forward) |
| events | `EVENT_SECONDS` (60) | `hashi_events`: the request lifecycle events, with a cursor per type in `hashi_sync_state`. First run reads back `BACKFILL_DAYS` (0 = everything) |

Safe to restart or run twice: writes are idempotent, cursors resume, and a Postgres advisory lock
stops overlapping runs. Health: the container is healthy while some job succeeded recently.

## 1. Local: one stack per network, like production

```bash
cp .env.example .env.local.mainnet   # NETWORK=mainnet, three passwords, DB_PORT=5544
cp .env.example .env.local.testnet   # NETWORK=testnet, three passwords, DB_PORT=5545
docker compose -p hashi-mainnet --env-file .env.local.mainnet up -d --build
docker compose -p hashi-testnet --env-file .env.local.testnet up -d --build
docker logs -f hashi-mainnet-indexer-1
```

Point the dashboard at them (root `.env.local`, read-only role):

```
SUI_HASHI_POSTGRES_URL=postgres://hashi_reader:<mainnet HASHI_READER_PASSWORD>@localhost:5544/hashi
SUI_HASHI_TESTNET_POSTGRES_URL=postgres://hashi_reader:<testnet HASHI_READER_PASSWORD>@localhost:5545/hashi
```

The Hashi Overview tab then shows "Supply, reserve and queues over time" once two snapshots exist.
Without these variables the dashboard simply has no history and reads live from Sui.

Reset a stack: `docker compose -p hashi-mainnet --env-file .env.local.mainnet down -v`.

**Coming from an earlier version of this setup?** A `.env.local.*` file may still contain
`COMPOSE_FILE=docker-compose.yml:docker-compose.build.yml` and `HASHI_INDEXER_IMAGE=...`. The override
file no longer exists (the compose file builds by itself now), so delete those two lines or every
`docker compose` command fails with a missing-file error.

## 2. The Hashi hosts (testnet host, mainnet host)

Same files, one network per host (`NETWORK` in the env file), one Postgres per host. Checklist
before the first start on a host:

- **Docker access.** If the Hashi node's own user is not in the docker group, use a dedicated user for this
  stack (docker access is root-equivalent, and the Hashi user holds the node's keys). The stack must
  not mount anything from `/opt/sui`.
- **Outbound HTTPS** to `github.com` (the clone), Docker Hub (the `node` and `postgres` base images), the npm
  registry (during the build) and the Sui GraphQL endpoint.
- **Env file** (`.env`, mode 600): `NETWORK`, strong passwords (any characters: the indexer gets them as
  separate settings, and the init script quotes them; only the dashboard's own database URLs, which are
  real URLs, need the password percent-encoded), and `DB_PORT=5433` on **both** hosts.
  Postgres listens on `DB_PORT` inside the container as well as on the host: Docker rewrites the
  destination port before the host firewall's `DOCKER-USER` chain, so one number inside and out keeps a
  firewall rule for it valid in both chains. Set `DB_BIND` to the interface the dashboard reaches.
- **Firewall** (ansible `host_vars`): allow `tcp/5433` from the dashboard's Swarm IPs only (and the dev
  environment's IPs if the dev dashboard should show Hashi history). Postgres uses scram passwords; the
  dashboard uses the `hashi_reader` role (read-only, 8s statement timeout, 5 connections).
- **Dashboard secrets** (Swarm): `sui-hashi-postgres-url` (mainnet) and
  `sui-hashi-testnet-postgres-url`, wired in `deployment/dashboard.yml` like the bridge ones.
- **Testnet is busy** (millions of requests): leave `BACKFILL_DAYS` at its default (7 days, about 600,000 events
  and half a gigabyte, read in roughly an hour). The indexer reads at most `EVENTS_MAX_PAGES_PER_RUN` pages per
  type per run and logs a warning at the cap.
- Limits are set in the compose file (indexer 256 MB / 0.5 CPU, Postgres 512 MB).

## Releases

Hosts run **release tags**, never a branch. A release is a tag named `hashi-indexer-vMAJOR.MINOR` (an
optional patch part or a suffix such as `-rc.1` is allowed) on a commit of `main`, plus a GitHub Release
page with the notes. Create one from an up-to-date `main`:

```bash
git checkout main && git pull
git tag -a hashi-indexer-v2.0 -m "Hashi indexer 2.0"
git push origin hashi-indexer-v2.0
gh release create hashi-indexer-v2.0 --verify-tag --title "Hashi indexer 2.0" \
    --notes-file hashi-indexer/release-notes/v2.0.md
```

The release notes live in the repository (`hashi-indexer/release-notes/vX.Y.md`), so they are reviewed with the code
and become the body of the GitHub Release. Write the notes for a new version in a PR before tagging it.
Treat a tag that has been deployed as final: fix forward with a new version instead of moving it.
Only repository admins can create, move or delete these tags (a ruleset enforces it).

## Deploying on a host

There is no registry and no image to publish: a host checks out the release tag and builds from it. The
repository is public, so cloning needs no credentials. The first time, as the user that runs docker:

```bash
git clone --filter=blob:none --sparse https://github.com/MoonletLabs/sui-bridge.git ~/sui-bridge
cd ~/sui-bridge && git sparse-checkout set hashi-indexer src/utils src/config
cd hashi-indexer && cp .env.example .env && chmod 600 .env     # then edit .env (see the checklist)
```

`.env` is not tracked by git, so it survives every checkout. Then, for the first release and for every
upgrade or rollback:

```bash
cd ~/sui-bridge/hashi-indexer
./deploy.sh hashi-indexer-v2.0
```

`deploy.sh` accepts only a release tag, refuses to run on a modified checkout, fetches the tags, checks
the tag out (detached, so it can never sit on `main`), builds the image from that exact commit and
starts the stack. Rolling back is the same command with the previous tag.

- **Which release is running:** `git describe --tags --exact-match`, and the indexer logs its version when it starts
  (`docker compose --env-file .env logs indexer | head`).
- **The database stays** across upgrades; new migrations apply on start. The init script only runs when the
  database volume is first created.
- **The build** takes about a minute of CPU on the host. The base image is pinned by digest in the Dockerfile
  (refresh it on purpose, not by accident) and the npm packages by the lockfile.
- Migrations are additive, so an older release keeps working on a newer schema; check the release notes before
  relying on that for a rollback.

## Monitoring

The indexer serves Prometheus metrics (`/metrics`) on `METRICS_PORT` (default **9199**). Compose publishes the
port on the host's **loopback only**, so nothing outside the machine can reach it and no firewall rule is
needed. The Moonlet agent finds it by itself (it scans the host's listening ports and reads `/metrics`), and
re-exposes it with the server's labels (`network`, `hostname`, ...); VictoriaMetrics and Grafana take it from there.

```
indexer :9199/metrics  ->  moonlet-agent (autodiscovery, every 2 min)  ->  VictoriaMetrics  ->  Grafana + alerts
```

**Set up on each Hashi host** (once):

1. Deploy a release that has metrics (`./deploy.sh hashi-indexer-v2.0`).
2. In the admin UI, open the server's *Autodiscovery config* and add a port label mapping for **9199**:
   `blockchain: sui`, `server_type: rpc`, `node_type: hashi-indexer`. The dashboard filters on `blockchain` and
   `node_type`, so use exactly these. Do not add a `network` mapping for the port: the server-level mapping
   already sets it.
3. Check it: `moonlet-agent stats` lists `http://127.0.0.1:9199/metrics` as a valid endpoint, and
   `curl -s localhost:9199/metrics | head` shows the metrics.

**Metrics** (all `hashi_indexer_*`; no `network` label, the agent adds it):

| Group | Metrics |
|---|---|
| Process | `info{version}`, `start_time_seconds`, `process_resident_memory_bytes`, `process_heap_used_bytes`, `process_cpu_seconds_total`, `process_event_loop_delay_seconds_p99` |
| Jobs (`snapshot`, `events`) | `job_runs_total{job,result}`, `job_duration_seconds` (histogram), `job_last_success_timestamp_seconds`, `job_last_run_ok` |
| Events | `events_stored_total{type}`, `events_caught_up{type}`, `backfill_done{type}`, `events_in_db{type}`, `newest_event_timestamp_seconds{type}` |
| Sui GraphQL | `graphql_requests_total{result}`, `graphql_request_duration_seconds` (histogram) |
| Hashi state (last snapshot) | `supply_sats`, `reserve_sats`, `backing_ratio`, `utxos`, `pending_deposits`, `pending_withdrawals`, `processed_deposits`, `processed_withdrawals`, `epoch`, `paused`, `registered_members` |
| Database | `db_up`, `db_size_bytes`, `db_table_bytes{table}`, `db_table_rows{table}` |

Use `events_caught_up` (not the age of the newest event) to tell whether the indexer keeps up: a quiet event type
can legitimately be hours old. The database figures are refreshed in the background at most once a minute, so a
scrape never waits for Postgres.

**Dashboard** (`monitoring/grafana-dashboard.json`): in Grafana, *Dashboards > New > Import*, upload the file. It
uses the default data source (no data source is set in the file). It has the same three dropdowns as the Sui Bridge Indexer
dashboard: **Network**, **Hostname** and **Host** (the IP from `instance`), filtered by the labels above.

**Suggested alerts** (create them where you manage alert rules; the agent samples every 2 minutes, so use a `for:` of
at least 5 minutes). The staleness limits match the container healthcheck:

| Alert | Condition |
|---|---|
| Metrics missing (per host) | `count by (network, hostname)(last_over_time(hashi_indexer_info[1d])) unless count by (network, hostname)(hashi_indexer_info)` for 10m. Plain `absent_over_time(hashi_indexer_info[15m])` only fires when every host disappears, so one healthy host would hide another's outage. |
| Events job stale | `time() - hashi_indexer_job_last_success_timestamp_seconds{job="events"} > 900` |
| Snapshot job stale | `time() - hashi_indexer_job_last_success_timestamp_seconds{job="snapshot"} > 2400` |
| A job keeps failing | `hashi_indexer_job_last_run_ok == 0` for 10m |
| Behind the chain | `min by (network, hostname)(hashi_indexer_events_caught_up) == 0` for 30m |
| History not stored | `min by (network, hostname)(hashi_indexer_backfill_done) == 0` for 6h |
| Sui GraphQL errors | error share of `hashi_indexer_graphql_requests_total` over 10m above 20% |
| Database unreachable | `hashi_indexer_db_up == 0` |
| Database large | `hashi_indexer_db_size_bytes > 10e9` (testnet grows about 50 MB a day) |
| Hashi paused | `hashi_indexer_paused == 1` |
| Reserve below supply | `hashi_indexer_backing_ratio < 1` for 15m |
| Withdrawals stuck (mainnet) | `hashi_indexer_pending_withdrawals > 0` while `changes(hashi_indexer_processed_withdrawals[12h]) == 0` |

## Checking that mainnet history is complete

Done locally after a full backfill (everything since the first Hashi request):

- minted deposits minus burned withdrawals equals the on-chain supply and reserve, to the satoshi;
- stored request events equal the successful `deposit()` / `request_withdrawal()` transactions
  counted straight from Sui (a separate query path);
- every request in the tables has its events, and the requests with no table row are the
  expired or removed ones (only the events remember them).

## Backups

Mainnet history can be rebuilt from the chain, but the snapshot time series cannot. Dump it:

```bash
docker compose exec -T hashi-db pg_dump -U hashi_admin -Fc hashi > hashi-$(date +%F).dump
```

## Development

```bash
npm install && npm run typecheck
```

Migrations are plain SQL in `migrations/`, applied in name order, each once.
