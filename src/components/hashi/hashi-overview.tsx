'use client'

import { Box, Card, Chip, Grid, LinearProgress, Skeleton, Stack, Typography } from '@mui/material'
import { Chart, useChart } from 'src/components/chart'
import { Iconify } from 'src/components/iconify'
import type { HashiActivityResponse } from 'src/pages/api/hashi/activity'
import type { HashiHistoryResponse } from 'src/pages/api/hashi/history'
import type { HashiOverview } from 'src/utils/hashi-chain'
import { fBtc, fDuration, sinceNote } from './format'

/** A small line under a card's figure, and how far it moved over the period it covers */
type Trend = { values: number[]; color: string; label: string }

/** "+12.3%" / "-4%" from the first to the last value; null when there is nothing to compare */
function changeOf(values: number[]): { text: string; direction: 'up' | 'down' | 'flat' } | null {
    if (values.length < 2) return null
    const first = values[0]
    const last = values[values.length - 1]
    if (first === last) return { text: '0%', direction: 'flat' }
    // A percentage from zero means nothing
    if (first === 0) return null
    const pct = ((last - first) / Math.abs(first)) * 100
    const digits = Math.abs(pct) >= 100 ? 0 : 1
    return {
        text: `${pct > 0 ? '+' : ''}${pct.toFixed(digits)}%`,
        direction: pct > 0 ? 'up' : 'down',
    }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
    const options = useChart({
        chart: {
            type: 'area',
            sparkline: { enabled: true },
            animations: { enabled: false },
            toolbar: { show: false },
        },
        colors: [color],
        stroke: { width: 2, curve: 'straight' },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
        markers: { size: 0 },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: { enabled: false },
    })
    return (
        <Chart
            type="area"
            series={[{ name: 'trend', data: values }]}
            options={options}
            height={48}
        />
    )
}

type StatProps = {
    title: string
    value: string
    sub?: string
    icon: string
    color?: string
    loading?: boolean
    trend?: Trend
    /** Replaces the trend line, e.g. a progress bar */
    footer?: React.ReactNode
}

function Stat({
    title,
    value,
    sub,
    icon,
    color = 'primary.main',
    loading,
    trend,
    footer,
}: StatProps) {
    const change = trend ? changeOf(trend.values) : null
    return (
        <Card sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.neutral',
                        color,
                        flexShrink: 0,
                    }}
                >
                    <Iconify icon={icon} width={22} />
                </Box>
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                        {title}
                    </Typography>
                    {loading ? (
                        <Skeleton width={110} height={32} />
                    ) : (
                        <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
                            {value}
                        </Typography>
                    )}
                    {sub && !loading && (
                        <Typography variant="caption" color="text.secondary">
                            {sub}
                        </Typography>
                    )}
                    {change && !loading && trend && (
                        <Typography
                            variant="caption"
                            color={
                                change.direction === 'up'
                                    ? 'success.main'
                                    : change.direction === 'down'
                                      ? 'error.main'
                                      : 'text.secondary'
                            }
                            sx={{ fontWeight: 600 }}
                        >
                            {change.direction === 'up'
                                ? '▲ '
                                : change.direction === 'down'
                                  ? '▼ '
                                  : ''}
                            {change.text}{' '}
                            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                {trend.label}
                            </Box>
                        </Typography>
                    )}
                </Stack>
            </Stack>
            {!loading && trend && trend.values.length > 1 && (
                <Box sx={{ mt: 1, mx: -0.5 }}>
                    <Sparkline values={trend.values} color={trend.color} />
                </Box>
            )}
            {!loading && footer}
        </Card>
    )
}

// A Sui epoch lasts a day on mainnet and testnet
const EPOCH_MS = 86_400_000

const DAYS_LABEL = '7d'
const LAST_DAYS = 8 // eight daily points make seven days of change

