# Hashi indexer

Stores [Hashi](https://mystenlabs.github.io/hashi/design) (Sui's Bitcoin orchestrator) state and
history in a small Postgres, so the dashboard can show what the chain does not keep: supply,
reserve, UTXOs and queue sizes over time, plus every request, batch and committee epoch.

One stack = one Postgres (`postgres:16-alpine`) + **one indexer for one network**.

```
Sui (GraphQL) ──► indexer ──► postgres ◄── dashboard (read-only role)
```

The indexer needs nothing from the Hashi node itself, only the Sui endpoint. It reads the same
on-chain state the dashboard does (`src/utils/hashi-chain.ts`, shared at build time).

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

## 2. Testnet Hashi host and 3. mainnet Hashi host

Same files, one network per host (`NETWORK` in the env file), one Postgres per host. Checklist
before the first start on a host:

- **Docker access.** If the Hashi node's own user is not in the docker group, use a dedicated user for this
  stack (docker access is root-equivalent, and the Hashi user holds the node's keys). The stack must
  not mount anything from `/opt/sui`.
- **Env file** (`.env`, mode 600): `NETWORK`, strong passwords, and `DB_PORT=5433` on the testnet host
  (5432 is taken by the bridge Postgres). Set `DB_BIND` to the interface the dashboard reaches.
- **Firewall** the database port to the dashboard's Swarm worker only. Postgres uses scram passwords;
  the dashboard uses the `hashi_reader` role (read-only, 8s statement timeout, 5 connections).
- **Dashboard secrets** (Swarm): `sui-hashi-postgres-url` (mainnet) and
  `sui-hashi-testnet-postgres-url`, wired in `deployment/dashboard.yml` like the bridge ones.
- **Testnet is busy** (millions of requests): leave `BACKFILL_DAYS` at its default (3 days). The indexer
  reads at most `EVENTS_MAX_PAGES_PER_RUN` pages per type per run and logs a warning at the cap.
- Limits are set in the compose file (indexer 256 MB / 0.5 CPU, Postgres 512 MB).

## Releases: versioned, tagged images

Hosts run **released versions**, never `main`. A release is a git tag:

```bash
git tag hashi-indexer-v1.0 && git push origin hashi-indexer-v1.0
```

The workflow `.github/workflows/hashi-indexer-image.yml` then typechecks, builds and publishes
`ghcr.io/moonletlabs/hashi-indexer:1.0`, and creates a GitHub Release that lists the image and its
digest. Pull requests and manual runs only build, so merging to `main` publishes nothing. The version
is also baked into the image and logged when the indexer starts.

Promote one version through the environments: local, then the testnet host, then the mainnet host.
Versions are `MAJOR.MINOR` (for example `1.0`, then `1.1`), with an optional patch part; `-rc.1` style tags create a pre-release.

## Getting it onto a host: the released image, no source

A host needs only the compose file, the init script and a `.env`; no source and no build tools.
Both files come out of the image, so they always match the version you run:

```bash
IMAGE=ghcr.io/moonletlabs/hashi-indexer:1.0     # or the digest from the release page
docker pull $IMAGE
docker run --rm $IMAGE cat docker-compose.yml > docker-compose.yml
mkdir -p initdb && docker run --rm $IMAGE cat initdb/01-roles.sh > initdb/01-roles.sh
# create .env (mode 600): NETWORK, the three passwords, DB_PORT/DB_BIND and
#   HASHI_INDEXER_IMAGE=$IMAGE
docker compose --env-file .env up -d
```

`HASHI_INDEXER_IMAGE` has no default on purpose, so a host can never run an unpinned image.

- **Upgrade:** set the new version in `.env`, refresh the compose file from the new image (same two
  `docker run ... cat` commands), then `docker compose --env-file .env pull && docker compose --env-file .env up -d`.
  The database volume stays; new migrations apply on start. The init script only runs when a volume is
  first created.
- **Roll back:** put the previous version back and `up -d` (migrations are additive, so an older
  indexer keeps working on a newer schema; check the release notes before relying on it).
- **Package visibility:** the first publish creates the package. Make it public in the GitHub package
  settings, or log the host in with a read-only token (`docker login ghcr.io`).
- **No registry access from a host?** `docker save` the image, copy it through the jumpbox and
  `docker load` it on the host.

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
