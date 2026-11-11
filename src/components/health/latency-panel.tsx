'use client'

import {
    Box,
    Card,
    CardHeader,
    Grid,
    Skeleton,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import useSWR from 'swr'
import { Chart } from 'src/components/chart'
import { Iconify } from 'src/components/iconify'
import { TimePeriod } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useQueryParamState } from 'src/hooks/use-query-param-state'
import { endpoints, fetcher } from 'src/utils/axios'
import type { LatencyResponse, LatencyStats } from 'src/pages/api/health/latency'

const PERIODS: TimePeriod[] = ['Last Week', 'Last Month', 'Last 6 months', 'All time']

/** Same identity colours as the direction chips in the unclaimed table */
const DIRECTION_COLOR = { 'ETH → SUI': '#16A34A', 'SUI → ETH': '#627EEA' } as const

/** Minutes -> compact human duration, down to seconds for sub-minute values */
export const fDuration = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—'
    if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`
    if (minutes < 60) return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)}m`
    const hours = minutes / 60
    if (hours < 48) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}d`
}

function DirectionCard({ stats }: { stats: LatencyStats }) {
    const color = DIRECTION_COLOR[stats.direction]
    const rows: { label: string; hint: string; p50: number | null; p95: number | null }[] = [
        {
            label: 'Approval',
            hint: 'Time from the deposit until the bridge committee approved it. This is the bridge’s own latency.',
            p50: stats.approval_p50,
            p95: stats.approval_p95,
        },
        {
            label: 'Claim',
            hint: 'Time from the deposit until it was claimed on the destination chain. Includes any wait for the recipient to claim.',
            p50: stats.claim_p50,
            p95: stats.claim_p95,
        },
    ]
    return (
        <Card variant="outlined" sx={{ p: 2.5, height: '100%', borderLeft: `4px solid ${color}` }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color }}>
                {stats.direction}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {stats.deposits.toLocaleString()} deposits · {stats.approved.toLocaleString()}{' '}
                approved · {stats.claimed.toLocaleString()} claimed
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, mt: 1.5 }}>
                {rows.map(r => (
                    <Box key={r.label}>
                        <Tooltip title={r.hint}>
                            <Typography variant="body2" color="text.secondary">
                                {r.label}
                            </Typography>
                        </Tooltip>
                        <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'Barlow' }}>
                            {fDuration(r.p50)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            median · p95 {fDuration(r.p95)}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Card>
    )
}

export function LatencyPanel() {
    const theme = useTheme()
    const network = getNetwork()
    const [period, setPeriod] = useQueryParamState<TimePeriod>('lperiod', {
        defaultValue: 'Last Month',
        deserialize: raw => (PERIODS.includes(raw as TimePeriod) ? (raw as TimePeriod) : null),
    })

    const { data, isLoading, error } = useSWR<LatencyResponse>(
        `${endpoints.health.latency}?network=${network}&period=${encodeURIComponent(period)}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 },
    )

    const series = useMemo(
        () =>
            (['ETH → SUI', 'SUI → ETH'] as const).map(direction => ({
                name: direction,
                data: (data?.series || [])
                    .filter(p => p.direction === direction && p.approval_p50 !== null)
                    .map(p => ({
                        x: new Date(`${p.date}T00:00:00Z`).getTime(),
                        y: Number((p.approval_p50 as number).toFixed(2)),
                    })),
            })),
        [data],
    )

    const options = useMemo(
        () => ({
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
            colors: [DIRECTION_COLOR['ETH → SUI'], DIRECTION_COLOR['SUI → ETH']],
            stroke: { curve: 'smooth' as const, width: 2 },
            dataLabels: { enabled: false },
            markers: { size: 0 },
            grid: { strokeDashArray: 3, borderColor: 'rgba(145, 158, 171, 0.2)' },
            xaxis: {
                type: 'datetime' as const,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: { format: 'dd MMM' },
            },
            // Sui->Eth approvals take seconds and Eth->Sui ~13 minutes, so a
            // log scale keeps both lines readable on one chart
            yaxis: {
                logarithmic: true,
                labels: { formatter: (v: number) => fDuration(v) },
                title: { text: 'Median approval time (log)' },
            },
            tooltip: { shared: true, y: { formatter: (v: number) => fDuration(v) } },
            legend: {
                position: 'top' as const,
                horizontalAlign: 'right' as const,
                labels: { colors: theme.palette.text.primary },
            },
        }),
        [theme],
    )

    return (
        <Card elevation={2}>
            <CardHeader
                title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Iconify
                            icon="solar:clock-circle-bold-duotone"
                            width={22}
                            sx={{ color: 'info.main' }}
                        />
                        <Typography variant="h6" fontWeight="bold">
                            Transfer Latency
                        </Typography>
                    </Box>
                }
                subheader="How long transfers take to be approved by the bridge committee and claimed on the destination chain."
                subheaderTypographyProps={{ variant: 'body2' }}
                action={
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={period}
                        onChange={(_, v: TimePeriod | null) => v && setPeriod(v)}
                        aria-label="latency period"
                    >
                        {PERIODS.map(p => (
                            <ToggleButton key={p} value={p}>
                                {p.replace('Last ', '')}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                }
                sx={{
                    pb: 1,
                    flexWrap: 'wrap',
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                }}
            />
            <Box sx={{ px: 2.5, pb: 2 }}>
                {error ? (
                    <Typography variant="body2" color="error.main" sx={{ py: 3 }}>
                        Could not load transfer latency. Please try again.
                    </Typography>
                ) : (
                    <>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            {isLoading || !data
                                ? [0, 1].map(i => (
                                      <Grid item xs={12} md={6} key={i}>
                                          <Skeleton variant="rounded" height={130} />
                                      </Grid>
                                  ))
                                : data.stats.length === 0
                                  ? null
                                  : [...data.stats]
                                        .sort((a, b) => a.direction.localeCompare(b.direction))
                                        .map(s => (
                                            <Grid item xs={12} md={6} key={s.direction}>
                                                <DirectionCard stats={s} />
                                            </Grid>
                                        ))}
                        </Grid>
                        {!isLoading && data && data.stats.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                No transfers in this period.
                            </Typography>
                        ) : (
                            <Chart
                                type="line"
                                series={series}
                                options={options}
                                height={280}
                                forceLoading={isLoading}
                                loadingProps={{ sx: { p: 2.5 } }}
                            />
                        )}
                    </>
                )}
            </Box>
        </Card>
    )
}
