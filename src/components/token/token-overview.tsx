'use client'

import { Box, Card, Grid, Skeleton, Stack, Typography } from '@mui/material'
import { Iconify } from 'src/components/iconify'
import { fNumber, fShortenNumber } from 'src/utils/format-number'
import type { TokenOverviewResponse } from 'src/pages/api/token/[id]/overview'

function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return '$0'
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
    return `${sign}$${abs.toFixed(2)}`
}

function pctChange(current: number, previous: number): number | null {
    if (!previous || previous === 0) return null
    return ((current - previous) / previous) * 100
}

type StatCardProps = {
    title: string
    value: string
    subValue?: string
    change?: number | null
    color?: string
    icon?: string
}

function StatCard({ title, value, subValue, change, color = 'primary.main', icon }: StatCardProps) {
    const isUp = (change ?? 0) > 0
    const isDown = (change ?? 0) < 0
    return (
        <Card sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                {icon && (
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
                )}
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {title}
                    </Typography>
                    <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
                        {value}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        {subValue && (
                            <Typography variant="caption" color="text.secondary">
                                {subValue}
                            </Typography>
                        )}
                        {change !== undefined && change !== null && (
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0.25}
                                sx={{
                                    color: isUp
                                        ? 'success.main'
                                        : isDown
                                          ? 'error.main'
                                          : 'text.disabled',
                                }}
                            >
                                <Iconify
                                    icon={
                                        isUp
                                            ? 'eva:trending-up-fill'
                                            : isDown
                                              ? 'eva:trending-down-fill'
                                              : 'eva:minus-fill'
                                    }
                                    width={14}
                                />
                                <Typography variant="caption" fontWeight={600}>
                                    {Math.abs(change).toFixed(1)}%
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                </Stack>
            </Stack>
        </Card>
    )
}

type Props = {
    data?: TokenOverviewResponse
    isLoading?: boolean
}

export function TokenOverview({ data, isLoading }: Props) {
    if (isLoading || !data) {
        return (
            <Grid container spacing={2}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Grid key={i} item xs={12} sm={6} md={3}>
                        <Card sx={{ p: 2.5, height: '100%' }}>
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="80%" height={36} />
                            <Skeleton variant="text" width="40%" />
                        </Card>
                    </Grid>
                ))}
            </Grid>
        )
    }

    const volumePct = pctChange(data.totals.total_volume_usd, data.previous.total_volume_usd)
    const txPct = pctChange(data.totals.total_tx_count, data.previous.total_tx_count)
    const userPct = pctChange(data.totals.unique_senders, data.previous.unique_senders)

    const netUsd = data.direction.net_usd
    const netLabel =
        netUsd >= 0 ? `+${formatUsd(netUsd)} → SUI` : `${formatUsd(Math.abs(netUsd))} → ETH`

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
                <StatCard
                    title="Total Volume"
                    value={formatUsd(data.totals.total_volume_usd)}
                    subValue="vs previous period"
                    change={volumePct}
                    icon="solar:dollar-minimalistic-bold-duotone"
                    color="primary.main"
                />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <StatCard
                    title="Transfers"
                    value={fNumber(data.totals.total_tx_count) || '0'}
                    subValue="vs previous period"
                    change={txPct}
                    icon="solar:transfer-horizontal-bold-duotone"
                    color="info.main"
                />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <StatCard
                    title="Unique Senders"
                    value={fNumber(data.totals.unique_senders) || '0'}
                    subValue="vs previous period"
                    change={userPct}
                    icon="solar:users-group-rounded-bold-duotone"
                    color="warning.main"
                />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <StatCard
                    title="Net Flow"
                    value={netLabel}
                    subValue={`Avg ${formatUsd(data.totals.avg_tx_usd)} / tx`}
                    icon="solar:routing-2-bold-duotone"
                    color={netUsd >= 0 ? 'success.main' : 'error.main'}
                />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2.5 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Inflow (ETH → SUI)
                        </Typography>
                        <Typography variant="h6" color="success.main">
                            {formatUsd(data.direction.inflow_usd)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {fNumber(data.direction.inflow_count)} transfers
                        </Typography>
                    </Stack>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2.5 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Outflow (SUI → ETH)
                        </Typography>
                        <Typography variant="h6" color="error.main">
                            {formatUsd(data.direction.outflow_usd)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {fNumber(data.direction.outflow_count)} transfers
                        </Typography>
                    </Stack>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2.5 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Largest Transfer
                        </Typography>
                        <Typography variant="h6">{formatUsd(data.totals.max_tx_usd)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Min {formatUsd(data.totals.min_tx_usd)}
                        </Typography>
                    </Stack>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2.5 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Current Price
                        </Typography>
                        <Typography variant="h6">
                            ${fShortenNumber(data.price_usd) || '0'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Decimals: {data.decimals}
                        </Typography>
                    </Stack>
                </Card>
            </Grid>
        </Grid>
    )
}
