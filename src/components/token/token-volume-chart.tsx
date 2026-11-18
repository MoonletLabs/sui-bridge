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
type Granularity = 'auto' | 'day' | 'week'

/** Compact axis/tooltip number with the sign in front: -$500k, not $-500.0k */
const fAxis = (v: number, metric: Metric) => {
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    const unit = metric === 'usd' ? '$' : ''
    if (abs >= 1e9) return `${sign}${unit}${(abs / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `${sign}${unit}${(abs / 1e6).toFixed(1)}M`
    if (abs >= 1e3) return `${sign}${unit}${(abs / 1e3).toFixed(1)}k`
    return `${sign}${unit}${abs.toFixed(0)}`
}

type Props = {
    tokenId: number
    tokenColor: string
}

export function TokenVolumeChart({ tokenId, tokenColor }: Props) {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<Metric>('usd')
    const [granularityChoice, setGranularityChoice] = useState<Granularity>('auto')

    const url = `${endpoints.token.volume(tokenId)}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}${granularityChoice === 'auto' ? '' : `&granularity=${granularityChoice}`}`

    const { data, isLoading } = useSWR<TokenVolumeResponse>(url, fetcher, {
        revalidateOnFocus: false,
    })

    const { series, categories } = useMemo(() => {
        const points = data?.points ?? []
        const cats = points.map(p => p.bucket_ms)
        const inflow = points.map(p => (metric === 'usd' ? p.inflow_usd : p.inflow_count))
        const outflow = points.map(p => (metric === 'usd' ? p.outflow_usd : p.outflow_count))
        const round = (v: number) => (metric === 'usd' ? Number(v.toFixed(2)) : v)
        return {
            categories: cats,
            series: [
                { name: 'Inflow (ETH → SUI)', type: 'column', data: inflow.map(round) },
                { name: 'Outflow (SUI → ETH)', type: 'column', data: outflow.map(v => -round(v)) },
                // Net per bucket: above zero means more came into Sui than left
                { name: 'Net', type: 'line', data: inflow.map((v, i) => round(v - outflow[i])) },
            ],
        }
    }, [data, metric])

    const granularity = data?.granularity ?? 'day'
    const dateFmt =
        granularity === 'hour' ? 'MMM D, HH:mm' : granularity === 'week' ? '[W of] MMM D' : 'MMM D'

    const options = useChart({
        chart: {
            type: 'line',
            stacked: true,
            toolbar: { show: false },
            animations: { enabled: false },
        },
        plotOptions: {
            bar: { columnWidth: '70%', borderRadius: 2 },
        },
        colors: ['#22C55E', tokenColor || '#EF4444', '#FFB020'],
        stroke: { width: [0, 0, 2.5], curve: 'straight' },
        markers: { size: 0 },
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right' },
        xaxis: {
            type: 'datetime',
            categories,
            labels: { datetimeUTC: false },
        },
        yaxis: {
            labels: { formatter: (v: number) => fAxis(v, metric) },
        },
        tooltip: {
            shared: true,
            intersect: false,
            x: {
                formatter: (val: number) => dayjs(val).format(dateFmt),
            },
            y: {
                formatter: (v: number, opts?: { seriesIndex?: number }) => {
                    const fmt = (n: number) =>
                        metric === 'usd'
                            ? `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : Math.abs(n).toLocaleString()
                    // Net keeps its sign; inflow/outflow are plotted on opposite sides but read as magnitudes
                    return opts?.seriesIndex === 2
                        ? `${v < 0 ? '-' : v > 0 ? '+' : ''}${fmt(v)}`
                        : fmt(v)
                },
            },
        },
    })

    return (
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Inflow vs Outflow"
                subheader={`Per ${granularity} · line shows net flow (positive = into Sui)`}
                action={
                    <Stack direction="row" spacing={1}>
                        {/* Hourly views (24h) can't be re-bucketed */}
                        {timePeriod !== 'Last 24h' && (
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={granularityChoice}
                                onChange={(_, v: Granularity | null) =>
                                    v && setGranularityChoice(v)
                                }
                                aria-label="bucket size"
                            >
                                <ToggleButton value="auto">Auto</ToggleButton>
                                <ToggleButton value="day">Daily</ToggleButton>
                                <ToggleButton value="week">Weekly</ToggleButton>
                            </ToggleButtonGroup>
                        )}
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
                    type="line"
                    series={series}
                    options={options}
                    height={340}
                    forceLoading={isLoading && !data}
                />
            </Box>
        </Card>
    )
}
