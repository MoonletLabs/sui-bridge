'use client'

import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Grid,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material'
import Link from 'next/link'
import { useMemo } from 'react'
import useSWR from 'swr'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { DashboardContent } from 'src/layouts/dashboard'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { getTokenMetaList, TokenMeta } from 'src/utils/token-meta'
import type { TokenSummaryResponse, TokenSummaryRow } from 'src/pages/api/token/summary'

function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return '$0'
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
    return `${sign}$${abs.toFixed(0)}`
}

type EnrichedRow = TokenSummaryRow & {
    meta: TokenMeta
    net_usd: number
}

export default function TokensIndexPage() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()

    // Memoize tokens by network so it doesn't generate a new array reference each render
    const tokens = useMemo(() => getTokenMetaList(network), [network])

    const url = `${endpoints.token.summary}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}`
    const { data, isLoading, error } = useSWR<TokenSummaryResponse>(url, fetcher, {
        revalidateOnFocus: false,
        // Avoid endless retries if the backend hangs / errors
        shouldRetryOnError: false,
        keepPreviousData: false,
    })

    const rows: EnrichedRow[] = useMemo(() => {
        if (!data) return []

        const apiByToken = Object.fromEntries(data.rows.map(r => [r.token_id, r]))

        return tokens
            .map(meta => {
                const row = apiByToken[meta.id] ?? {
                    token_id: meta.id,
                    inflow_usd: 0,
                    outflow_usd: 0,
                    inflow_count: 0,
                    outflow_count: 0,
                    total_volume_usd: 0,
                    total_tx_count: 0,
                    unique_senders: 0,
                    avg_tx_usd: 0,
                    max_tx_usd: 0,
                    prev_total_volume_usd: 0,
                }
                return {
                    ...row,
                    meta,
                    net_usd: row.inflow_usd - row.outflow_usd,
                }
            })
            .sort((a, b) => b.total_volume_usd - a.total_volume_usd)
    }, [data, tokens])

    const showSkeletons = !error && (isLoading || !data)

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Tokens" />
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:wallet-bold-duotone"
                        width={28}
                        sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="h4">Tokens</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Click a token to drill down: inflow/outflow, top senders, and transfer-size
                    distribution.
                </Typography>
            </Box>

            <Grid container spacing={2}>
                {showSkeletons &&
                    Array.from({ length: tokens.length || 8 }).map((_, i) => (
                        <Grid key={`s-${i}`} item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2.5 }}>
                                <Skeleton variant="rectangular" height={120} />
                            </Card>
                        </Grid>
                    ))}

                {!!error && (
                    <Grid item xs={12}>
                        <Card sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="error.main">
                                Failed to load tokens. Please try again.
                            </Typography>
                        </Card>
                    </Grid>
                )}

                {!showSkeletons && !error && rows.length === 0 && (
                    <Grid item xs={12}>
                        <Card sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No tokens configured for this network.
                            </Typography>
                        </Card>
                    </Grid>
                )}

                {!showSkeletons &&
                    !error &&
                    rows.map(row => (
                        <Grid key={row.token_id} item xs={12} sm={6} md={3}>
                            <Card sx={{ height: '100%' }}>
                                <CardActionArea
                                    LinkComponent={Link}
                                    href={paths.tokens.details(row.token_id)}
                                    sx={{ height: '100%' }}
                                >
                                    <CardContent sx={{ p: 2.5 }}>
                                        {/* Header: icon + ticker + name */}
                                        <Stack
                                            direction="row"
                                            spacing={2}
                                            alignItems="center"
                                            sx={{ mb: 2 }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 1.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: row.meta.color,
                                                    color: '#fff',
                                                    fontWeight: 700,
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {row.meta.icon ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={row.meta.icon}
                                                        alt={row.meta.ticker}
                                                        width={32}
                                                        height={32}
                                                        style={{ objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    row.meta.ticker.slice(0, 2).toUpperCase()
                                                )}
                                            </Box>
                                            <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                                                    {row.meta.ticker}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                >
                                                    {row.meta.name}
                                                </Typography>
                                            </Stack>
                                            <Iconify
                                                icon="eva:arrow-ios-forward-fill"
                                                width={20}
                                                sx={{ color: 'text.disabled', flexShrink: 0 }}
                                            />
                                        </Stack>

                                        {/* Volume highlight */}
                                        <Stack spacing={0.25} sx={{ mb: 2 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Total Volume
                                            </Typography>
                                            <Typography variant="h5">
                                                {formatUsd(row.total_volume_usd)}
                                            </Typography>
                                        </Stack>

                                        {/* Mini metrics row */}
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}
                                        >
                                            <Tooltip title="Bridged into Sui (ETH → SUI)">
                                                <Stack spacing={0.25} sx={{ flex: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Inflow
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        color="success.main"
                                                    >
                                                        {formatUsd(row.inflow_usd)}
                                                    </Typography>
                                                </Stack>
                                            </Tooltip>
                                            <Tooltip title="Bridged out of Sui (SUI → ETH)">
                                                <Stack spacing={0.25} sx={{ flex: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Outflow
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        color="error.main"
                                                    >
                                                        {formatUsd(row.outflow_usd)}
                                                    </Typography>
                                                </Stack>
                                            </Tooltip>
                                            <Stack spacing={0.25} sx={{ flex: 1 }}>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    Transfers
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {fNumber(row.total_tx_count) || '0'}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
            </Grid>
        </DashboardContent>
    )
}
