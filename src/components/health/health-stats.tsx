'use client'

import { Box, Card, Grid, Skeleton, Tooltip, Typography } from '@mui/material'
import { Iconify } from 'src/components/iconify'
import type { HealthSummaryResponse } from 'src/pages/api/health/summary'

type StatCardProps = {
    title: string
    value: string
    caption?: string
    hint?: string
    icon: string
    color: string
    isLoading?: boolean
}

function StatCard({ title, value, caption, hint, icon, color, isLoading }: StatCardProps) {
    return (
        <Card
            elevation={2}
            sx={{
                p: 2.5,
                height: '100%',
                borderLeft: `4px solid ${color}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Iconify icon={icon} width={22} sx={{ color }} />
                <Typography variant="body2" color="text.secondary">
                    {title}
                </Typography>
                {hint && (
                    <Tooltip title={hint}>
                        <Box sx={{ display: 'inline-flex' }}>
                            <Iconify
                                icon="eva:question-mark-circle-outline"
                                width={15}
                                sx={{ color: 'text.disabled' }}
                            />
                        </Box>
                    </Tooltip>
                )}
            </Box>

            {isLoading ? (
                <Skeleton width="70%" height={36} />
            ) : (
                <>
                    <Typography variant="h4" fontWeight={700} sx={{ fontFamily: 'Barlow' }}>
                        {value}
                    </Typography>
                    {caption && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {caption}
                        </Typography>
                    )}
                </>
            )}
        </Card>
    )
}

const fUsd = (n: number) => {
    if (!Number.isFinite(n)) return '$0'
    const abs = Math.abs(n)
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
    return `$${n.toFixed(0)}`
}

const fAge = (ms: number | null) => {
    if (!ms) return '—'
    const days = (Date.now() - ms) / 86400000
    if (days >= 365) return `${(days / 365).toFixed(1)} years`
    if (days >= 1) return `${Math.round(days)} days`
    return `${Math.round(days * 24)} hours`
}

export function HealthStats({
    data,
    isLoading,
}: {
    data?: HealthSummaryResponse
    isLoading?: boolean
}) {
    const cards: StatCardProps[] = [
        {
            title: 'Completion rate',
            value: data ? `${data.throughput.completion_rate.toFixed(2)}%` : '—',
            caption: data
                ? `${data.throughput.claimed.toLocaleString()} of ${data.throughput.deposited.toLocaleString()} deposits claimed`
                : undefined,
            hint: 'Share of all bridge deposits that reached the Claimed state.',
            icon: 'solar:check-circle-bold-duotone',
            color: '#22C55E',
        },
        {
            title: 'Unclaimed transfers',
            value: data ? data.unclaimed.count.toLocaleString() : '—',
            caption: data ? `${data.unclaimed.last_7d} in the last 7 days` : undefined,
            hint: 'Deposits that were never claimed on the destination chain. Funds remain recoverable by the recipient.',
            icon: 'solar:hourglass-bold-duotone',
            color: '#F59E0B',
        },
        {
            title: 'Value unclaimed',
            value: data ? fUsd(data.unclaimed.total_usd) : '—',
            caption: data ? `oldest ${fAge(data.unclaimed.oldest_timestamp_ms)} ago` : undefined,
            hint: 'Total USD value of all unclaimed transfers at current token prices.',
            icon: 'solar:wallet-money-bold-duotone',
            color: '#4DA2FF',
        },
        {
            title: 'Failed transactions',
            value: data ? data.failures.total.toLocaleString() : '—',
            caption: data ? `${data.failures.last_30d} in the last 30 days` : undefined,
            hint: 'Sui transactions that aborted while interacting with the bridge contract.',
            icon: 'solar:danger-triangle-bold-duotone',
            color: '#EF4444',
        },
    ]

    return (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {cards.map(card => (
                <Grid item xs={12} sm={6} md={3} key={card.title}>
                    <StatCard {...card} isLoading={isLoading} />
                </Grid>
            ))}
        </Grid>
    )
}
