import { withCache } from 'src/utils/api-cache'
import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './database'
import { TimePeriod, getNetworkConfig, INetworkConfig, IPrice } from 'src/config/helper'
import { transformAmount } from 'src/utils/helper'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { getPrices } from './prices'
import { ALL_TIME_START } from 'src/utils/format-chart-data'

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
        case 'Last 6 months':
            return day.subtract(6, 'month').valueOf()
        case 'Last year':
            return day.subtract(365, 'day').valueOf()
        case 'All time':
            return dayjs(ALL_TIME_START).valueOf()
        default:
            return day.subtract(30, 'day').valueOf()
    }
}

export const computerIntervals = (timePeriod: TimePeriod, computePrevious?: boolean) => {
    const startDate = calculateStartDate(timePeriod)

    // "All time" has no preceding period: return an empty window so comparisons show no change
    if (computePrevious && timePeriod === 'All time') {
        return { fromInterval: startDate, toInterval: startDate }
    }

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

const getAddresses = (
    networkConfig: INetworkConfig,
    prices: IPrice[],
    timePeriod: TimePeriod,
    computePrevious?: boolean,
) => {
    const { fromInterval, toInterval } = computerIntervals(timePeriod, computePrevious)

    const { SUI, ETH } = networkConfig.config.networkId

    // Every finalized transfer contributes its sender and its recipient, so the
    // set of unique addresses is simply all senders plus all recipients. One
    // scan of the table with GROUPING SETS yields both the per-token counts and
    // the overall total (the NULL token_id row), instead of two queries that
    // each UNION four overlapping scans.
    return db[networkConfig.network]`
        WITH transfers AS (
            SELECT token_id, sender_address, recipient_address
            FROM public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                AND destination_chain IN (${SUI}, ${ETH})
        ),
        addresses AS (
            SELECT token_id, sender_address AS address
            FROM transfers WHERE sender_address IS NOT NULL
            UNION ALL
            SELECT token_id, recipient_address AS address
            FROM transfers WHERE recipient_address IS NOT NULL
        )
        SELECT
            COALESCE(token_id, -1) AS token_id,
            COUNT(DISTINCT address) AS total_unique_addresses
        FROM addresses
        GROUP BY GROUPING SETS ((token_id), ())
    `.then(rows => transformAmount(networkConfig, rows as any[], prices))
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

export default withCache(handler, 60)
