import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiDb } from 'src/utils/hashi-db'
import { parseIntParam, sendReply } from '../utils'

export type HashiHistoryPoint = {
    /** Start of the bucket, milliseconds */
    t: number
    supply_sats: number
    pool_sats: number
    pool_utxos: number
    pending_deposits: number
    pending_withdrawals: number
    /** Requests completed so far (cumulative), for the trend lines on the overview cards */
    processed_deposits: number
    processed_withdrawals: number
}

export type HashiHistoryResponse = {
    /** False when no store is configured (or it cannot be reached): the page hides history */
    available: boolean
    days: number
    bucketSeconds: number
    points: HashiHistoryPoint[]
}

// Finer buckets for short ranges, so a day still shows a curve
const bucketFor = (days: number) => (days <= 2 ? 600 : days <= 14 ? 3600 : 86_400)

async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { network } = getNetworkConfig({ req })
    const days = Math.max(1, parseIntParam(req.query.days, 7, 365))
    const bucketSeconds = bucketFor(days)
    const empty: HashiHistoryResponse = { available: false, days, bucketSeconds, points: [] }

    const sql = getHashiDb(network)
    if (!sql) return sendReply(res, empty)

    try {
        // The last snapshot of each bucket stands for it
        const rows = await sql`
            select distinct on (bucket)
                (extract(epoch from bucket) * 1000)::float8 as t,
                supply_sats::float8 as supply_sats,
                pool_sats::float8 as pool_sats,
                pool_utxos,
                pending_deposits,
                pending_withdrawals,
                processed_deposits::float8 as processed_deposits,
                processed_withdrawals::float8 as processed_withdrawals
            from (
                select *, to_timestamp(floor(extract(epoch from taken_at) / ${bucketSeconds}) * ${bucketSeconds}) as bucket
                from hashi_snapshots
                where network = ${network} and taken_at > now() - make_interval(days => ${days})
            ) s
            order by bucket, taken_at desc`
        return sendReply(res, {
            available: true,
            days,
            bucketSeconds,
            points: rows as unknown as HashiHistoryPoint[],
        } satisfies HashiHistoryResponse)
    } catch (error) {
        console.error('hashi history failed:', error)
        return sendReply(res, empty)
    }
}

export default withCache(handler, 60, { staleSeconds: 600 })