export function HashiOverviewCards({
    data,
    loading,
    committeeSize,
    history,
    activity,
    activityLoading,
}: {
    data?: HashiOverview
    loading: boolean
    /** Operators in the current committee (registered operators can be outside it) */
    committeeSize?: number
    /** Stored snapshots (7 days): gives the trend lines. Without a store the lines are left out. */
    history?: HashiHistoryResponse
    activity?: HashiActivityResponse
    activityLoading?: boolean
}) {
    const backing = data?.backingRatio
    const queueTotal = (data?.pendingDeposits ?? 0) + (data?.pendingWithdrawals ?? 0)

    const points = history?.available ? history.points : []
    const fromHistory = (
        pick: (p: HashiHistoryResponse['points'][number]) => number,
        color: string,
    ) => (points.length > 1 ? { values: points.map(pick), color, label: DAYS_LABEL } : undefined)

    // Totals from the request history (full mode only: the recent-only view has no totals to speak of)
    const full = activity?.mode === 'full' ? activity : undefined
    let running = 0
    const bridged = (full?.daily ?? []).map(d => (running += d.deposit_sats + d.withdrawal_sats))
    const bridgedTrend =
        bridged.length > 1
            ? { values: bridged.slice(-LAST_DAYS), color: '#F7931A', label: DAYS_LABEL }
            : undefined
    const users = (full?.usersDaily ?? []).map(u => u.users)
    const usersTrend =
        users.length > 1
            ? { values: users.slice(-LAST_DAYS), color: '#7635DC', label: DAYS_LABEL }
            : undefined

    const epochElapsed = data?.chain ? Date.now() - data.chain.epochStartMs : null
    const epochPct =
        epochElapsed != null ? Math.min(100, Math.max(0, (epochElapsed / EPOCH_MS) * 100)) : null

    return (
        <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="mdi:bitcoin"
                    color="#F7931A"
                    title="hBTC supply"
                    value={data ? fBtc(data.supplySats) : '-'}
                    sub="Bitcoin represented on Sui"
                    trend={fromHistory(p => p.supply_sats, '#F7931A')}
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:shield-check-bold-duotone"
                    color="success.main"
                    title="BTC held by the committee"
                    trend={fromHistory(p => p.pool_sats, '#00A76F')}
                    value={data ? fBtc(data.poolSats) : '-'}
                    sub={
                        data
                            ? `${data.poolUtxoCount} UTXOs${
                                  backing != null ? ` · ${(backing * 100).toFixed(2)}% backing` : ''
                              }`
                            : undefined
                    }
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:clock-circle-bold-duotone"
                    color="info.main"
                    title="Requests in progress"
                    trend={fromHistory(p => p.pending_deposits + p.pending_withdrawals, '#00B8D9')}
                    value={data ? String(queueTotal) : '-'}
                    sub={
                        data
                            ? `${data.pendingDeposits} deposits · ${data.pendingWithdrawals} withdrawals`
                            : undefined
                    }
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:users-group-rounded-bold-duotone"
                    color="primary.main"
                    title="Committee"
                    value={
                        data
                            ? committeeSize != null
                                ? `${committeeSize} operators`
                                : `${data.registeredMembers} registered`
                            : '-'
                    }
                    sub={
                        data
                            ? committeeSize != null
                                ? `${data.registeredMembers} registered · epoch ${data.epoch.toLocaleString()}`
                                : `Epoch ${data.epoch.toLocaleString()}`
                            : undefined
                    }
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:download-minimalistic-bold-duotone"
                    color="success.main"
                    title="Completed deposits"
                    trend={fromHistory(p => p.processed_deposits, '#22C55E')}
                    value={data ? data.processedDeposits.toLocaleString() : '-'}
                    sub={
                        data
                            ? `Minimum ${fBtc(data.config.depositMinimumSats)} · ${fDuration(
                                  data.config.depositDelayMs,
                              )} delay`
                            : undefined
                    }
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:upload-minimalistic-bold-duotone"
                    color="warning.main"
                    title="Completed withdrawals"
                    trend={fromHistory(p => p.processed_withdrawals, '#FFAB00')}
                    value={data ? data.processedWithdrawals.toLocaleString() : '-'}
                    sub={
                        data
                            ? `Minimum ${fBtc(data.config.withdrawalMinimumSats)}${
                                  data.withdrawalCountsExact ? '' : ' · approximate'
                              }`
                            : undefined
                    }
                />
            </Grid>
            {(activityLoading || full) && (
                <>
                    <Grid item xs={12} sm={6} md={4}>
                        <Stat
                            loading={activityLoading && !full}
                            icon="solar:transfer-horizontal-bold-duotone"
                            color="#F7931A"
                            title="Bridged volume"
                            trend={bridgedTrend}
                            value={
                                full
                                    ? fBtc(full.totals.depositSats + full.totals.withdrawalSats)
                                    : '-'
                            }
                            sub={
                                full
                                    ? `${fBtc(full.totals.depositSats)} in · ${fBtc(full.totals.withdrawalSats)} out${sinceNote(full.coverage)}`
                                    : undefined
                            }
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <Stat
                            loading={activityLoading && !full}
                            icon="solar:user-rounded-bold-duotone"
                            color="primary.main"
                            title="Unique users"
                            trend={usersTrend}
                            value={full ? full.totals.uniqueUsers.toLocaleString() : '-'}
                            sub={
                                full
                                    ? `${full.totals.twoWayUsers.toLocaleString()} deposited and withdrew${sinceNote(full.coverage)}`
                                    : undefined
                            }
                        />
                    </Grid>
                </>
            )}
            {(loading || data?.chain) && (
                <Grid item xs={12} sm={6} md={4}>
                    <Stat
                        loading={loading}
                        icon="solar:refresh-circle-bold-duotone"
                        color="info.main"
                        title="Epoch progress"
                        value={epochPct != null ? `${epochPct.toFixed(0)}%` : '-'}
                        sub={
                            data?.chain && epochElapsed != null
                                ? `Epoch ${data.chain.suiEpoch.toLocaleString()} · ends in ${fDuration(
                                      Math.max(0, EPOCH_MS - epochElapsed),
                                  )}${
                                      data.epoch !== data.chain.suiEpoch
                                          ? ` · Hashi at ${data.epoch.toLocaleString()}`
                                          : ''
                                  }`
                                : undefined
                        }
                        footer={
                            epochPct != null ? (
                                <LinearProgress
                                    variant="determinate"
                                    value={epochPct}
                                    sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                                />
                            ) : undefined
                        }
                    />
                </Grid>
            )}
        </Grid>
    )
}

export function HashiStatusChips({ data }: { data?: HashiOverview }) {
    if (!data) return null
    const paused = data.config.paused
    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
                size="small"
                color={paused ? 'error' : 'success'}
                label={paused ? 'Paused' : 'Running'}
            />
            {data.config.reconfigHold && (
                <Chip size="small" color="warning" label="Reconfiguration hold" />
            )}
            <Chip size="small" variant="outlined" label={`Epoch ${data.epoch.toLocaleString()}`} />
            <Chip
                size="small"
                variant="outlined"
                label={`Bitcoin ${data.network === 'testnet' ? 'Signet' : 'Mainnet'}`}
            />
        </Stack>
    )
}
