import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { TimePeriod, getNetworkConfig, INetworkConfig } from 'src/config/helper'
import { transformAmount } from 'src/utils/helper'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'

dayjs.extend(isoWeek)
dayjs.extend(weekOfYear)

export const calculateStartDate = (timePeriod: string) => {
    switch (timePeriod) {
        case 'Last 24h':
            return dayjs().subtract(1, 'day').valueOf()
        case 'Last Week':
            return dayjs().subtract(7, 'day').valueOf()
        case 'Last Month':
            return dayjs().subtract(30, 'day').valueOf()
        case 'Year to date':
            return dayjs().subtract(365, 'day').valueOf()
        case 'All time':
            return dayjs().subtract(1000, 'day').valueOf()
        default:
            return dayjs().subtract(30, 'day').valueOf()
    }
}

const getInflows = (networkConfig: INetworkConfig, timePeriod: TimePeriod) =>
    db[networkConfig.network]`
        SELECT
            destination_chain,
            token_id,
            COUNT(*) AS total_count,
            SUM(amount) AS total_volume
        FROM
            public.token_transfer_data
        WHERE
            destination_chain = ${networkConfig.config.networkId.SUI}
            AND is_finalized = true
            AND timestamp_ms >= ${calculateStartDate(timePeriod)}
        GROUP BY
            destination_chain,
            token_id
    `.then(query => transformAmount(networkConfig, query as any[]))

const getOutflows = (networkConfig: INetworkConfig, timePeriod: TimePeriod) =>
    db[networkConfig.network]`
        SELECT
            destination_chain,
            token_id,
            COUNT(*) AS total_count,
            SUM(amount) AS total_volume
        FROM
            public.token_transfer_data
        WHERE
            destination_chain = ${networkConfig.config.networkId.ETH}
            AND is_finalized = true
            AND timestamp_ms >= ${calculateStartDate(timePeriod)}
        GROUP by
            destination_chain,
            token_id
    `.then(query => transformAmount(networkConfig, query as any[]))

const getVolume = (networkConfig: INetworkConfig, timePeriod: TimePeriod) =>
    db[networkConfig.network]`
        SELECT
            token_id,
            COUNT(*) AS total_count,
            SUM(amount) AS total_volume
        FROM
            public.token_transfer_data
        WHERE
            is_finalized = true
            AND timestamp_ms >= ${calculateStartDate(timePeriod)}
        GROUP by
            token_id
    `.then(query => transformAmount(networkConfig, query as any[]))

const getAddresses = (networkConfig: INetworkConfig, timePeriod: TimePeriod) =>
    db[networkConfig.network]`
        SELECT
            token_id,
            COUNT(DISTINCT address) AS total_unique_addresses
        FROM (
            SELECT
                token_id,
                encode(sender_address, 'hex') AS address
            FROM
                public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms >= ${calculateStartDate(timePeriod)}

            UNION

            SELECT
                token_id,
                encode(recipient_address, 'hex') AS address
            FROM
                public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms >= ${calculateStartDate(timePeriod)}

        ) AS unique_addresses
        GROUP BY token_id
    `.then(query => transformAmount(networkConfig, query as any[]))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const timePeriod = req.query.timePeriod as TimePeriod

        const [inflows, outflows, volume, addresses] = await Promise.all([
            getInflows(networkConfig, timePeriod),
            getOutflows(networkConfig, timePeriod),
            getVolume(networkConfig, timePeriod),
            getAddresses(networkConfig, timePeriod),
        ])

        sendReply(res, {
            inflows,
            outflows,
            volume,
            addresses,
        })
    } catch (error) {
        sendError(res, error)
    }
}
