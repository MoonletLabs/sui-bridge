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
git tag -a hashi-indexer-v1.0 -m "Hashi indexer 1.0"
git push origin hashi-indexer-v1.0
gh release create hashi-indexer-v1.0 --verify-tag --title "Hashi indexer 1.0" \
    --notes-file hashi-indexer/release-notes/v1.0.md
```

The release notes live in the repository (`hashi-indexer/release-notes/vX.Y.md`), so they are reviewed with the code
and become the body of the GitHub Release. Write the notes for a new version in a PR before tagging it.
Treat a tag that has been deployed as final: fix forward with a new version instead of moving it.
Only repository admins can create, move or delete these tags (a ruleset enforces it).

## Deploying on a host

There is no registry and no image to publish: a host checks out the release tag and builds from it. The
repository is public, so cloning needs no credentials. The first time, as the user that runs docker:

```bash
git clone --filter=blob:none --sparse https://github.com/MoonletLabs/sui-bridge.git /opt/sui-bridge
cd /opt/sui-bridge && git sparse-checkout set hashi-indexer src/utils src/config
cd hashi-indexer && cp .env.example .env && chmod 600 .env     # then edit .env (see the checklist)
```

`.env` is not tracked by git, so it survives every checkout. Then, for the first release and for every
upgrade or rollback:

```bash
cd /opt/sui-bridge/hashi-indexer
./deploy.sh hashi-indexer-v1.0
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
