-- Hashi analytics schema. Every table carries the network, so one database can hold both
-- (locally) or just one (on each Hashi host).

create table hashi_snapshots (
    network               text        not null,
    taken_at              timestamptz not null,
    epoch                 integer     not null,
    paused                boolean     not null,
    supply_sats           bigint      not null,
    pool_sats             bigint      not null,
    pool_utxos            integer     not null,
    pending_deposits      integer     not null,
    pending_withdrawals   integer     not null,
    processed_deposits    bigint      not null,
    processed_withdrawals bigint      not null,
    spent_utxos           bigint      not null,
    registered_members    integer     not null,
    primary key (network, taken_at)
);

create table hashi_committee_epochs (
    network         text        not null,
    epoch           integer     not null,
    members         integer     not null,
    total_weight    integer     not null,
    top1_pct        real        not null,
    top5_pct        real        not null,
    top10_pct       real        not null,
    blocking_members integer    not null,
    quorum_members  integer     not null,
    recorded_at     timestamptz not null default now(),
    primary key (network, epoch)
);

create table hashi_deposits (
    network       text    not null,
    id            text    not null,
    sender        text    not null,
    amount_sats   bigint  not null,
    btc_txid      text    not null,
    status        text    not null,
    mints         boolean not null,
    created_ms    bigint  not null,
    approved_ms   bigint,
    confirmed_ms  bigint,
    updated_at    timestamptz not null default now(),
    primary key (network, id)
);
create index hashi_deposits_created on hashi_deposits (network, created_ms desc);

create table hashi_withdrawals (
    network       text    not null,
    id            text    not null,
    sender        text    not null,
    amount_sats   bigint  not null,
    btc_txid      text,
    status        text    not null,
    created_ms    bigint  not null,
    approved_ms   bigint,
    burned_ms     bigint,
    confirmed_ms  bigint,
    updated_at    timestamptz not null default now(),
    primary key (network, id)
);
create index hashi_withdrawals_created on hashi_withdrawals (network, created_ms desc);

create table hashi_batches (
    network       text    not null,
    id            text    not null,
    btc_txid      text    not null,
    status        text    not null,
    withdrawals   integer not null,
    output_sats   bigint  not null,
    fee_sats      bigint  not null,
    inputs        integer not null,
    created_ms    bigint  not null,
    signed_ms     bigint,
    confirmed_ms  bigint,
    updated_at    timestamptz not null default now(),
    primary key (network, id)
);

-- Raw Hashi events: the only source of history on networks too large to read table by table
create table hashi_events (
    network     text        not null,
    event_type  text        not null,
    tx_digest   text        not null,
    event_seq   integer     not null,
    ts          timestamptz not null,
    payload     jsonb       not null,
    primary key (network, tx_digest, event_seq, event_type)
);
create index hashi_events_ts on hashi_events (network, event_type, ts desc);

-- Where each job stopped (event cursors) and how it last ran
create table hashi_sync_state (
    network     text        not null,
    name        text        not null,
    cursor      text,
    updated_at  timestamptz not null default now(),
    last_error  text,
    primary key (network, name)
);
