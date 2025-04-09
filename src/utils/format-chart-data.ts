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
    meanValue?: boolean,
) {
    const groupedData: { [key: string]: { [token: string]: number } } = {}
    const groupedDataCountItems: { [key: string]: { [token: string]: number } } = {}
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
            periodKey = `${date.isoWeekYear()}-W${String(date.isoWeek()).padStart(2, '0')}`
        } else if (selectedSeries === 'Monthly') {
            periodKey = date.format('YYYY-MM') // Group by month
        } else {
            periodKey = date.format('YYYY-MM-DD') // Group by day
        }

        if (!groupedData[periodKey]) {
            groupedData[periodKey] = {}
            groupedDataCountItems[periodKey] = {}
        }
        if (!groupedData[periodKey][item.token_info.name]) {
            groupedData[periodKey][item.token_info.name] = 0
            groupedDataCountItems[periodKey][item.token_info.name] = 0
        }

        groupedData[periodKey][item.token_info.name] += item.total_volume_usd
        groupedDataCountItems[periodKey][item.token_info.name] += 1
    })

    const tokens = Array.from(new Set(apiData.map(item => item.token_info.name)))
    const periods =
        selectedSeries === 'Hourly'
            ? fullHours
            : Object.keys(groupedData).sort((a, b) => {
                  const isWeekFormat = a.includes('-W') && b.includes('-W')

                  if (isWeekFormat) {
                      const [yearA, weekA] = a.split('-W').map(Number)
                      const [yearB, weekB] = b.split('-W').map(Number)
                      return yearA !== yearB ? yearA - yearB : weekA - weekB
                  }

                  return dayjs(a).valueOf() - dayjs(b).valueOf()
              })

    const chartData: ChartDataItem[] = tokens.map(token => {
        const colorData = tokensList.find(info => info.ticker === token)
        return {
            name: token,
            color: colorData?.color || '#000000', // Default color if not found
            data: periods.map(period => ({
                period,
                value: !meanValue
                    ? parseFloat(((groupedData[period] ?? {})[token] || 0).toFixed(6))
                    : parseFloat(
                          (
                              ((groupedData[period] ?? {})[token] || 0) /
                              ((groupedDataCountItems[period] ?? {})[token] || 1)
                          ).toFixed(6),
                      ),
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

export const buildTooltip = (tootlipList: { period: string; value: number }[]) => {
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
            const label = w.globals.labels[dataPointIndex] || 'Unknown'
            let xLabel = label

            const matchedItem = tootlipList[dataPointIndex]
            if (matchedItem?.period) {
                const period = matchedItem.period

                const weekMatch = period.match(/^(\d{4})-W(\d{1,2})$/)
                const monthMatch = period.match(/^(\d{4})-(\d{1,2})$/)
                const dayMatch = period.match(/^(\d{4})-(\d{2})-(\d{2})$/)

                if (weekMatch) {
                    const year = parseInt(weekMatch[1], 10)
                    const week = parseInt(weekMatch[2], 10)
                    const start = dayjs().year(year).isoWeek(week).startOf('isoWeek')
                    const end = start.endOf('isoWeek')
                    xLabel = `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`
                } else if (monthMatch) {
                    const year = parseInt(monthMatch[1], 10)
                    const month = parseInt(monthMatch[2], 10)
                    xLabel = dayjs()
                        .year(year)
                        .month(month - 1)
                        .format('MMMM YYYY')
                } else if (dayMatch) {
                    const date = dayjs(period)
                    const day = date.date()
                    const ordinal = (n: number) =>
                        n +
                        ['th', 'st', 'nd', 'rd'][
                            n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0
                        ]
                    xLabel = `${ordinal(day)} ${date.format('MMMM YYYY')}` // → "24th April 2025"
                }
            }

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
                            : ` $${Number(value?.toFixed(0)).toLocaleString()}`
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

export const labelFormatted = (value: number) =>
    value < 0
        ? `-$${Intl.NumberFormat('en', { notation: 'compact' }).format(Math.abs(value))}`
        : `$${Intl.NumberFormat('en', { notation: 'compact' }).format(value)}`
