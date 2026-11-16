'use client'

import { Box, Card, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material'
import { Iconify } from 'src/components/iconify'
import type { HashiOverview } from 'src/utils/hashi-chain'
import { fBtc, fDuration } from './format'

type StatProps = {
    title: string
    value: string
    sub?: string
    icon: string
    color?: string
    loading?: boolean
}

function Stat({ title, value, sub, icon, color = 'primary.main', loading }: StatProps) {
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
                </Stack>
            </Stack>
        </Card>
    )
}

export function HashiOverviewCards({ data, loading }: { data?: HashiOverview; loading: boolean }) {
    const backing = data?.backingRatio
    const queueTotal = (data?.pendingDeposits ?? 0) + (data?.pendingWithdrawals ?? 0)

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
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:shield-check-bold-duotone"
                    color="success.main"
                    title="BTC held by the committee"
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
                    value={data ? `${data.registeredMembers} operators` : '-'}
                    sub={data ? `Epoch ${data.epoch.toLocaleString()}` : undefined}
                />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                <Stat
                    loading={loading}
                    icon="solar:download-minimalistic-bold-duotone"
                    color="success.main"
                    title="Completed deposits"
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
