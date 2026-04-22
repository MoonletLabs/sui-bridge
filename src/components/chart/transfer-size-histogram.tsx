'use client'

import { Box, Button, Card, CardHeader } from '@mui/material'
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

    const { data, isLoading } = useSWR<SizeHistogramRow[]>(
        `${endpoints.sizeHistogram}?network=${network}&period=${encodeURIComponent(timePeriod)}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const { series, categories } = useMemo(() => {
        const rows = data ?? []
        const byBucket = Object.fromEntries(rows.map(r => [r.bucket, r]))
        const cats = BUCKET_ORDER.filter(b => byBucket[b])
        const values = cats.map(b =>
            metric === 'count' ? Number(byBucket[b].count) || 0 : Number(byBucket[b].usd) || 0,
        )
        return {
            categories: cats,
            series: [{ name: metric === 'count' ? 'Transfers' : 'Volume (USD)', data: values }],
        }
    }, [data, metric])

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
                    const n = Number(v)
                    if (!Number.isFinite(n)) return String(v)
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
            y: {
                formatter: (v: number) =>
                    metric === 'usd'
                        ? `$${Number(v).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                          })}`
                        : `${Number(v).toLocaleString()}`,
            },
        },
    })

    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                title="Transfer Size Distribution"
                subheader="How big are typical bridge transfers?"
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
                    </Box>
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
