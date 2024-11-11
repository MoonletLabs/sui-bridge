import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { TokenColorInfo } from './types'
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
    selectedSeries: 'Monthly' | 'Weekly' | 'Daily',
    tokensList: TokenColorInfo[],
) {
    const groupedData: { [key: string]: { [token: string]: number } } = {}

    apiData.forEach(item => {
        const date = dayjs(item.transfer_date)
        let periodKey: string

        if (selectedSeries === 'Monthly') {
            periodKey = date.format('YYYY-MM') // Group by month
        } else if (selectedSeries === 'Weekly') {
            periodKey = `${date.year()}-W${date.isoWeek()}` // Group by week
        } else {
            periodKey = date.format('YYYY-MM-DD') // Group by day
        }

        if (!groupedData[periodKey]) groupedData[periodKey] = {}
        if (!groupedData[periodKey][item.token_info.name])
            groupedData[periodKey][item.token_info.name] = 0

        groupedData[periodKey][item.token_info.name] += item.total_volume_usd
    })

    const tokens = Array.from(new Set(apiData.map(item => item.token_info.name)))
    const periods = Object.keys(groupedData).sort()

    const chartData: ChartDataItem[] = tokens.map(token => {
        const colorData = tokensList.find(info => info.ticker === token)
        return {
            name: token,
            color: colorData?.color || '#000000', // Default color if not found
            data: periods.map(period => ({
                period,
                value: parseFloat((groupedData[period][token] || 0).toFixed(6)),
            })),
        }
    })

    return chartData
}

export const formatCategories = (data: ChartDataItem[], timePeriod: string) => {
    if (!data.length) return []
    return data[0].data.map(item => {
        let date

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
        case 'Year to date':
            return dayjs().subtract(365, 'day')
        case 'All time':
            return dayjs().subtract(1000, 'day')
        default:
            return dayjs().subtract(30, 'day')
    }
}
