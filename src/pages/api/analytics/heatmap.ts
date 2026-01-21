import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../utils'
import db from '../database'
import { computerIntervals } from '../cards'

type MetricType = 'volume' | 'count' | 'volume_usd'
type FlowType = 'all' | 'inflow' | 'outflow'

// Adaptive layouts per time period:
// - Last 24h: 1 row × 24 columns (hourly view in UTC)
// - Last Week: 7 rows × 6 columns (days Mon-Sun × 4-hour intervals)
// - Last Month: 5 rows × 7 columns (weeks × days of week Mon-Sun)
// - Last 6 months/Last year/All time: 7 rows × N months (days of week × months)

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// 24-hour format labels with minutes
const HOUR_LABELS = [
    '00:00',
    '01:00',
    '02:00',
    '03:00',
    '04:00',
    '05:00',
    '06:00',
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
    '23:00',
]

// 4-hour interval labels with minutes
const TIME_INTERVAL_LABELS = [
    '00:00-04:00',
    '04:00-08:00',
    '08:00-12:00',
    '12:00-16:00',
    '16:00-20:00',
    '20:00-24:00',
]

// Convert PostgreSQL DOW (0=Sunday) to Monday-first (0=Monday)
const pgDowToMondayFirst = (dow: number): number => {
    return dow === 0 ? 6 : dow - 1
}

// Determine view type based on time period
const getViewType = (timePeriod: TimePeriod): 'hourly' | 'daily' | 'monthly' | 'timeline' => {
    if (timePeriod === 'Last 24h') return 'hourly'
    if (timePeriod === 'Last Week') return 'daily'
    if (timePeriod === 'Last Month') return 'monthly'
    return 'timeline'
}

