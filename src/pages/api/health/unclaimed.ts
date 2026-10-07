import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import db from '../database'
import { sendError, sendReply } from '../utils'

export type UnclaimedTransfer = {
    chain_id: number
    nonce: number
    timestamp_ms: number
    age_hours: number
    token_id: number
    token_name: string
    amount: number
    amount_usd: number
    destination_chain: number
    direction: 'ETH → SUI' | 'SUI → ETH'
    sender_address: string
    recipient_address: string
    tx_hash: string
}

export type UnclaimedResponse = {
    transfers: UnclaimedTransfer[]
    total: number
}

const SORTS = ['newest', 'age', 'value'] as const
type SortBy = (typeof SORTS)[number]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const sql = db[networkConfig.network]

        const limit = Math.min(Number(req.query.limit) || 25, 100)
        const rawOffset = Number(req.query.offset)
        const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0
        const sortByParam = req.query.sortBy as SortBy
        const sortBy: SortBy = SORTS.includes(sortByParam) ? sortByParam : 'newest'

        const orderBy =
            sortBy === 'value'
                ? sql`amount_usd DESC NULLS LAST`
                : sortBy === 'age'
                  ? sql`timestamp_ms ASC`
                  : sql`timestamp_ms DESC`
        const [rows, countRows] = await Promise.all([
            sql`
                WITH deposited AS (
                    SELECT chain_id, nonce, timestamp_ms
                    FROM public.token_transfer
                    WHERE status = 'Deposited'
                ),
                claimed AS (
                    SELECT chain_id, nonce
                    FROM public.token_transfer
                    WHERE status = 'Claimed'
                )
                SELECT
                    d.chain_id,
                    d.nonce,
                    d.timestamp_ms,
                    td.token_id,
                    td.amount,
                    td.destination_chain,
                    encode(td.sender_address, 'hex') AS sender_address,
                    encode(td.recipient_address, 'hex') AS recipient_address,
                    encode(td.txn_hash, 'hex') AS tx_hash,
                    (td.amount::NUMERIC / NULLIF(p.denominator, 0)) * p.price::NUMERIC AS amount_usd,
                    p.denominator
                FROM deposited d
                LEFT JOIN claimed c ON c.chain_id = d.chain_id AND c.nonce = d.nonce
                JOIN public.token_transfer_data td
                    ON td.chain_id = d.chain_id AND td.nonce = d.nonce
                LEFT JOIN public.prices p ON p.token_id = td.token_id
                WHERE c.nonce IS NULL
                ORDER BY ${orderBy}
                LIMIT ${limit} OFFSET ${offset}
            `,
            sql`
                WITH deposited AS (
                    SELECT chain_id, nonce FROM public.token_transfer WHERE status = 'Deposited'
                ),
                claimed AS (
                    SELECT chain_id, nonce FROM public.token_transfer WHERE status = 'Claimed'
                )
                SELECT COUNT(*) AS total
                FROM deposited d
                LEFT JOIN claimed c ON c.chain_id = d.chain_id AND c.nonce = d.nonce
                JOIN public.token_transfer_data td
                    ON td.chain_id = d.chain_id AND td.nonce = d.nonce
                WHERE c.nonce IS NULL
            `,
        ])

        const now = Date.now()
        const suiId = networkConfig.config.networkId.SUI

        const transfers: UnclaimedTransfer[] = rows.map((row: any) => {
            const timestamp = Number(row.timestamp_ms)
            const coin = networkConfig.config.coins[row.token_id]
            const denominator = Number(row.denominator) || coin?.deno || 1
            const isInflow = Number(row.destination_chain) === suiId

            return {
                chain_id: Number(row.chain_id),
                nonce: Number(row.nonce),
                timestamp_ms: timestamp,
                age_hours: (now - timestamp) / 3600000,
                token_id: Number(row.token_id),
                token_name: coin?.name || `#${row.token_id}`,
                amount: Number(row.amount) / denominator,
                amount_usd: Number(row.amount_usd) || 0,
                destination_chain: Number(row.destination_chain),
                direction: isInflow ? 'ETH → SUI' : 'SUI → ETH',
                sender_address: row.sender_address,
                recipient_address: row.recipient_address,
                tx_hash: row.tx_hash,
            }
        })

        const response: UnclaimedResponse = {
            transfers,
            total: Number(countRows[0]?.total) || 0,
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Unclaimed transfers API error:', error)
        sendError(res, { code: 500, message: 'Failed to load unclaimed transfers' })
    }
}
