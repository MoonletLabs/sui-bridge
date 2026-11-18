import {
    getHashiBatches,
    getHashiCommittee,
    getHashiOverview,
    getHashiRequests,
} from 'src/utils/hashi-chain'
import { inChunks, type Sql } from './db'
import { recordState } from './metrics'

/**
 * One pass over Hashi's current on-chain state:
 *  - a snapshot row (supply, reserve, UTXOs, queues) for the history charts
 *  - the committee of the current epoch, when not stored yet
 *  - every deposit, withdrawal and batch (upserted: statuses move forward over time).
 *    Networks too large to read in full are covered by the event job instead.
 */
export async function runSnapshot(sql: Sql, network: string) {
    const o = await getHashiOverview(network)
    recordState(o)
    await sql`
        insert into hashi_snapshots (
            network, taken_at, epoch, paused, supply_sats, pool_sats, pool_utxos,
            pending_deposits, pending_withdrawals, processed_deposits, processed_withdrawals,
            spent_utxos, registered_members
        ) values (
            ${network}, now(), ${o.epoch}, ${o.config.paused}, ${o.supplySats}, ${o.poolSats},
            ${o.poolUtxoCount}, ${o.pendingDeposits}, ${o.pendingWithdrawals},
            ${o.processedDeposits}, ${o.processedWithdrawals}, ${o.spentUtxos},
            ${o.registeredMembers}
        )
        on conflict do nothing`

    // The committee read is heavy and only changes per epoch
    const known = await sql`
        select 1 from hashi_committee_epochs where network = ${network} and epoch = ${o.epoch}`
    let epochs = 0
    if (!known.length) {
        const committee = await getHashiCommittee(network)
        for (const s of committee.stats) {
            await sql`
                insert into hashi_committee_epochs (
                    network, epoch, members, total_weight, top1_pct, top5_pct, top10_pct,
                    blocking_members, quorum_members
                ) values (
                    ${network}, ${s.epoch}, ${s.members}, ${s.totalWeight}, ${s.top1Pct},
                    ${s.top5Pct}, ${s.top10Pct}, ${s.blockingMembers}, ${s.quorumMembers}
                ) on conflict do nothing`
            epochs += 1
        }
    }

    const requests = await getHashiRequests(network)
    let deposits = 0
    let withdrawals = 0
    let batches = 0
    if (!requests.tooLarge) {
        await inChunks(
            requests.deposits,
            200,
            chunk =>
                sql`
            insert into hashi_deposits ${sql(
                chunk.map(d => ({
                    network,
                    id: d.id,
                    sender: d.sender,
                    amount_sats: d.amountSats,
                    btc_txid: d.btcTxid,
                    status: d.status,
                    mints: d.mints,
                    created_ms: d.createdMs,
                    approved_ms: d.approvedMs,
                    confirmed_ms: d.confirmedMs,
                })),
            )}
            on conflict (network, id) do update set
                status = excluded.status, approved_ms = excluded.approved_ms,
                confirmed_ms = excluded.confirmed_ms, mints = excluded.mints, updated_at = now()`,
        )
        deposits = requests.deposits.length

        await inChunks(
            requests.withdrawals,
            200,
            chunk =>
                sql`
            insert into hashi_withdrawals ${sql(
                chunk.map(w => ({
                    network,
                    id: w.id,
                    sender: w.sender,
                    amount_sats: w.amountSats,
                    btc_txid: w.btcTxid,
                    status: w.status,
                    created_ms: w.createdMs,
                    approved_ms: w.approvedMs,
                    burned_ms: w.burnedMs,
                    confirmed_ms: w.confirmedMs,
                })),
            )}
            on conflict (network, id) do update set
                status = excluded.status, btc_txid = excluded.btc_txid,
                approved_ms = excluded.approved_ms, burned_ms = excluded.burned_ms,
                confirmed_ms = excluded.confirmed_ms, updated_at = now()`,
        )
        withdrawals = requests.withdrawals.length
    }

    // Batches have their own size check: they are collected even when the request tables are
    // too large to read, as long as the batch tables themselves are small enough
    const b = await getHashiBatches(network)
    if (!b.tooLarge) {
        await inChunks(
            b.batches,
            200,
            chunk =>
                sql`
            insert into hashi_batches ${sql(
                chunk.map(x => ({
                    network,
                    id: x.id,
                    btc_txid: x.btcTxid,
                    status: x.status,
                    withdrawals: x.withdrawals,
                    output_sats: x.outputSats,
                    fee_sats: x.feeSats,
                    inputs: x.inputs,
                    created_ms: x.createdMs,
                    signed_ms: x.signedMs,
                    confirmed_ms: x.confirmedMs,
                })),
            )}
            on conflict (network, id) do update set
                status = excluded.status, signed_ms = excluded.signed_ms,
                confirmed_ms = excluded.confirmed_ms, updated_at = now()`,
        )
        batches = b.batches.length
    }

    return { epoch: o.epoch, supplySats: o.supplySats, epochs, deposits, withdrawals, batches }
}