// Generate month labels for a date range
const generateMonthLabels = (fromMs: number, toMs: number): string[] => {
    const labels: string[] = []
    const startDate = new Date(fromMs)
    const endDate = new Date(toMs)

    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
        const month = currentDate.toLocaleString('en-US', { month: 'short' })
        const year = currentDate.getFullYear().toString().slice(-2)
        labels.push(`${month} '${year}`)
        currentDate.setMonth(currentDate.getMonth() + 1)
    }

    return labels
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const metric = (req.query.metric as MetricType) || 'volume_usd'
        const tokenId = req.query.token_id ? Number(req.query.token_id) : undefined
        const flow = (req.query.flow as FlowType) || 'all'

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const viewType = getViewType(timePeriod)

        const sql = db[networkConfig.network]

        // Build flow condition
        let flowCondition = sql``
        if (flow === 'inflow') {
            flowCondition = sql`AND destination_chain = ${networkConfig.config.networkId.SUI}`
        } else if (flow === 'outflow') {
            flowCondition = sql`AND destination_chain = ${networkConfig.config.networkId.ETH}`
        }

        // Build token condition
        let tokenCondition = sql``
        if (tokenId !== undefined) {
            tokenCondition = sql`AND t.token_id = ${tokenId}`
        }

        if (viewType === 'hourly') {
            // Last 24h: rolling window using UTC for consistency with other views
            // - Start = ceil(fromInterval to next full UTC hour)
            // - End (exclusive) = floor(toInterval to UTC hour) (current partial hour excluded)
            const HOUR_MS = 60 * 60 * 1000

            const ceilToUTCHour = (ms: number): number => {
                const floored = Math.floor(ms / HOUR_MS) * HOUR_MS
                return floored === ms ? floored : floored + HOUR_MS
            }
            const floorToUTCHour = (ms: number): number => {
                return Math.floor(ms / HOUR_MS) * HOUR_MS
            }
            const formatUTCHourLabel = (ms: number): string => {
                const h = new Date(ms).getUTCHours()
                return `${String(h).padStart(2, '0')}:00`
            }

            const windowStartMs = ceilToUTCHour(fromInterval)
            const windowEndExclusiveMs = floorToUTCHour(toInterval)

            const bucketCount = Math.max(
                0,
                Math.floor((windowEndExclusiveMs - windowStartMs) / HOUR_MS),
            )
            const cols: string[] = Array.from({ length: bucketCount }, (_, i) =>
                formatUTCHourLabel(windowStartMs + i * HOUR_MS),
            )

            const formatUTCDate = (ms: number): string => {
                const d = new Date(ms)
                const day = d.getUTCDate()
                const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
                return `${day} ${month}`
            }

            const periodLabel =
                cols.length > 0
                    ? `${formatUTCDate(windowStartMs)} ${cols[0]} - ${formatUTCDate(windowEndExclusiveMs - HOUR_MS)} ${cols[cols.length - 1]} (UTC)`
                    : timePeriod

            const query = await sql`
                SELECT
                    (EXTRACT(EPOCH FROM DATE_TRUNC('hour', TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC')) * 1000)::BIGINT AS hour_bucket_ms,
                    COUNT(*) AS tx_count,
                    SUM(t.amount) AS total_volume,
                    SUM((t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8)) AS total_volume_usd
                FROM token_transfer_data AS t
                JOIN prices AS p ON t.token_id = p.token_id
                WHERE
                    t.is_finalized = true
                    AND t.timestamp_ms >= ${windowStartMs}
                    AND t.timestamp_ms < ${windowEndExclusiveMs}
                    ${flowCondition}
                    ${tokenCondition}
                GROUP BY
                    DATE_TRUNC('hour', TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC')
                ORDER BY hour_bucket_ms
            `

            // Build 1×N matrix (single row with N hours)
            const matrix: number[][] = [Array(cols.length).fill(0)]

            let total = 0
            for (const row of query) {
                const bucketMs = Number(row.hour_bucket_ms)
                const colIndex = Math.floor((bucketMs - windowStartMs) / HOUR_MS)
                if (colIndex < 0 || colIndex >= cols.length) continue

                let value: number
                switch (metric) {
                    case 'count':
                        value = Number(row.tx_count)
                        break
                    case 'volume':
                        value = Number(row.total_volume)
                        break
                    case 'volume_usd':
                    default:
                        value = Number(row.total_volume_usd) || 0
                }

                matrix[0][colIndex] += value
                total += value
            }

            // Find peak and quietest (window already excludes current incomplete hour)
            let peakValue = 0,
                peakCol = 0
            let quietestValue = Infinity,
                quietestCol = 0

            for (let col = 0; col < cols.length; col++) {
                const value = matrix[0][col]
                if (value > peakValue) {
                    peakValue = value
                    peakCol = col
                }
                if (value < quietestValue) {
                    quietestValue = value
                    quietestCol = col
                }
            }

            if (quietestValue === Infinity) quietestValue = 0

            sendReply(res, {
                viewType: 'hourly',
                matrix,
                labels: {
                    rows: ['Activity'],
                    cols,
                },
                summary: {
                    peak_row: 0,
                    peak_row_label: '',
                    peak_col: peakCol,
                    peak_col_label: cols[peakCol],
                    peak_value: peakValue,
                    quietest_row: 0,
                    quietest_row_label: '',
                    quietest_col: quietestCol,
                    quietest_col_label: cols[quietestCol],
                    quietest_value: quietestValue,
                    total,
                },
                period: periodLabel,
                metric,
            })
        } else if (viewType === 'daily') {
            // Last Week: 7 rows (days Mon-Sun) × 6 columns (4-hour intervals)
            // Y-axis: Days (Mon-Sun) - swapped for better readability
            // X-axis: Time intervals (00:00-04:00, etc.)
            const now = new Date()
            const currentHourUTC = now.getUTCHours()
            const currentTimeInterval = Math.floor(currentHourUTC / 4) // 0-5
            const currentDayRowIndex = pgDowToMondayFirst(now.getUTCDay())

            const query = await sql`
                SELECT
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') AS day_of_week,
                    FLOOR(EXTRACT(HOUR FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') / 4) AS time_interval,
                    COUNT(*) AS tx_count,
                    SUM(t.amount) AS total_volume,
                    SUM((t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8)) AS total_volume_usd
                FROM token_transfer_data AS t
                JOIN prices AS p ON t.token_id = p.token_id
                WHERE
                    t.is_finalized = true
                    AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                    ${flowCondition}
                    ${tokenCondition}
                GROUP BY
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC'),
                    FLOOR(EXTRACT(HOUR FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') / 4)
                ORDER BY day_of_week, time_interval
            `

            // Build 7×6 matrix (7 days × 6 time intervals) - axes swapped
            const matrix: number[][] = Array(7)
                .fill(null)
                .map(() => Array(6).fill(0))

            let total = 0
            for (const row of query) {
                const pgDow = Number(row.day_of_week)
                const day = pgDowToMondayFirst(pgDow)
                const timeInterval = Number(row.time_interval)

                if (timeInterval < 0 || timeInterval > 5) continue

                let value: number
                switch (metric) {
                    case 'count':
                        value = Number(row.tx_count)
                        break
                    case 'volume':
                        value = Number(row.total_volume)
                        break
                    case 'volume_usd':
                    default:
                        value = Number(row.total_volume_usd) || 0
                }

                // Swapped: day is now row, timeInterval is now column
                matrix[day][timeInterval] += value
                total += value
            }

            // Find peak and quietest (exclude current day's current/future interval)
            let peakValue = 0,
                peakCol = 0,
                peakRow = 0
            let quietestValue = Infinity,
                quietestCol = 0,
                quietestRow = 0

            for (let day = 0; day < 7; day++) {
                for (let interval = 0; interval < 6; interval++) {
                    if (day === currentDayRowIndex && interval >= currentTimeInterval) continue

                    const value = matrix[day][interval]
                    if (value > peakValue) {
                        peakValue = value
                        peakRow = day
                        peakCol = interval
                    }
                    if (value < quietestValue) {
                        quietestValue = value
                        quietestRow = day
                        quietestCol = interval
                    }
                }
            }

            if (quietestValue === Infinity) quietestValue = 0

            sendReply(res, {
                viewType: 'daily',
                matrix,
                labels: {
                    rows: DAY_LABELS, // Days on Y-axis
                    cols: TIME_INTERVAL_LABELS, // Time intervals on X-axis
                },
                summary: {
                    peak_row: peakRow,
                    peak_row_label: DAY_LABELS[peakRow],
                    peak_col: peakCol,
                    peak_col_label: TIME_INTERVAL_LABELS[peakCol],
                    peak_value: peakValue,
                    quietest_row: quietestRow,
                    quietest_row_label: DAY_LABELS[quietestRow],
                    quietest_col: quietestCol,
                    quietest_col_label: TIME_INTERVAL_LABELS[quietestCol],
                    quietest_value: quietestValue,
                    total,
                },
                period: timePeriod,
                metric,
            })
        } else if (viewType === 'monthly') {
            // Last Month: 5 rows (weeks) × 7 columns (days of week Mon-Sun)
            // Y-axis: Week 1-5 (weeks of the month period)
            // X-axis: Days of week (Mon-Sun)
            // This aggregates activity by day-of-week across weeks for pattern visibility

            const now = new Date()
            const currentDayOfWeek = pgDowToMondayFirst(now.getUTCDay())

            // Calculate week boundaries for the 5-week period
            const WEEK_MS = 7 * 24 * 60 * 60 * 1000
            const weekBoundaries: { start: number; end: number; label: string }[] = []

            for (let w = 4; w >= 0; w--) {
                const weekStartMs = toInterval - (w + 1) * WEEK_MS
                const weekEndMs = toInterval - w * WEEK_MS
                const startDate = new Date(weekStartMs)
                const endDate = new Date(weekEndMs - 1)
                const startLabel = `${startDate.getUTCDate()} ${startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`
                const endLabel = `${endDate.getUTCDate()} ${endDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`
                weekBoundaries.push({
                    start: weekStartMs,
                    end: weekEndMs,
                    label: `${startLabel}-${endLabel}`,
                })
            }

            const currentWeekIndex = 4 // Current week is always the last one

            // Query by day of week and date, then map to weeks in JS
            const query = await sql`
                SELECT
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') AS day_of_week,
                    TO_CHAR(TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_str,
                    MIN(t.timestamp_ms) AS min_timestamp_ms,
                    COUNT(*) AS tx_count,
                    SUM(t.amount) AS total_volume,
                    SUM((t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8)) AS total_volume_usd
                FROM token_transfer_data AS t
                JOIN prices AS p ON t.token_id = p.token_id
                WHERE
                    t.is_finalized = true
                    AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                    ${flowCondition}
                    ${tokenCondition}
                GROUP BY
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC'),
                    TO_CHAR(TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
                ORDER BY date_str, day_of_week
            `

            // Build 5×7 matrix (5 weeks × 7 days)
            // Row 0 = oldest week (4 weeks ago), Row 4 = current week
            const matrix: number[][] = Array(5)
                .fill(null)
                .map(() => Array(7).fill(0))
            const weekLabels = weekBoundaries.map(w => w.label)

            let total = 0
            for (const row of query) {
                const pgDow = Number(row.day_of_week)
                const dayOfWeek = pgDowToMondayFirst(pgDow)
                const timestampMs = Number(row.min_timestamp_ms)

                // Find which week this date belongs to
                let weekIndex = -1
                for (let i = 0; i < weekBoundaries.length; i++) {
                    if (
                        timestampMs >= weekBoundaries[i].start &&
                        timestampMs < weekBoundaries[i].end
                    ) {
                        weekIndex = i
                        break
                    }
                }

                if (weekIndex < 0 || weekIndex > 4 || dayOfWeek < 0 || dayOfWeek > 6) continue

                let value: number
                switch (metric) {
                    case 'count':
                        value = Number(row.tx_count)
                        break
                    case 'volume':
                        value = Number(row.total_volume)
                        break
                    case 'volume_usd':
                    default:
                        value = Number(row.total_volume_usd) || 0
                }

                matrix[weekIndex][dayOfWeek] += value
                total += value
            }

            // Find peak and quietest (excluding current week's future days)
            let peakValue = 0,
                peakCol = 0,
                peakRow = 0
            let quietestValue = Infinity,
                quietestCol = 0,
                quietestRow = 0

            for (let week = 0; week < 5; week++) {
                for (let day = 0; day < 7; day++) {
                    // Skip future days in current week
                    if (week === currentWeekIndex && day > currentDayOfWeek) continue

                    const value = matrix[week][day]
                    if (value > peakValue) {
                        peakValue = value
                        peakRow = week
                        peakCol = day
                    }
                    if (value < quietestValue) {
                        quietestValue = value
                        quietestRow = week
                        quietestCol = day
                    }
                }
            }

            if (quietestValue === Infinity) quietestValue = 0

            sendReply(res, {
                viewType: 'monthly',
                matrix,
                labels: {
                    rows: weekLabels, // Week date ranges on Y-axis
                    cols: DAY_LABELS, // Days of week on X-axis
                },
                summary: {
                    peak_row: peakRow,
                    peak_row_label: weekLabels[peakRow] || '',
                    peak_col: peakCol,
                    peak_col_label: DAY_LABELS[peakCol],
                    peak_value: peakValue,
                    quietest_row: quietestRow,
                    quietest_row_label: weekLabels[quietestRow] || '',
                    quietest_col: quietestCol,
                    quietest_col_label: DAY_LABELS[quietestCol],
                    quietest_value: quietestValue,
                    total,
                },
                period: timePeriod,
                metric,
            })
        } else {
            // Timeline view: Days of Week × Months (Last 6mo, Last year, All time)
            // Y-axis: Days of week (Mon-Sun) - shows which days are busiest each month
            // X-axis: Months
            // This reveals patterns like "Mondays are consistently busy" or "Weekends are quiet"
            const allMonthLabels = generateMonthLabels(fromInterval, toInterval)

            const query = await sql`
                SELECT
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') AS day_of_week,
                    EXTRACT(MONTH FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') AS month,
                    EXTRACT(YEAR FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC') AS year,
                    COUNT(*) AS tx_count,
                    SUM(t.amount) AS total_volume,
                    SUM((t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8)) AS total_volume_usd
                FROM token_transfer_data AS t
                JOIN prices AS p ON t.token_id = p.token_id
                WHERE
                    t.is_finalized = true
                    AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                    ${flowCondition}
                    ${tokenCondition}
                GROUP BY
                    EXTRACT(DOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC'),
                    EXTRACT(MONTH FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC'),
                    EXTRACT(YEAR FROM TO_TIMESTAMP(t.timestamp_ms / 1000) AT TIME ZONE 'UTC')
                ORDER BY year, month, day_of_week
            `

            // Take last 12 months (or fewer if less data)
            const monthsToShow = Math.min(allMonthLabels.length, 12)
            const monthLabels = allMonthLabels.slice(-monthsToShow)

            // Create a map of "MMM 'YY" -> column index
            const monthToCol: Record<string, number> = {}
            monthLabels.forEach((label, idx) => {
                monthToCol[label] = idx
            })

            // Build 7 rows (days of week) × monthsToShow cols (months) matrix
            const matrix: number[][] = Array(7)
                .fill(null)
                .map(() => Array(monthsToShow).fill(0))

            let total = 0
            for (const row of query) {
                const pgDow = Number(row.day_of_week)
                const dayOfWeek = pgDowToMondayFirst(pgDow) // Convert to Monday-first (0-6)
                const month = Number(row.month)
                const year = Number(row.year)

                // Create label to match
                const date = new Date(year, month - 1, 1)
                const monthStr = date.toLocaleString('en-US', { month: 'short' })
                const yearStr = year.toString().slice(-2)
                const label = `${monthStr} '${yearStr}`

                const col = monthToCol[label]
                if (col === undefined) continue // Skip months outside our window

                let value: number
                switch (metric) {
                    case 'count':
                        value = Number(row.tx_count)
                        break
                    case 'volume':
                        value = Number(row.total_volume)
                        break
                    case 'volume_usd':
                    default:
                        value = Number(row.total_volume_usd) || 0
                }

                matrix[dayOfWeek][col] += value
                total += value
            }

            // Find peak and quietest
            let peakValue = 0,
                peakCol = 0,
                peakRow = 0
            let quietestValue = Infinity,
                quietestCol = 0,
                quietestRow = 0

            for (let day = 0; day < 7; day++) {
                for (let col = 0; col < monthsToShow; col++) {
                    const value = matrix[day][col]
                    if (value > peakValue) {
                        peakValue = value
                        peakCol = col
                        peakRow = day
                    }
                    if (value < quietestValue) {
                        quietestValue = value
                        quietestCol = col
                        quietestRow = day
                    }
                }
            }

            if (quietestValue === Infinity) quietestValue = 0

            sendReply(res, {
                viewType: 'timeline',
                matrix,
                labels: {
                    rows: DAY_LABELS, // Days of week on Y-axis
                    cols: monthLabels, // Months on X-axis
                },
                summary: {
                    peak_row: peakRow,
                    peak_row_label: DAY_LABELS[peakRow],
                    peak_col: peakCol,
                    peak_col_label: monthLabels[peakCol] || '',
                    peak_value: peakValue,
                    quietest_row: quietestRow,
                    quietest_row_label: DAY_LABELS[quietestRow],
                    quietest_col: quietestCol,
                    quietest_col_label: monthLabels[quietestCol] || '',
                    quietest_value: quietestValue,
                    total,
                },
                period: timePeriod,
                metric,
            })
        }
    } catch (error) {
        console.error('Heatmap API error:', error)
        sendError(res, error)
    }
}
