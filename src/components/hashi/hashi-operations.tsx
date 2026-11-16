'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
    Grid,
    Link as MuiLink,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import type { HashiOperations } from 'src/utils/hashi-chain'
import { btcTxUrl, fBtc, fDuration, satsToBtc, shortAddress } from './format'

dayjs.extend(utc)

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="h5">{value}</Typography>
            {sub && (
                <Typography variant="caption" color="text.secondary">
                    {sub}
                </Typography>
            )}
        </Card>
    )
}

const fSats = (sats: number) => `${Math.round(sats).toLocaleString()} sats`

export function HashiBatchStats({ data, loading }: { data?: HashiOperations; loading: boolean }) {
    const b = data?.batches
    const ready = !loading && b
    const dash = '-'
    return (
        <Grid container spacing={2.5}>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Confirmed batches"
                    value={ready ? String(b.confirmed) : dash}
                    sub={
                        ready
                            ? `${b.pending} pending · ${b.signed} signed, awaiting Bitcoin`
                            : undefined
                    }
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Miner fees paid"
                    value={ready ? fSats(b.totalFeeSats) : dash}
                    sub={ready ? fBtc(b.totalFeeSats) : undefined}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Fee per batch"
                    value={ready ? fSats(b.avgFeeSats) : dash}
                    sub="average"
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Withdrawals per batch"
                    value={ready ? b.avgWithdrawalsPerBatch.toFixed(2) : dash}
                    sub={ready ? `${fBtc(b.avgBtcSatsPerBatch)} paid out per batch` : undefined}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Time to confirm a batch"
                    value={ready ? fDuration(b.medianConfirmMs) : dash}
                    sub="median, created to confirmed on Bitcoin"
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Stat
                    label="Presignatures consumed"
                    value={data ? data.presigsConsumed.toLocaleString() : dash}
                    sub="signing material used by the committee"
                />
            </Grid>
        </Grid>
    )
}

type BatchMetric = 'batches' | 'fees'

export function HashiBatchChart({ data, loading }: { data?: HashiOperations; loading: boolean }) {
    const [metric, setMetric] = useState<BatchMetric>('batches')
    const days = data?.batches?.daily ?? []

    const options = useChart({
        chart: { type: 'bar', toolbar: { show: false }, animations: { enabled: false } },
        colors: [metric === 'batches' ? '#00A76F' : '#F7931A'],
        stroke: { width: 0 },
        plotOptions: { bar: { borderRadius: 0 } },
        dataLabels: { enabled: false },
        legend: { show: false },
        xaxis: {
            categories: days.map(d => dayjs(d.day_ms).utc().format('MMM DD')),
            labels: {
                rotate: 0,
                hideOverlappingLabels: true,
                formatter: (value: string, _timestamp?: number, opts?: { i?: number }) =>
                    (opts?.i ?? 0) % 2 === 0 ? value : '',
            },
        },
        yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
        tooltip: {
            x: {
                formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
                    const day = days[opts?.dataPointIndex ?? 0]
                    return day ? dayjs(day.day_ms).utc().format('MMM D, YYYY') : ''
                },
            },
            y: {
                formatter: (v: number) =>
                    metric === 'batches' ? String(v) : `${Math.round(v).toLocaleString()} sats`,
            },
        },
    })

    return (
        <Card>
            <CardHeader
                title="Withdrawal batches"
                subheader="Confirmed Bitcoin transactions per day (UTC). One batch can pay several withdrawals."
                action={
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={metric}
                        onChange={(_, v) => v && setMetric(v)}
                    >
                        <ToggleButton value="batches">Batches</ToggleButton>
                        <ToggleButton value="fees">Miner fees</ToggleButton>
                    </ToggleButtonGroup>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {loading ? (
                    <Skeleton variant="rounded" height={280} />
                ) : (
                    <Chart
                        type="bar"
                        height={280}
                        options={options}
                        series={[
                            {
                                name: metric === 'batches' ? 'Batches' : 'Miner fees (sats)',
                                data: days.map(d =>
                                    metric === 'batches' ? d.batches : d.fee_sats,
                                ),
                            },
                        ]}
                    />
                )}
            </Box>
        </Card>
    )
}

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success'> = {
    pending: 'warning',
    signed: 'info',
    confirmed: 'success',
}

