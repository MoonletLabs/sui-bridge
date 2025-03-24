import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import {
    buildConditionalQuery,
    isHexadecimal,
    removePrefix,
    transformTransfers,
} from 'src/utils/helper'
import db from './dabatase'
import { sendError, sendReply } from './utils'
import { getPrices } from './prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const offset = req.query.offset || 0
        const limit = Math.min(Number(req.query.limit) || 100, 100) // max 100 items

        const suiAddress = removePrefix(req.query.suiAddress?.toString() || '')
        const ethAddress = removePrefix(req.query.ethAddress?.toString() || '')

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

        const conditionalQuery = buildConditionalQuery(sql, { suiAddress, ethAddress })

        const query = await sql`
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
                  amount
                FROM token_transfer_data
                WHERE
                  is_finalized = true ${conditionalQuery}
                ORDER BY timestamp_ms DESC
                OFFSET ${offset} LIMIT ${limit}`

        const queryCount = await sql`
                SELECT COUNT(*)
                FROM token_transfer_data
                WHERE is_finalized = true ${conditionalQuery}`

        const prices = await getPrices(networkConfig.network)

        sendReply(res, {
            transactions: transformTransfers(networkConfig, query as any[], prices),
            total: Number(queryCount?.[0]?.count),
        })
    } catch (error) {
        console.log({ error })
        sendError(res, error)
    }
}
