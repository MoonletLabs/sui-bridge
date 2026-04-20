'use client'

import { Box, Button, Card, CardHeader } from '@mui/material'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { downloadCsv } from 'src/utils/csv'
import { ActivityHeatmapRow } from 'src/utils/types'

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // ISO: 1..7

/**
 * Activity Heatmap — 7 (day-of-week) × 24 (hour) grid of bridge activity.
 * Reads from /api/activity-heatmap. Uses ApexCharts native heatmap.
 */
export default function ActivityHeatmap() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<'count' | 'usd'>('count')

    const { data, isLoading } = useSWR<ActivityHeatmapRow[]>(
        `${endpoints.activityHeatmap}?network=${network}&period=${encodeURIComponent(timePeriod)}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const series = useMemo(() => {
        const rows = data ?? []
        // Build a quick lookup: `${dow}-${hour}` → row
        const map: Record<string, ActivityHeatmapRow> = {}
        rows.forEach(r => {
            map[`${r.dow}-${r.hour}`] = r
        })
        return DOW_LABELS.map((label, i) => {
            const dow = i + 1 // ISO Monday=1..Sunday=7
            const dataPoints = Array.from({ length: 24 }, (_, hour) => {
                const r = map[`${dow}-${hour}`]
                const v = r ? (metric === 'count' ? r.count : r.usd) : 0
                return { x: `${String(hour).padStart(2, '0')}h`, y: Number(v) || 0 }
            })
            return { name: label, data: dataPoints }
        }).reverse() // Apex heatmap renders series top-to-bottom; show Mon on top
    }, [data, metric])

    const options = useChart({
        chart: { type: 'heatmap', toolbar: { show: false }, animations: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { width: 1, colors: ['#fff'] },
        plotOptions: {
            heatmap: {
                radius: 2,
                enableShades: true,
                shadeIntensity: 0.7,
                colorScale: {
                    ranges: [], // auto-scale based on values
                },
            },
        },
        colors: ['#4DA2FF'],
        xaxis: {
            labels: { style: { fontSize: '10px' } },
        },
        tooltip: {
            y: {
                formatter: (v: number) =>
                    metric === 'usd'
                        ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${Number(v).toLocaleString()} transfers`,
            },
        },
        legend: { show: false },
    })

    const handleExport = () => {
        if (!data?.length) return
        downloadCsv('activity-heatmap', data as any)
    }

    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                title="Activity Heatmap (UTC)"
                subheader="When does the bridge wake up? Day-of-week × hour"
                action={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            variant={metric === 'count' ? 'contained' : 'outlined'}
                            onClick={() => setMetric('count')}
                        >
                            Count
                        </Button>
                        <Button
                            size="small"
                            variant={metric === 'usd' ? 'contained' : 'outlined'}
                            onClick={() => setMetric('usd')}
                        >
                            USD
                        </Button>
                        <Button size="small" variant="outlined" onClick={handleExport}>
                            CSV
                        </Button>
                    </Box>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                <Chart
                    type="heatmap"
                    series={series}
                    options={options}
                    height={320}
                    forceLoading={isLoading && !data?.length}
                />
            </Box>
        </Card>
    )
}
