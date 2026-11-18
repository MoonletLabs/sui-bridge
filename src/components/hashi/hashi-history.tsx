'use client'

import {
    Box,
    Card,
    CardHeader,
    Skeleton,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import { useHashiHistory } from 'src/hooks/use-hashi'
import { satsToBtc } from './format'

dayjs.extend(utc)

type View = 'reserve' | 'utxos' | 'queues'

const RANGES = [
    { label: '1d', days: 1 },
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
]

/**
 * Supply, reserve, UTXOs and queue sizes over time. These only exist as stored snapshots (the
 * chain holds just the current value), so the card appears once the Hashi analytics store is
 * connected and has collected a few points.
 */
export function HashiHistoryCard() {
    const [days, setDays] = useState(7)
    const [view, setView] = useState<View>('reserve')
    const { data, isLoading } = useHashiHistory(days)

    const points = data?.points ?? []
    const fine = (data?.bucketSeconds ?? 86_400) < 86_400
    const categories = points.map(p =>
        dayjs(p.t)
            .utc()
            .format(fine ? 'MMM D HH:mm' : 'MMM D'),
    )

    const options = useChart({
        chart: { type: 'line', toolbar: { show: false }, animations: { enabled: false } },
        colors: ['#F7931A', '#00A76F'],
        stroke: { width: 2, curve: 'stepline' },
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right' },
        xaxis: {
            categories,
            tickPlacement: 'between',
            labels: {
                rotate: 0,
                hideOverlappingLabels: true,
                formatter: (value: string, _timestamp?: number, opts?: { i?: number }) =>
                    (opts?.i ?? 0) % Math.max(1, Math.ceil(points.length / 8)) === 0 ? value : '',
            },
        },
        yaxis: {
            labels: {
                formatter: (v: number) =>
                    view === 'reserve' ? v.toFixed(2) : String(Math.round(v)),
            },
        },
        tooltip: {
            shared: true,
            y: {
                formatter: (v: number) =>
                    view === 'reserve' ? `${v.toLocaleString()} BTC` : String(Math.round(v)),
            },
        },
    })

    const series =
        view === 'reserve'
            ? [
                  {
                      name: 'hBTC supply',
                      data: points.map(p => Number(satsToBtc(p.supply_sats).toFixed(6))),
                  },
                  {
                      name: 'BTC reserve',
                      data: points.map(p => Number(satsToBtc(p.pool_sats).toFixed(6))),
                  },
              ]
            : view === 'utxos'
              ? [{ name: 'UTXOs in the pool', data: points.map(p => p.pool_utxos) }]
              : [
                    { name: 'Pending deposits', data: points.map(p => p.pending_deposits) },
                    { name: 'Pending withdrawals', data: points.map(p => p.pending_withdrawals) },
                ]

    // No store connected: nothing to show, and no reason to explain it to visitors
    if (!isLoading && !data?.available) return null

    return (
        <Card>
            <CardHeader
                title="Supply, reserve and queues over time"
                subheader="From snapshots taken every few minutes"
                action={
                    <Stack direction="row" spacing={1}>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={days}
                            onChange={(_, v) => v && setDays(v)}
                        >
                            {RANGES.map(r => (
                                <ToggleButton key={r.label} value={r.days}>
                                    {r.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={view}
                            onChange={(_, v) => v && setView(v)}
                        >
                            <ToggleButton value="reserve">BTC</ToggleButton>
                            <ToggleButton value="utxos">UTXOs</ToggleButton>
                            <ToggleButton value="queues">Queues</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {isLoading ? (
                    <Skeleton variant="rounded" height={280} />
                ) : points.length < 2 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 6, textAlign: 'center' }}
                    >
                        Collecting data: the chart appears after a couple of snapshots.
                    </Typography>
                ) : (
                    // Remount when the data set changes: apex can mount at width 0 right after
                    // the card switches from its placeholder
                    <Chart
                        key={`${view}-${days}-${points.length}`}
                        type="line"
                        height={280}
                        options={options}
                        series={series}
                    />
                )}
            </Box>
        </Card>
    )
}
