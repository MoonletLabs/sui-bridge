import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { TokenColorInfo } from './types'
import { TimeInterval, TimePeriod } from 'src/config/helper'
dayjs.extend(isoWeek)
dayjs.extend(weekOfYear)

type ApiDataItem = {
    transfer_date: string
    token_info: {
        name: string
    }
    total_volume: number
    total_volume_usd: number
}

export type ChartDataItem = {
    name: string
    color: string
    data: { period: string; value: number }[]
}

export function formatChartData(
    apiData: ApiDataItem[],
    selectedSeries: TimeInterval,
    tokensList: TokenColorInfo[],
    timePeriod: TimePeriod,
) {
    const groupedData: { [key: string]: { [token: string]: number } } = {}
    const now = dayjs()
    const startDate = calculateStartDate(timePeriod)

    // Determine number of hours needed
    const totalHours = timePeriod === 'Last Week' && selectedSeries === 'Hourly' ? 168 : 24
    const fullHours = Array.from({ length: totalHours }, (_, i) =>
        now.subtract(totalHours - 1 - i, 'hour').format('YYYY-MM-DD HH:00'),
    )

    apiData.forEach(item => {
        const date = dayjs(item.transfer_date)
        let periodKey: string

        if (selectedSeries === 'Hourly') {
            if (date.isAfter(startDate)) {
                periodKey = date.format('YYYY-MM-DD HH:00')
            } else {
                return
            }
        } else if (selectedSeries === 'Weekly') {
            periodKey = `${date.isoWeekYear()}-W${date.isoWeek()}` // FIXED
        } else if (selectedSeries === 'Monthly') {
            periodKey = date.format('YYYY-MM') // Group by month
        } else {
            periodKey = date.format('YYYY-MM-DD') // Group by day
        }

        if (!groupedData[periodKey]) groupedData[periodKey] = {}
        if (!groupedData[periodKey][item.token_info.name])
            groupedData[periodKey][item.token_info.name] = 0

        groupedData[periodKey][item.token_info.name] += item.total_volume_usd
    })

    const tokens = Array.from(new Set(apiData.map(item => item.token_info.name)))
    const periods = selectedSeries === 'Hourly' ? fullHours : Object.keys(groupedData).sort()

    const chartData: ChartDataItem[] = tokens.map(token => {
        const colorData = tokensList.find(info => info.ticker === token)
        return {
            name: token,
            color: colorData?.color || '#000000', // Default color if not found
            data: periods.map(period => ({
                period,
                value: parseFloat(((groupedData[period] ?? {})[token] || 0).toFixed(6)),
            })),
        }
    })

    return chartData
}

export const formatCategories = (data: ChartDataItem[], timePeriod: string) => {
    if (!data.length) return []
    return data[0].data.map(item => {
        let date

        if (timePeriod === 'Hourly') {
            return item.period
        }
        // Handle weekly format like "2024-W44"
        if (item.period.includes('-W')) {
            const [year, week] = item.period.split('-W')
            date = dayjs().year(parseInt(year)).isoWeek(parseInt(week))
        } else {
            date = dayjs(item.period) // Regular date parsing for other formats
        }
        if (timePeriod === 'Monthly') return date.format('MMM')
        if (timePeriod === 'Weekly') return `Week ${date.isoWeek()}`
        if (timePeriod === 'Yearly') return date.format('YYYY')
        if (timePeriod === 'Daily') return date.format('MMM DD')
        return item.period
    })
}

export const calculateStartDate = (timePeriod: string) => {
    switch (timePeriod) {
        case 'Last 24h':
            return dayjs().subtract(1, 'day')
        case 'Last Week':
            return dayjs().subtract(7, 'day')
        case 'Last Month':
            return dayjs().subtract(30, 'day')
        case 'Last year':
            return dayjs().subtract(365, 'day')
        case 'All time':
            return dayjs().subtract(1000, 'day')
        default:
            return dayjs().subtract(30, 'day')
    }
}

export const buildTooltip = () => {
    return {
        shared: true,
        followCursor: true,
        intersect: false,
        custom: ({
            series,
            seriesIndex,
            dataPointIndex,
            w,
        }: {
            series: any
            seriesIndex: any
            dataPointIndex: any
            w: any
        }) => {
            const xLabel = w.globals.labels[dataPointIndex] || 'Unknown'
            const activeSeriesIndices = w.globals.series
                .map((_: any, i: any) => i)
                .filter((i: any) => !w.globals.collapsedSeriesIndices.includes(i))

            const tooltips = activeSeriesIndices
                .map((i: string | number) => {
                    const seriesName = w.globals.seriesNames[i] || 'Unknown'
                    let value = series[i][dataPointIndex]
                    const color = w.globals.colors[i]

                    const formattedValue =
                        value < 0
                            ? ` -$${Math.abs(Number(value.toFixed(0))).toLocaleString()}`
                            : ` $${Number(value.toFixed(0)).toLocaleString()}`
                    const textColor = value < 0 ? '#FF5630' : ''

                    return value !== undefined && value !== 0
                        ? `
                        <div style="
                            display: flex;
                            align-items: center;
                            padding: 6px;
                            background-color: rgba(255, 255, 255, 0.8); /* Transparent background */
                            color: #333;
                            border-radius: 4px;
                            text-align: left;
                            font-size: 12px;
                            border-left: 4px solid ${color};
                            margin-bottom: 4px;">
                            <span style="margin-left: 8px;"><strong>${seriesName}:</strong><span style="color: ${textColor}">${formattedValue}</span></span>
                        </div>
                    `
                        : ''
                })
                .join('')

            return tooltips.trim()
                ? `
                    <div style="
                        padding: 8px;
                        background-color: #e0e0e0;
                        border-radius: 6px;
                        box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
                        min-width: 120px;
                        text-align: left;
                        color: white;">
                        <strong style="color: black">${xLabel}</strong>
                        ${tooltips}
                    </div>
                `
                : ''
        },
    }
}
