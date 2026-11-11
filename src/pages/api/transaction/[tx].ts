import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { transformHistory, transformTransfers, parseTransactionHash } from 'src/utils/helper'
import db from '../database'
import { sendError, sendReply } from '../utils'
import { getPrices } from '../prices'
import { memoizeAsync } from 'src/utils/api-cache'

type TypicalLatency = { approval_p50: number | null; claim_p50: number | null; sample: number }

/**
 * Median deposit->approval and deposit->claim times (minutes) over the last
 * 30 days for transfers deposited on `chainId`: what "normal" looks like, to
 * compare this transfer against. Cached - it barely moves.
 */
const getTypicalLatency = memoizeAsync(
    async (network: 'mainnet' | 'testnet', chainId: number): Promise<TypicalLatency> => {
        const sinceMs = Date.now() - 30 * 24 * 3600 * 1000
        const rows = await db[network]`
            WITH d AS (
                SELECT nonce, timestamp_ms FROM public.token_transfer
                WHERE status = 'Deposited' AND chain_id = ${chainId} AND timestamp_ms >= ${sinceMs}
            ),
            a AS (
                SELECT nonce, timestamp_ms FROM public.token_transfer
                WHERE status = 'Approved' AND chain_id = ${chainId} AND timestamp_ms >= ${sinceMs}
            ),
            c AS (
                SELECT nonce, timestamp_ms FROM public.token_transfer
                WHERE status = 'Claimed' AND chain_id = ${chainId} AND timestamp_ms >= ${sinceMs}
            )
            SELECT
                COUNT(*) AS sample,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p50,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY (c.timestamp_ms - d.timestamp_ms) / 60000.0) AS claim_p50
            FROM d
            LEFT JOIN a ON a.nonce = d.nonce
            LEFT JOIN c ON c.nonce = d.nonce
        `
        const r = rows[0] || {}
        return {
            approval_p50:
                r.approval_p50 === null || r.approval_p50 === undefined
                    ? null
                    : Number(r.approval_p50),
            claim_p50:
                r.claim_p50 === null || r.claim_p50 === undefined ? null : Number(r.claim_p50),
            sample: Number(r.sample) || 0,
        }
    },
    (network, chainId) => `${network}:${chainId}`,
    300,
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const tx = req.query.tx?.toString()

        if (!tx) {
            sendError(res, { code: 400, message: 'Transaction hash is required' })
            return
        }

        // Parse and normalize transaction hash for database query
        let hexTx: string
        try {
            hexTx = parseTransactionHash(tx)
        } catch (error) {
            console.error('Transaction hash parsing error:', error)
            sendError(res, { code: 400, message: `Invalid transaction hash format: ${tx}` })
            return
        }

        /**
         * Get bridge transactions
         */

        const queryTokenData = await db[networkConfig.network]`
            SELECT
                encode(txn_hash, 'hex') AS tx_hash,
                encode(sender_address, 'hex') AS sender_address,
                encode(recipient_address, 'hex') AS recipient_address,
                chain_id,
                destination_chain,
                nonce,
                block_height,
                timestamp_ms,
                token_id,
                amount,
                is_finalized
            FROM token_transfer_data
            WHERE
                txn_hash = decode(${hexTx}, 'hex')`

        const tokendata = queryTokenData?.[0]

        if (!tokendata) {
            sendError(res, { code: 404, message: `Cannot find tx ${req.query.tx}` })
            return
        }

        const queryTokenTransfers = await db[networkConfig.network]`
                SELECT
                	encode(txn_hash, 'hex') AS tx_hash,
                	encode(txn_sender, 'hex') AS txn_sender,
                	chain_id,
                    nonce,
                    status,
                	block_height,
                	timestamp_ms,
                    gas_usage,
                    data_source,
                	nonce,
                    is_finalized
                FROM token_transfer
                WHERE
                	nonce=${tokendata?.nonce} AND chain_id=${tokendata?.chain_id}`

        const prices = await getPrices(networkConfig.network)

        // The sender's other bridge activity, and what is normal for this direction
        const senderHex = tokendata.sender_address as string
        const [senderStats, recentRows, typical] = await Promise.all([
            db[networkConfig.network]`
                SELECT
                    COUNT(*) AS count,
                    COALESCE(SUM((t.amount::NUMERIC / NULLIF(p.denominator, 0)) * p.price::NUMERIC), 0) AS usd
                FROM token_transfer_data t
                LEFT JOIN prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true AND t.sender_address = decode(${senderHex}, 'hex')`,
            db[networkConfig.network]`
                SELECT
                    encode(txn_hash, 'hex') AS tx_hash,
                    encode(sender_address, 'hex') AS sender_address,
                    encode(recipient_address, 'hex') AS recipient_address,
                    chain_id, destination_chain, nonce, block_height, timestamp_ms, token_id, amount
                FROM token_transfer_data
                WHERE is_finalized = true
                    AND sender_address = decode(${senderHex}, 'hex')
                    AND NOT (chain_id = ${tokendata.chain_id} AND nonce = ${tokendata.nonce})
                ORDER BY timestamp_ms DESC
                LIMIT 5`,
            getTypicalLatency(networkConfig.network, Number(tokendata.chain_id)),
        ])

        const history = transformHistory(queryTokenTransfers as any[])

        sendReply(res, {
            history,
            tx: transformTransfers(networkConfig, [tokendata] as any, prices)?.[0],
            typical,
            sender: {
                transfer_count: Number(senderStats[0]?.count) || 0,
                total_usd: Number(senderStats[0]?.usd) || 0,
                recent: transformTransfers(networkConfig, recentRows as any, prices),
            },
        })
    } catch (error) {
        console.error('Transaction API error:', error)
        sendError(res, {
            code: 500,
            message: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
    }
}
