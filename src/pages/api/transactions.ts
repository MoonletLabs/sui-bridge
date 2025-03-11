import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { transformTransfers } from 'src/utils/helper'
import db from './dabatase'
import { sendError, sendReply } from './utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const offset = req.query.offset || 0
        const limit = Math.min(Number(req.query.limit) || 100, 100) // max 100 items
        /**
         * Get bridge transactions
         */

        const query = await db[networkConfig.network]`
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
                	is_finalized=true
                ORDER BY timestamp_ms 
                DESC OFFSET ${offset} LIMIT ${limit}`

        sendReply(res, transformTransfers(networkConfig, query as any[]))
    } catch (error) {
        sendError(res, error)
    }
}
