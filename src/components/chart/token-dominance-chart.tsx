'use client'

import { Card, CardHeader, Button, Box } from '@mui/material'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { downloadCsv } from 'src/utils/csv'
import { calculateStartDate } from 'src/utils/format-chart-data'
import { getTokensList } from 'src/utils/types'

type Row = {
    transfer_date: string
    token_info?: { name: string }
    direction: 'inflow' | 'outflow'
    total_volume_usd: number
    total_volume: number
}

/**
 * Token Dominance — 100% stacked area showing each token's share of total
 * bridge volume over time. Daily-resolution. Reuses /api/volume/daily.
 */
export default function TokenDominanceChart() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()
    const [metric, setMetric] = useState<'usd' | 'count'>('usd')

    const { data, isLoading } = useSWR<Row[]>(
        `${endpoints.volume.daily}?network=${network}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const { series, categories, colors, tokenNames } = useMemo(() => {
        if (!data?.length) return { series: [], categories: [], colors: [], tokenNames: [] }

        const startDate = calculateStartDate(timePeriod)
        const filteredByDate = data.filter(r => dayjs(r.transfer_date).isAfter(startDate))

        const tokenPalette = getTokensList(network)
        const paletteMap = Object.fromEntries(tokenPalette.map(t => [t.ticker, t.color]))

        // Get all tokens that appear; respect global selectedTokens filter
        const tokenSet = new Set<string>()
        filteredByDate.forEach(r => {
            const name = r.token_info?.name
            if (!name) return
            if (selectedTokens.includes('All') || selectedTokens.includes(name)) {
                tokenSet.add(name)
            }
        })
        const tokens = Array.from(tokenSet)

        // Group by date × token → sum (USD or count)
        const byDate: Record<string, Record<string, number>> = {}
        filteredByDate.forEach(r => {
            const name = r.token_info?.name
            if (!name) return
            if (!selectedTokens.includes('All') && !selectedTokens.includes(name)) return
            const day = dayjs(r.transfer_date).format('YYYY-MM-DD')
            if (!byDate[day]) byDate[day] = {}
            if (!byDate[day][name]) byDate[day][name] = 0
            if (metric === 'usd') {
                byDate[day][name] += Number(r.total_volume_usd) || 0
            } else {
                // No count field on volume endpoint — treat each row as +1
                byDate[day][name] += 1
            }
        })

        const days = Object.keys(byDate).sort()
        const chartSeries = tokens.map(token => ({
            name: token,
            data: days.map(d => Number((byDate[d][token] || 0).toFixed(2))),
        }))

        const chartColors = tokens.map(t => paletteMap[t] || '#999')

        return {
            series: chartSeries,
            categories: days,
            colors: chartColors,
            tokenNames: tokens,
        }
    }, [data, network, timePeriod, selectedTokens, metric])

    const options = useChart({
        chart: {
            type: 'area',
            stacked: true,
            stackType: '100%',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: false },
        },
        colors,
        stroke: { curve: 'smooth', width: 1 },
        fill: { type: 'solid', opacity: 0.85 },
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            type: 'datetime',
            labels: { datetimeFormatter: { year: 'yyyy', month: 'MMM', day: 'dd MMM' } },
        },
        yaxis: {
            labels: { formatter: (v: number) => `${v.toFixed(0)}%` },
            max: 100,
            min: 0,
        },
        tooltip: {
            shared: true,
            y: {
                formatter: (v: number) => `${v?.toFixed?.(1) ?? 0}%`,
            },
        },
        legend: { position: 'bottom' },
    })

    const handleExport = () => {
        if (!categories.length) return
        const rows = categories.map((d, i) => {
            const obj: Record<string, any> = { date: d }
            tokenNames.forEach(t => {
                obj[t] = series.find(s => s.name === t)?.data?.[i] ?? 0
            })
            return obj
        })
        downloadCsv('token-dominance', rows)
    }

    return (
        <Card>
            <CardHeader
                title="Token Dominance"
                subheader="Share of total bridge activity per token, over time"
                action={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            variant={metric === 'usd' ? 'contained' : 'outlined'}
                            onClick={() => setMetric('usd')}
                        >
                            USD
                        </Button>
                        <Button
                            size="small"
                            variant={metric === 'count' ? 'contained' : 'outlined'}
                            onClick={() => setMetric('count')}
                        >
                            Count
                        </Button>
                        <Button size="small" variant="outlined" onClick={handleExport}>
                            CSV
                        </Button>
                    </Box>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                <Chart
                    type="area"
                    series={series}
                    options={options}
                    height={360}
                    forceLoading={isLoading && !data?.length}
                />
            </Box>
        </Card>
    )
}
