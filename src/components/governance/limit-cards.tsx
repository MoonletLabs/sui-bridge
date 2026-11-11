'use client'

import { Box, Card, Grid, LinearProgress, Skeleton, Tooltip, Typography } from '@mui/material'
import useSWR from 'swr'
import { Iconify } from 'src/components/iconify'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { fGovUsd } from 'src/utils/governance'
import { fDateTime } from 'src/utils/format-time'
import type { GovernanceResponse, RouteLimit } from 'src/pages/api/governance'

const ROUTE_COLOR = { 'ETH → SUI': '#16A34A', 'SUI → ETH': '#627EEA' } as const

/** Same thresholds a person would use: calm, getting busy, nearly full */
const barColor = (u: number | null): 'primary' | 'warning' | 'error' =>
    u === null || u < 0.6 ? 'primary' : u < 0.85 ? 'warning' : 'error'

function LimitCard({ limit }: { limit: RouteLimit }) {
    const label = `${limit.from} → ${limit.to}` as keyof typeof ROUTE_COLOR
    const color = ROUTE_COLOR[label]
    const pct = limit.utilization === null ? null : limit.utilization * 100
    const blocked = limit.limit_usd < 1

    return (
        <Card variant="outlined" sx={{ p: 2.5, height: '100%', borderLeft: `4px solid ${color}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color }}>
                    {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    updated {fDateTime(limit.updated_ms)}
                </Typography>
            </Box>

            <Typography variant="h4" fontWeight={700} sx={{ fontFamily: 'Barlow', mt: 1 }}>
                {blocked ? 'Blocked' : fGovUsd(limit.limit_usd)}
                {!blocked && (
                    <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        / 24h limit
                    </Typography>
                )}
            </Typography>

            {!blocked && (
                <>
                    <Tooltip title="Value moved on this route in the last 24 hours, at current token prices. The bridge enforces its limit with its own on-chain notional prices over a rolling window, so this is an approximation.">
                        <Box sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Used last 24h
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {fGovUsd(limit.usage_24h_usd)}
                                    {pct !== null && ` · ${pct < 0.1 ? '<0.1' : pct.toFixed(1)}%`}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, pct ?? 0)}
                                color={barColor(limit.utilization)}
                                sx={{ height: 8, borderRadius: 4 }}
                            />
                        </Box>
                    </Tooltip>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: 'block' }}
                    >
                        {limit.transfers_24h.toLocaleString()} transfers in the last 24h
                    </Typography>
                </>
            )}
            {blocked && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    The limit on this route is set to effectively zero, so transfers are not
                    accepted.
                </Typography>
            )}
        </Card>
    )
}

export function LimitCards() {
    const network = getNetwork()
    const { data, isLoading, error } = useSWR<GovernanceResponse>(
        `${endpoints.governance}?network=${network}&limit=1`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 },
    )

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Iconify
                    icon="solar:speedometer-max-bold-duotone"
                    width={22}
                    sx={{ color: 'info.main' }}
                />
                <Typography variant="h6" fontWeight="bold">
                    Current Transfer Limits
                </Typography>
            </Box>
            {error ? (
                <Typography variant="body2" color="error.main">
                    Could not load bridge limits. Please try again.
                </Typography>
            ) : (
                <Grid container spacing={2.5}>
                    {isLoading || !data ? (
                        [0, 1].map(i => (
                            <Grid item xs={12} md={6} key={i}>
                                <Skeleton variant="rounded" height={170} />
                            </Grid>
                        ))
                    ) : data.limits.length === 0 ? (
                        <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                                No limit updates recorded on this network.
                            </Typography>
                        </Grid>
                    ) : (
                        [...data.limits]
                            .sort((a, b) => a.from.localeCompare(b.from))
                            .map(l => (
                                <Grid item xs={12} md={6} key={`${l.from}-${l.to}`}>
                                    <LimitCard limit={l} />
                                </Grid>
                            ))
                    )}
                </Grid>
            )}
        </Box>
    )
}
