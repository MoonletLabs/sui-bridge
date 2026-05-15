'use client'

import { Box, Card, CardHeader, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import type { TokenSizeBucket } from 'src/pages/api/token/[id]/size-histogram'

const BUCKET_ORDER = ['< $100', '$100 – $1k', '$1k – $10k', '$10k – $100k', '$100k – $1M', '$1M+']

type Metric = 'count' | 'usd'

type Props = {
    tokenId: number
    tokenColor: string
}

export function TokenSizeHistogram({ tokenId, tokenColor }: Props) {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<Metric>('count')

    const url = `${endpoints.token.sizeHistogram(tokenId)}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}`

    const { data, isLoading } = useSWR<TokenSizeBucket[]>(url, fetcher, {
        revalidateOnFocus: false,
    })

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
            bar: { horizontal: true, borderRadius: 3, barHeight: '65%', distributed: true },
        },
        colors: [tokenColor || '#4DA2FF', '#22C55E', '#FACC15', '#F97316', '#EF4444', '#8B5CF6'],
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
        legend: { show: false },
        tooltip: {
            theme: 'dark',
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
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Transfer Size Distribution"
                subheader="How big are transfers of this token?"
                action={
                    <Stack direction="row" spacing={1}>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={metric}
                            onChange={(_, v) => v && setMetric(v)}
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
