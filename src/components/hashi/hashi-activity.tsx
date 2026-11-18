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
import { useMemo, useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import type { HashiActivityResponse } from 'src/pages/api/hashi/activity'
import {
    btcTxUrl,
    displayTxid,
    fBtc,
    fDuration,
    satsToBtc,
    shortAddress,
    suiAccountUrl,
} from './format'

dayjs.extend(utc)

type Metric = 'volume' | 'count'

// Days shown by the range selector (0 = everything)
const RANGES = [
    { label: '1d', days: 1 },
    { label: '7d', days: 7 },
    { label: '14d', days: 14 },
    { label: 'All', days: 0 },
]

export function HashiVolumeChart({
    data,
    loading,
}: {
    data?: HashiActivityResponse
    loading: boolean
}) {
    const [metric, setMetric] = useState<Metric>('volume')
    const [rangeDays, setRangeDays] = useState(0)

    // 1d switches to hourly bars: one daily bar says nothing. Recent mode (large networks)
    // already shows a short window, so there is no range there.
    const full = data?.mode === 'full'
    const hourlyView = full && rangeDays === 1 && (data?.hourly?.length ?? 0) > 0
    const allDays = data?.daily ?? []
    const shown = hourlyView
        ? (data?.hourly ?? [])
        : rangeDays && full
          ? allDays.slice(-rangeDays)
          : allDays
    const bucketMs = hourlyView ? 3_600_000 : (data?.bucketMs ?? 86_400_000)
    const fineBuckets = bucketMs < 86_400_000

    const { series, categories } = useMemo(() => {
        const days = shown
        const cats = days.map(d =>
            dayjs(d.day_ms)
                .utc()
                .format(fineBuckets ? 'HH:mm' : 'MMM DD'),
        )
        if (metric === 'volume') {
            return {
                categories: cats,
                series: [
                    {
                        name: 'Deposits (BTC → Sui)',
                        data: days.map(d => Number(satsToBtc(d.deposit_sats).toFixed(6))),
                    },
                    {
                        name: 'Withdrawals (Sui → BTC)',
                        data: days.map(d => Number(satsToBtc(d.withdrawal_sats).toFixed(6))),
                    },
                ],
            }
        }
        return {
            categories: cats,
            series: [
                { name: 'Deposits (BTC → Sui)', data: days.map(d => d.deposits) },
                { name: 'Withdrawals (Sui → BTC)', data: days.map(d => d.withdrawals) },
            ],
        }
    }, [data, metric, rangeDays, hourlyView])

    // Small ranges (an hour of deposits is a few thousand sats) need more decimals to read
    const maxVolumeBtc = Math.max(
        0,
        ...shown.map(d => satsToBtc(Math.max(d.deposit_sats, d.withdrawal_sats))),
    )
    const volumeDecimals = maxVolumeBtc >= 1 ? 2 : maxVolumeBtc >= 0.01 ? 3 : 5

    const options = useChart({
        chart: {
            type: 'area',
            toolbar: { show: false },
            animations: { enabled: false },
        },
        colors: ['#22C55E', '#F7931A'],
        // Two lines from zero, so deposits and withdrawals compare directly. Straight segments:
        // a smoothed curve would dip below zero between quiet days and busy ones
        stroke: { width: 2, curve: 'straight' },
        fill: { type: 'solid', opacity: 0.12 },
        markers: { size: shown.length <= 45 ? 3 : 0, strokeWidth: 0, hover: { size: 5 } },
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right' },
        // A category axis (like the other charts) keeps the hover band centred on the bar
        xaxis: {
            categories,
            labels: {
                rotate: 0,
                hideOverlappingLabels: true,
                formatter: (value: string, _timestamp?: number, opts?: { i?: number }) =>
                    (opts?.i ?? 0) % (hourlyView ? 3 : 2) === 0 ? value : '',
            },
        },
        yaxis: {
            min: 0,
            labels: {
                formatter: (v: number) =>
                    metric === 'volume' ? v.toFixed(volumeDecimals) : String(Math.round(v)),
            },
        },
        tooltip: {
            shared: true,
            intersect: false,
            x: {
                formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
                    const day = shown[opts?.dataPointIndex ?? 0]
                    if (!day) return ''
                    return dayjs(day.day_ms)
                        .utc()
                        .format(fineBuckets ? 'MMM D, HH:mm [UTC]' : 'MMM D, YYYY')
                },
            },
            y: {
                formatter: (v: number) =>
                    metric === 'volume'
                        ? `${v.toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`
                        : String(v),
            },
        },
    })

    return (
        <Card>
            <CardHeader
                title={
                    data?.mode === 'recent'
                        ? 'Latest deposit and withdrawal requests'
                        : 'Deposits and withdrawals'
                }
                subheader={
                    data?.mode === 'recent'
                        ? `Requests per 10 minutes (UTC), ${dayjs(data.window?.fromMs).utc().format('MMM D HH:mm')} to ${dayjs(data.window?.toMs).utc().format('HH:mm')} UTC`
                        : hourlyView
                          ? 'Completed requests per hour (UTC), last 24 hours'
                          : "Completed requests per day (UTC), read from Hashi's on-chain queues"
                }
                action={
                    <Stack direction="row" spacing={1}>
                        {data?.mode === 'full' && (
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={rangeDays}
                                onChange={(_, v) => v !== null && setRangeDays(v)}
                            >
                                {RANGES.map(r => (
                                    <ToggleButton key={r.label} value={r.days}>
                                        {r.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        )}
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={metric}
                            onChange={(_, v) => v && setMetric(v)}
                        >
                            <ToggleButton value="volume">BTC</ToggleButton>
                            <ToggleButton value="count">Count</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {loading ? (
                    <Skeleton variant="rounded" height={320} />
                ) : (
                    <Chart type="area" series={series} options={options} height={320} />
                )}
            </Box>
        </Card>
    )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="h6">{value}</Typography>
            {sub && (
                <Typography variant="caption" color="text.secondary">
                    {sub}
                </Typography>
            )}
        </Box>
    )
}

export function HashiSpeedAndSize({
    data,
    loading,
}: {
    data?: HashiActivityResponse
    loading: boolean
}) {
    const t = data?.totals
    // Request events carry no completion times, so the speed card only exists for full history
    const recent = data?.mode === 'recent'
    return (
        <Grid container spacing={2.5}>
            {!recent && (
                <Grid item xs={12} md={6}>
                    <Card sx={{ p: 2.5, height: '100%' }}>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                            Speed
                        </Typography>
                        {loading ? (
                            <Skeleton variant="rounded" height={110} />
                        ) : (
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Metric
                                        label="Deposit, request to hBTC"
                                        value={fDuration(data?.depositTime.medianMs)}
                                        sub={`median · p90 ${fDuration(data?.depositTime.p90Ms)}`}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <Metric
                                        label="Withdrawal, request to BTC"
                                        value={fDuration(data?.withdrawalTime.medianMs)}
                                        sub={`median · p90 ${fDuration(data?.withdrawalTime.p90Ms)}`}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="caption" color="text.secondary">
                                        Committee approval takes a median{' '}
                                        {fDuration(data?.depositTime.approvalMedianMs)} after a
                                        deposit request.
                                    </Typography>
                                </Grid>
                            </Grid>
                        )}
                    </Card>
                </Grid>
            )}
            <Grid item xs={12} md={recent ? 12 : 6}>
                <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        {recent ? 'Size and users in this window' : 'Size and users'}
                    </Typography>
                    {loading || !t ? (
                        <Skeleton variant="rounded" height={110} />
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Metric
                                    label="Total deposited"
                                    value={fBtc(t.depositSats)}
                                    sub={`${t.deposits} deposits · ${t.uniqueDepositors} users`}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric
                                    label="Total withdrawn"
                                    value={fBtc(t.withdrawalSats)}
                                    sub={`${t.withdrawals} withdrawals · ${t.uniqueWithdrawers} users`}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric
                                    label="Average deposit"
                                    value={fBtc(t.avgDepositSats)}
                                    sub={`largest ${fBtc(t.largestDepositSats)}`}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric
                                    label="Average withdrawal"
                                    value={fBtc(t.avgWithdrawalSats)}
                                    sub={`largest ${fBtc(t.largestWithdrawalSats)}`}
                                />
                            </Grid>
                        </Grid>
                    )}
                </Card>
            </Grid>
        </Grid>
    )
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success'> = {
    pending: 'warning',
    approved: 'info',
    signed: 'info',
    confirmed: 'success',
}

export function HashiRecentRequests({
    data,
    loading,
    network,
}: {
    data?: HashiActivityResponse
    loading: boolean
    network: string
}) {
    return (
        <Card>
            <CardHeader title="Latest requests" subheader="Most recent deposits and withdrawals" />
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Sui address</TableCell>
                            <TableCell>Bitcoin tx</TableCell>
                            <TableCell align="right">Time to complete</TableCell>
                            <TableCell align="right">Created</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading &&
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={7}>
                                        <Skeleton />
                                    </TableCell>
                                </TableRow>
                            ))}
                        {data?.recent.map(r => (
                            <TableRow key={`${r.kind}-${r.id}`} hover>
                                <TableCell>
                                    <Typography
                                        variant="body2"
                                        color={
                                            r.kind === 'deposit' ? 'success.main' : 'warning.main'
                                        }
                                        sx={{ fontWeight: 600 }}
                                    >
                                        {r.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        color={STATUS_COLOR[r.status] ?? 'default'}
                                        label={r.status}
                                    />
                                </TableCell>
                                <TableCell align="right">{fBtc(r.amountSats)}</TableCell>
                                <TableCell>
                                    <MuiLink
                                        href={suiAccountUrl(r.sender, network)}
                                        target="_blank"
                                        rel="noopener"
                                        underline="hover"
                                    >
                                        {shortAddress(r.sender)}
                                    </MuiLink>
                                </TableCell>
                                <TableCell>
                                    {r.btcTxid ? (
                                        <MuiLink
                                            href={btcTxUrl(r.btcTxid, network)}
                                            target="_blank"
                                            rel="noopener"
                                            underline="hover"
                                        >
                                            {shortAddress(displayTxid(r.btcTxid), 6, 4)}
                                        </MuiLink>
                                    ) : (
                                        '-'
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    {r.confirmedMs ? fDuration(r.confirmedMs - r.createdMs) : '-'}
                                </TableCell>
                                <TableCell align="right">
                                    {dayjs(r.createdMs).format('MMM D, HH:mm')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Stack sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    Addresses link to Suiscan and Bitcoin transactions to mempool.space.
                </Typography>
            </Stack>
        </Card>
    )
}

// ----------------------------------------------------------------------

/** hBTC in circulation over time: every deposit mints, every withdrawal burns */
export function HashiSupplyChart({
    data,
    loading,
}: {
    data?: HashiActivityResponse
    loading: boolean
}) {
    // Older cached replies may lack the series: show nothing rather than fail
    const days = data?.supplyDaily ?? []
    let running = 0
    const supply = days.map(d => {
        running += d.minted_sats - d.burned_sats
        return Number(satsToBtc(running).toFixed(6))
    })

    const options = useChart({
        chart: { type: 'area', toolbar: { show: false }, animations: { enabled: false } },
        colors: ['#F7931A'],
        stroke: { width: 2, curve: 'stepline' },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
        dataLabels: { enabled: false },
        legend: { show: false },
        xaxis: {
            // Centre each point in its day so the line does not start on top of the y-axis labels
            tickPlacement: 'between',
            categories: days.map(d => dayjs(d.day_ms).utc().format('MMM DD')),
            labels: {
                rotate: 0,
                hideOverlappingLabels: true,
                formatter: (value: string, _timestamp?: number, opts?: { i?: number }) =>
                    (opts?.i ?? 0) % 2 === 0 ? value : '',
            },
        },
        yaxis: { min: 0, labels: { formatter: (v: number) => v.toFixed(2) } },
        tooltip: {
            x: {
                formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
                    const day = days[opts?.dataPointIndex ?? 0]
                    return day ? dayjs(day.day_ms).utc().format('MMM D, YYYY') : ''
                },
            },
            y: { formatter: (v: number) => `${v.toLocaleString()} BTC` },
        },
    })

    return (
        <Card>
            <CardHeader
                title="hBTC supply"
                subheader="Running total at the end of each day: minted when a deposit is confirmed, burned when a withdrawal batch is created"
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {loading ? (
                    <Skeleton variant="rounded" height={260} />
                ) : (
                    <Chart
                        type="area"
                        height={260}
                        options={options}
                        series={[{ name: 'hBTC supply', data: supply }]}
                    />
                )}
            </Box>
        </Card>
    )
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'Waiting for approval',
    approved: 'Approved',
    signed: 'Signed, awaiting Bitcoin confirmation',
    confirmed: 'Completed',
}

export function HashiUsersAndStatus({
    data,
    loading,
}: {
    data?: HashiActivityResponse
    loading: boolean
}) {
    const t = data?.totals
    return (
        <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
                <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        Users
                    </Typography>
                    {loading || !t ? (
                        <Skeleton variant="rounded" height={90} />
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Metric label="Unique users" value={String(t.uniqueUsers)} />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric
                                    label="Used both ways"
                                    value={String(t.twoWayUsers)}
                                    sub="deposited and withdrew"
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric label="Depositors" value={String(t.uniqueDepositors)} />
                            </Grid>
                            <Grid item xs={6}>
                                <Metric label="Withdrawers" value={String(t.uniqueWithdrawers)} />
                            </Grid>
                        </Grid>
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        Requests by stage
                    </Typography>
                    {loading || !data ? (
                        <Skeleton variant="rounded" height={90} />
                    ) : (
                        <Stack spacing={1}>
                            {[
                                ...data.depositStatus.map(s => ({ ...s, kind: 'Deposits' })),
                                ...data.withdrawalStatus.map(s => ({ ...s, kind: 'Withdrawals' })),
                            ].map(s => (
                                <Stack
                                    key={`${s.kind}-${s.status}`}
                                    direction="row"
                                    justifyContent="space-between"
                                    spacing={2}
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        {s.kind}: {STATUS_LABEL[s.status] ?? s.status}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {s.count} · {fBtc(s.sats)}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Card>
            </Grid>
        </Grid>
    )
}
