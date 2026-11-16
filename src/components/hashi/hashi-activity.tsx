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
import { useMemo, useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import type { HashiActivityResponse } from 'src/pages/api/hashi/activity'
import { btcTxUrl, fBtc, fDuration, satsToBtc, shortAddress, suiAccountUrl } from './format'

type Metric = 'volume' | 'count'

export function HashiVolumeChart({
    data,
    loading,
}: {
    data?: HashiActivityResponse
    loading: boolean
}) {
    const [metric, setMetric] = useState<Metric>('volume')

    const { series, categories } = useMemo(() => {
        const days = data?.daily ?? []
        const cats = days.map(d => d.day_ms)
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
                        data: days.map(d => -Number(satsToBtc(d.withdrawal_sats).toFixed(6))),
                    },
                ],
            }
        }
        return {
            categories: cats,
            series: [
                { name: 'Deposits (BTC → Sui)', data: days.map(d => d.deposits) },
                { name: 'Withdrawals (Sui → BTC)', data: days.map(d => -d.withdrawals) },
            ],
        }
    }, [data, metric])

    const options = useChart({
        chart: {
            type: 'bar',
            stacked: true,
            toolbar: { show: false },
            animations: { enabled: false },
        },
        plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
        colors: ['#22C55E', '#F7931A'],
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right' },
        xaxis: { type: 'datetime', categories, labels: { datetimeUTC: false } },
        yaxis: {
            labels: {
                formatter: (v: number) =>
                    metric === 'volume' ? `${Math.abs(v).toFixed(2)}` : String(Math.abs(v)),
            },
        },
        tooltip: {
            shared: true,
            intersect: false,
            x: { formatter: (val: number) => dayjs(val).format('MMM D, YYYY') },
            y: {
                formatter: (v: number) =>
                    metric === 'volume'
                        ? `${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`
                        : String(Math.abs(v)),
            },
        },
    })

    return (
        <Card>
            <CardHeader
                title="Deposits and withdrawals"
                subheader="Completed requests per day (UTC), read from Hashi's on-chain queues"
                action={
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={metric}
                        onChange={(_, v) => v && setMetric(v)}
                    >
                        <ToggleButton value="volume">BTC</ToggleButton>
                        <ToggleButton value="count">Count</ToggleButton>
                    </ToggleButtonGroup>
                }
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {loading ? (
                    <Skeleton variant="rounded" height={320} />
                ) : (
                    <Chart type="bar" series={series} options={options} height={320} />
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
    return (
        <Grid container spacing={2.5}>
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
                                    {fDuration(data?.depositTime.approvalMedianMs)} after a deposit
                                    request.
                                </Typography>
                            </Grid>
                        </Grid>
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        Size and users
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
                                            {shortAddress(r.btcTxid.replace(/^0x/, ''), 6, 4)}
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
