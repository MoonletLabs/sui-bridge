'use client'

import { Box, Card, CardHeader, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { SizeHistogramRow } from 'src/utils/types'

const BUCKET_ORDER = ['< $100', '$100 – $1k', '$1k – $10k', '$10k – $100k', '$100k – $1M', '$1M+']

/**
 * Transfer Size Histogram — bar chart of transfers grouped by USD size bucket.
 * Reads from /api/size-histogram.
 */
export default function TransferSizeHistogram() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<'count' | 'usd'>('count')
    const [scale, setScale] = useState<'linear' | 'log'>('linear')

    const { data, isLoading } = useSWR<SizeHistogramRow[]>(
        `${endpoints.sizeHistogram}?network=${network}&period=${encodeURIComponent(timePeriod)}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const { series, categories, rawValues } = useMemo(() => {
        const rows = data ?? []
        const byBucket = Object.fromEntries(rows.map(r => [r.bucket, r]))
        const cats = BUCKET_ORDER.filter(b => byBucket[b])
        const raw = cats.map(b =>
            metric === 'count' ? Number(byBucket[b].count) || 0 : Number(byBucket[b].usd) || 0,
        )
        const useLog = metric === 'usd' && scale === 'log'
        const values = useLog ? raw.map(v => (v > 0 ? Math.log10(v) : 0)) : raw
        return {
            categories: cats,
            rawValues: raw,
            series: [{ name: metric === 'count' ? 'Transfers' : 'Volume (USD)', data: values }],
        }
    }, [data, metric, scale])

    const options = useChart({
        chart: { type: 'bar', toolbar: { show: false }, animations: { enabled: false } },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 3,
                barHeight: '65%',
                distributed: true,
            },
        },
        colors: ['#4DA2FF', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'],
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            labels: {
                formatter: (v: string | number) => {
                    let n = Number(v)
                    if (!Number.isFinite(n)) return String(v)
                    // If log-scale is active we store log10(value) on the series,
                    // so transform axis ticks back to real values for display.
                    if (metric === 'usd' && scale === 'log') {
                        n = n > 0 ? Math.pow(10, n) : 0
                    }
                    if (metric === 'usd') {
                        if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
                        if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
                        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
                        return `$${n.toFixed(0)}`
                    }
                    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
                    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
                    return String(n)
                },
            },
        },
        yaxis: { labels: { style: { fontSize: '12px' } } },
        legend: { show: false },
        tooltip: {
            theme: 'dark',
            fillSeriesColor: false,
            y: {
                formatter: (v: number) =>
                    metric === 'usd'
                        ? `$${Number(v).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                          })}`
                        : `${Number(v).toLocaleString()}`,
            },
            custom: ({ seriesIndex, dataPointIndex, w }: any) => {
                // Always display the raw (pre-log) value in the tooltip
                const value = rawValues[dataPointIndex] ?? 0
                const category = w.globals.labels[dataPointIndex]
                const color = w.globals.colors[dataPointIndex] || w.globals.colors[0]
                const formatted =
                    metric === 'usd'
                        ? `$${Number(value).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                          })}`
                        : Number(value).toLocaleString()
                void seriesIndex
                const label = metric === 'usd' ? 'Volume (USD)' : 'Transfers'
                return `
                    <div style="
                        background: rgba(22, 28, 36, 0.92);
                        color: #fff;
                        border-radius: 8px;
                        padding: 8px 12px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
                        font-size: 12px;
                        min-width: 140px;
                    ">
                        <div style="
                            font-weight: 600;
                            color: rgba(255,255,255,0.75);
                            margin-bottom: 4px;
                        ">${category}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="
                                width: 8px;
                                height: 8px;
                                border-radius: 50%;
                                background: ${color};
                                display: inline-block;
                            "></span>
                            <span style="color: rgba(255,255,255,0.75);">${label}:</span>
                            <span style="margin-left: auto; font-weight: 600;">${formatted}</span>
                        </div>
                    </div>
                `
            },
        },
    })

    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                title="Transfer Size Distribution"
                subheader="How big are typical bridge transfers?"
                action={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        {metric === 'usd' && (
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={scale}
                                onChange={(_, v) => v && setScale(v)}
                                aria-label="scale"
                            >
                                <ToggleButton value="linear">Linear</ToggleButton>
                                <ToggleButton value="log">Log</ToggleButton>
                            </ToggleButtonGroup>
                        )}
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={metric}
                            onChange={(_, v) => v && setMetric(v)}
                            aria-label="metric"
                        >
                            <ToggleButton value="usd">USD</ToggleButton>
                            <ToggleButton value="count">Count</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                <Chart
                    type="bar"
                    series={series}
                    options={options}
                    height={320}
                    forceLoading={isLoading && !data?.length}
                />
            </Box>
        </Card>
    )
}
