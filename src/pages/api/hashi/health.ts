import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiHealth } from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

export type { HashiHealth, HashiHealthCheck } from 'src/utils/hashi-chain'

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        return sendReply(res, await getHashiHealth(network))
    } catch (error) {
        console.error('hashi health failed:', error)
        return sendError(res, { code: 502, message: 'Could not read Hashi health' })
    }
}

export default withCache(handler, 60, { staleSeconds: 600 })
