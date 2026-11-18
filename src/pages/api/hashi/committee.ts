import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiCommittee } from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

export type HashiCommitteeResponse = Awaited<ReturnType<typeof getHashiCommittee>>

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        return sendReply(res, await getHashiCommittee(network))
    } catch (error) {
        console.error('hashi committee failed:', error)
        return sendError(res, { code: 502, message: 'Could not read the Hashi committee' })
    }
}

// The committee only changes at epoch boundaries (daily)
export default withCache(handler, 600)
