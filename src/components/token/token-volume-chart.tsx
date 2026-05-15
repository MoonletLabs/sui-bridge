'use client'

import { Card, CardHeader, Box, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import type { TokenVolumeResponse } from 'src/pages/api/token/[id]/volume'

type Metric = 'usd' | 'count'

type Props = {
    tokenId: number
    tokenColor: string
}

export function TokenVolumeChart({ tokenId, tokenColor }: Props) {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<Metric>('usd')

    const url = `${endpoints.token.volume(tokenId)}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}`

    const { data, isLoading } = useSWR<TokenVolumeResponse>(url, fetcher, {
        revalidateOnFocus: false,
    })

    const { series, categories } = useMemo(() => {
        const points = data?.points ?? []
        const cats = points.map(p => p.bucket_ms)
        if (metric === 'usd') {
            return {
                categories: cats,
                series: [
                    {
                        name: 'Inflow (ETH → SUI)',
                        data: points.map(p => Number(p.inflow_usd.toFixed(2))),
                    },
                    {
                        name: 'Outflow (SUI → ETH)',
                        data: points.map(p => -Number(p.outflow_usd.toFixed(2))),
                    },
                ],
            }
        }
        return {
            categories: cats,
            series: [
                { name: 'Inflow (ETH → SUI)', data: points.map(p => p.inflow_count) },
                { name: 'Outflow (SUI → ETH)', data: points.map(p => -p.outflow_count) },
            ],
        }
    }, [data, metric])

    const granularity = data?.granularity ?? 'day'
    const dateFmt =
        granularity === 'hour' ? 'MMM D, HH:mm' : granularity === 'week' ? '[W of] MMM D' : 'MMM D'

    const options = useChart({
        chart: {
            type: 'bar',
            stacked: true,
            toolbar: { show: false },
            animations: { enabled: false },
        },
        plotOptions: {
            bar: { columnWidth: '70%', borderRadius: 2 },
        },
        colors: ['#22C55E', tokenColor || '#EF4444'],
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right' },
        xaxis: {
            type: 'datetime',
            categories,
            labels: { datetimeUTC: false },
        },
        yaxis: {
            labels: {
                formatter: (v: number) => {
                    const abs = Math.abs(v)
                    if (metric === 'usd') {
                        if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
                        if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
                        if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}k`
                        return `$${v.toFixed(0)}`
                    }
                    if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`
                    if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}k`
                    return String(v)
                },
            },
        },
        tooltip: {
            theme: 'dark',
            shared: true,
            intersect: false,
            x: {
                formatter: (val: number) => dayjs(val).format(dateFmt),
            },
            y: {
                formatter: (v: number) => {
                    const abs = Math.abs(v)
                    if (metric === 'usd') {
                        return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    }
                    return abs.toLocaleString()
                },
            },
        },
    })

    return (
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Inflow vs Outflow"
                subheader={`Per ${granularity}`}
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
                    height={340}
                    forceLoading={isLoading && !data}
                />
            </Box>
        </Card>
    )
}
