import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { TimePeriod, getNetworkConfig, INetworkConfig, IPrice } from 'src/config/helper'
import { transformAmount } from 'src/utils/helper'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { getPrices } from './prices'

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
    prices: IPrice[],
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
    `.then(query => transformAmount(networkConfig, query as any[], prices))
}

const getOutflows = (
    networkConfig: INetworkConfig,
    prices: IPrice[],
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
    `.then(query => transformAmount(networkConfig, query as any[], prices))
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
    prices: IPrice[],
    timePeriod: TimePeriod,
    computePrevious?: boolean,
) => {
    const { fromInterval, toInterval } = computerIntervals(timePeriod, computePrevious)

    // Query to get addresses per token
    const addressesPerToken = db[networkConfig.network]`
        SELECT
            token_id,
            COUNT(DISTINCT encode(sender_address, 'hex')) AS total_unique_addresses
        FROM
            public.token_transfer_data
        WHERE
            is_finalized = true
            AND timestamp_ms >= ${fromInterval}
            AND timestamp_ms <= ${toInterval}
        GROUP BY token_id
    `

    // Query to get total unique addresses across all tokens
    const totalAddresses = db[networkConfig.network]`
        SELECT
            -1 as token_id,
            COUNT(DISTINCT encode(sender_address, 'hex')) AS total_unique_addresses
        FROM
            public.token_transfer_data
        WHERE
            is_finalized = true
            AND timestamp_ms >= ${fromInterval}
            AND timestamp_ms <= ${toInterval}
    `

    // Combine results from both queries
    return Promise.all([addressesPerToken, totalAddresses]).then(([tokenResults, totalResult]) => {
        const combinedResults = [...tokenResults, ...totalResult]
        return transformAmount(networkConfig, combinedResults as any[], prices)
    })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const timePeriod = req.query.timePeriod as TimePeriod

        const prices = await getPrices(networkConfig.network)

        const [inflows, outflows, addresses, previousInflows, previousOutflows, previousAddresses] =
            await Promise.all([
                getInflows(networkConfig, prices, timePeriod),
                getOutflows(networkConfig, prices, timePeriod),
                getAddresses(networkConfig, prices, timePeriod),
                getInflows(networkConfig, prices, timePeriod, true),
                getOutflows(networkConfig, prices, timePeriod, true),
                getAddresses(networkConfig, prices, timePeriod, true),
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
