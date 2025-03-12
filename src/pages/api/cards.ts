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

export const calculateStartDate = (timePeriod: string, currentDate?: dayjs.Dayjs) => {
    let day = currentDate || dayjs()
    switch (timePeriod) {
        case 'Last 24h':
            return day.subtract(1, 'day').valueOf()
        case 'Last Week':
            return day.subtract(7, 'day').valueOf()
        case 'Last Month':
            return day.subtract(30, 'day').valueOf()
        case 'Last year':
            return day.subtract(365, 'day').valueOf()
        case 'All time':
            return day.subtract(1000, 'day').valueOf()
        default:
            return day.subtract(30, 'day').valueOf()
    }
}

export const computerIntervals = (timePeriod: TimePeriod, computePrevious?: boolean) => {
    const startDate = calculateStartDate(timePeriod)

    const fromInterval = computePrevious
        ? calculateStartDate(timePeriod, dayjs(startDate))
        : startDate
    const toInterval = computePrevious ? startDate : new Date().getTime()

    return { fromInterval, toInterval }
}

const getInflows = (
    networkConfig: INetworkConfig,
    timePeriod: TimePeriod,
    computePrevious?: boolean,
) => {
    const { fromInterval, toInterval } = computerIntervals(timePeriod, computePrevious)

    return db[networkConfig.network]`
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
            AND timestamp_ms >= ${fromInterval}
            AND timestamp_ms <= ${toInterval}
        GROUP BY
            destination_chain,
            token_id
    `.then(query => transformAmount(networkConfig, query as any[]))
}

const getOutflows = (
    networkConfig: INetworkConfig,
    timePeriod: TimePeriod,
    computePrevious?: boolean,
) => {
    const { fromInterval, toInterval } = computerIntervals(timePeriod, computePrevious)
    return db[networkConfig.network]`
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
            AND timestamp_ms >= ${fromInterval}
            AND timestamp_ms <= ${toInterval}
        GROUP by
            destination_chain,
            token_id
    `.then(query => transformAmount(networkConfig, query as any[]))
}

// const getVolume = (networkConfig: INetworkConfig, timePeriod: TimePeriod) =>
//     db[networkConfig.network]`
//         SELECT
//             token_id,
//             COUNT(*) AS total_count,
//             SUM(amount) AS total_volume
//         FROM
//             public.token_transfer_data
//         WHERE
//             is_finalized = true
//             AND timestamp_ms >= ${calculateStartDate(timePeriod)}
//         GROUP by
//             token_id
//     `.then(query => transformAmount(networkConfig, query as any[]))

const getAddresses = (
    networkConfig: INetworkConfig,
    timePeriod: TimePeriod,
    computePrevious?: boolean,
) => {
    const { fromInterval, toInterval } = computerIntervals(timePeriod, computePrevious)
    return db[networkConfig.network]`
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
                AND timestamp_ms >= ${fromInterval}
                AND timestamp_ms <= ${toInterval}

            UNION

            SELECT
                token_id,
                encode(recipient_address, 'hex') AS address
            FROM
                public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms >= ${fromInterval}
                AND timestamp_ms <= ${toInterval}

        ) AS unique_addresses
        GROUP BY token_id
    `.then(query => transformAmount(networkConfig, query as any[]))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const timePeriod = req.query.timePeriod as TimePeriod

        const [inflows, outflows, addresses, previousInflows, previousOutflows, previousAddresses] =
            await Promise.all([
                getInflows(networkConfig, timePeriod),
                getOutflows(networkConfig, timePeriod),
                getAddresses(networkConfig, timePeriod),
                getInflows(networkConfig, timePeriod, true),
                getOutflows(networkConfig, timePeriod, true),
                getAddresses(networkConfig, timePeriod, true),
            ])

        sendReply(res, {
            inflows,
            outflows,
            addresses,
            previousInflows,
            previousOutflows,
            previousAddresses,
        })
    } catch (error) {
        sendError(res, error)
    }
}
