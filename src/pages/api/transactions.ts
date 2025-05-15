import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import {
    buildConditionalQuery,
    isHexadecimal,
    removePrefix,
    transformTransfers,
} from 'src/utils/helper'
import db from './database'
import { sendError, sendReply } from './utils'
import { getPrices } from './prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const offset = req.query.offset || 0
        const limit = Math.min(Number(req.query.limit) || 100, 100) // max 100 items

        const suiAddress = removePrefix(req.query.suiAddress?.toString() || '')
        const ethAddress = removePrefix(req.query.ethAddress?.toString() || '')
        const flow = (req.query.flow as 'all' | 'inflow' | 'outflow') || 'all'
        const senders = (req.query.senders?.toString() || '')
            .split(',')
            .map(s => removePrefix(s))
            .filter(s => s.length > 0)

        const recipients = (req.query.recipients?.toString() || '')
            .split(',')
            .map(r => removePrefix(r))
            .filter(r => r.length > 0)

        const amountFrom = req.query.amount_from ? Number(req.query.amount_from) : undefined
        const amountTo = req.query.amount_to ? Number(req.query.amount_to) : undefined

        if (
            (suiAddress && !isHexadecimal(suiAddress)) ||
            (ethAddress && !isHexadecimal(ethAddress))
        ) {
            sendError(res, {
                code: 400,
                message: 'you must provide valid addresses',
            })
            return
        }

        const sql = db[networkConfig.network]

        const conditionalQuery = buildConditionalQuery(
            sql,
            {
                suiAddress,
                ethAddress,
                flow,
                senders,
                recipients,
                amountFrom,
                amountTo,
            },
            networkConfig,
        )

        const query = await sql`
            SELECT
                encode(t.txn_hash, 'hex')           AS tx_hash,
                encode(t.sender_address, 'hex')     AS sender_address,
                encode(t.recipient_address, 'hex')  AS recipient_address,
                t.chain_id,
                t.destination_chain,
                t.nonce,
                t.block_height,
                t.timestamp_ms,
                t.token_id,
                t.amount,
                p.price,
                (t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8) AS amount_usd
            FROM token_transfer_data AS t
            JOIN prices AS p
                ON t.token_id = p.token_id
            WHERE
                is_finalized = true ${conditionalQuery}
            ORDER BY timestamp_ms DESC
            OFFSET ${offset} LIMIT ${limit}`

        const queryCount = await sql`
            SELECT COUNT(*)
            FROM token_transfer_data AS t
            JOIN prices AS p
                ON t.token_id = p.token_id
            WHERE is_finalized = true ${conditionalQuery}`

        sendReply(res, {
            transactions: transformTransfers(networkConfig, query as any[]),
            total: Number(queryCount?.[0]?.count),
        })
    } catch (error) {
        console.log({ error })
        sendError(res, error)
    }
}