export function HashiBatchesTable({
    data,
    loading,
    network,
}: {
    data?: HashiOperations
    loading: boolean
    network: string
}) {
    const rows = data?.batches?.recent ?? []
    return (
        <Card>
            <CardHeader title="Latest batches" subheader="Most recent withdrawal transactions" />
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Status</TableCell>
                            <TableCell>Bitcoin tx</TableCell>
                            <TableCell align="right">Withdrawals</TableCell>
                            <TableCell align="right">Paid out</TableCell>
                            <TableCell align="right">Inputs</TableCell>
                            <TableCell align="right">Miner fee</TableCell>
                            <TableCell align="right">Time to confirm</TableCell>
                            <TableCell align="right">Created</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading &&
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={8}>
                                        <Skeleton />
                                    </TableCell>
                                </TableRow>
                            ))}
                        {rows.map(b => (
                            <TableRow key={b.id} hover>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        color={STATUS_COLOR[b.status]}
                                        label={b.status}
                                    />
                                </TableCell>
                                <TableCell>
                                    <MuiLink
                                        href={btcTxUrl(b.btcTxid, network)}
                                        target="_blank"
                                        rel="noopener"
                                        underline="hover"
                                    >
                                        {shortAddress(b.btcTxid.replace(/^0x/, ''), 6, 4)}
                                    </MuiLink>
                                </TableCell>
                                <TableCell align="right">{b.withdrawals}</TableCell>
                                <TableCell align="right">{fBtc(b.outputSats)}</TableCell>
                                <TableCell align="right">{b.inputs}</TableCell>
                                <TableCell align="right">{fSats(b.feeSats)}</TableCell>
                                <TableCell align="right">
                                    {b.confirmedMs ? fDuration(b.confirmedMs - b.createdMs) : '-'}
                                </TableCell>
                                <TableCell align="right">
                                    {dayjs(b.createdMs).format('MMM D, HH:mm')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    )
}

export function HashiNetworkProgress({
    data,
    loading,
}: {
    data?: HashiOperations
    loading: boolean
}) {
    const chain = data?.chain
    const epochs = [...(data?.epochs ?? [])].reverse()
    return (
        <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
                <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        Sui progress
                    </Typography>
                    {loading || !chain ? (
                        <Skeleton variant="rounded" height={110} />
                    ) : (
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Latest checkpoint
                                </Typography>
                                <Typography variant="h6">
                                    {chain.suiCheckpoint.toLocaleString()}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Sui epoch
                                </Typography>
                                <Typography variant="h6">
                                    {chain.suiEpoch.toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    started {dayjs(chain.epochStartMs).format('MMM D, HH:mm')}; the
                                    Hashi committee changes at each epoch
                                </Typography>
                            </Box>
                        </Stack>
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={8}>
                <Card sx={{ height: '100%' }}>
                    <CardHeader
                        title="Reconfiguration history"
                        subheader="Committee size and weight at each recent epoch"
                    />
                    <TableContainer sx={{ maxHeight: 360 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Epoch</TableCell>
                                    <TableCell align="right">Operators</TableCell>
                                    <TableCell align="right">Change</TableCell>
                                    <TableCell align="right">Total weight</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading &&
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={4}>
                                                <Skeleton />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                {epochs.map(e => (
                                    <TableRow key={e.epoch} hover>
                                        <TableCell>{e.epoch.toLocaleString()}</TableCell>
                                        <TableCell align="right">{e.members}</TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color:
                                                    e.memberChange > 0
                                                        ? 'success.main'
                                                        : e.memberChange < 0
                                                          ? 'error.main'
                                                          : 'text.secondary',
                                            }}
                                        >
                                            {e.memberChange > 0 ? '+' : ''}
                                            {e.memberChange}
                                        </TableCell>
                                        <TableCell align="right">
                                            {e.totalWeight.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            </Grid>
        </Grid>
    )
}
