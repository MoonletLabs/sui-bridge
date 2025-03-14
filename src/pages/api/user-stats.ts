import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import {
    buildConditionalQuery,
    computeStats,
    isHexadecimal,
    removePrefix,
    transformTransfers,
} from 'src/utils/helper'
import db from './dabatase'
import { sendError, sendReply } from './utils'

// New helper that builds an SQL fragment using the tagged template literal.
// We pass in the sql tag function so that we use the proper instance for your network.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

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

        if (!suiAddress && !ethAddress) {
            sendError(res, {
                code: 400,
                message: 'you must provide at least one valid address',
            })
            return
        }

        // Get the SQL tag function for the active network.
        const sql = db[networkConfig.network]

        // Build the dynamic condition fragment using our helper.
        const conditionalQuery = buildConditionalQuery(sql, { suiAddress, ethAddress })

        // Use the dynamic fragment in your main query.
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
                  is_finalized = true ${conditionalQuery}`

        sendReply(res, computeStats(transformTransfers(networkConfig, query as any[]) as any[]))
    } catch (error) {
        console.log({ error })
        sendError(res, error)
    }
}
