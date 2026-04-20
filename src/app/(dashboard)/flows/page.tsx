'use client'

import {
    Box,
    Card,
    CardHeader,
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
import { useMemo } from 'react'
import useSWR from 'swr'
import FlowSankey from 'src/components/chart/flow-sankey'
import TransferSizeHistogram from 'src/components/chart/transfer-size-histogram'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { getNetworkConfig } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { DashboardContent } from 'src/layouts/dashboard'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { FlowRow, getTokensList } from 'src/utils/types'
import { useState } from 'react'

const CHAIN_COLORS: Record<string, string> = {
    SUI: '#4DA2FF',
    ETH: '#627EEA',
}

function formatUsd(n: number): string {
    if (!Number.isFinite(n)) return '$0'
    const abs = Math.abs(n)
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
    return `$${n.toFixed(0)}`
}

function formatCount(n: number): string {
    if (!Number.isFinite(n)) return '0'
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
    return String(n)
}

export default function FlowsPage() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()
    const networkConfig = getNetworkConfig({ network })

    const [unit, setUnit] = useState<'usd' | 'count'>('usd')
    const [mode, setMode] = useState<'gross' | 'net'>('gross')

    const { data, isLoading } = useSWR<FlowRow[]>(
        `${endpoints.flows}?network=${network}&period=${encodeURIComponent(timePeriod)}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    // Helpers tied to current network config.
    const tokenList = getTokensList(network)
    const tokenColorByTicker: Record<string, string> = Object.fromEntries(
        tokenList.map(t => [t.ticker, t.color]),
    )

    const chainLabel = (id: number): string => {
        if (id === networkConfig.config.networkId.SUI) return 'SUI'
        if (id === networkConfig.config.networkId.ETH) return 'ETH'
        return `Chain ${id}`
    }

    const chainColor = (id: number): string => {
        const label = chainLabel(id)
        return CHAIN_COLORS[label] || '#888'
    }

    const tokenLabel = (id: number): string => {
        const coin = networkConfig.config.coins[id]
        return coin?.name || `Token ${id}`
    }

    const tokenColor = (id: number): string => {
        const name = tokenLabel(id)
        return tokenColorByTicker[name] || '#a78bfa'
    }

    // Filter by global selectedTokens + optionally apply "net flow" mode.
    const filteredRows: FlowRow[] = useMemo(() => {
        if (!data) return []
        let rows = data.filter(r => {
            if (r.src_chain === r.dst_chain) return false // defensive
            if (selectedTokens.includes('All')) return true
            return selectedTokens.includes(tokenLabel(r.token_id))
        })

        if (mode === 'net') {
            // Subtract reverse-direction value from each (src,dst,token) pair.
            // Resulting rows only keep the positive side.
            const key = (a: number, b: number, t: number) => `${a}|${b}|${t}`
            const byPair: Record<string, FlowRow> = {}
            rows.forEach(r => {
                byPair[key(r.src_chain, r.dst_chain, r.token_id)] = { ...r }
            })
            const seen = new Set<string>()
            const out: FlowRow[] = []
            Object.values(byPair).forEach(r => {
                const k = key(r.src_chain, r.dst_chain, r.token_id)
                const rk = key(r.dst_chain, r.src_chain, r.token_id)
                if (seen.has(k) || seen.has(rk)) return
                seen.add(k)
                seen.add(rk)
                const rev = byPair[rk]
                const netUsd = (r.usd || 0) - (rev?.usd || 0)
                const netCount = (r.count || 0) - (rev?.count || 0)
                if (netUsd === 0 && netCount === 0) return
                if (netUsd >= 0) {
                    out.push({
                        src_chain: r.src_chain,
                        dst_chain: r.dst_chain,
                        token_id: r.token_id,
                        usd: netUsd,
                        count: Math.max(0, netCount),
                    })
                } else {
                    out.push({
                        src_chain: r.dst_chain,
                        dst_chain: r.src_chain,
                        token_id: r.token_id,
                        usd: Math.abs(netUsd),
                        count: Math.abs(netCount),
                    })
                }
            })
            rows = out
        }
        return rows
    }, [data, mode, selectedTokens, networkConfig])

    const topRoutes = useMemo(() => {
        const sorted = [...filteredRows].sort((a, b) =>
            unit === 'usd' ? b.usd - a.usd : b.count - a.count,
        )
        return sorted.slice(0, 10)
    }, [filteredRows, unit])

    const totals = useMemo(() => {
        const totalUsd = filteredRows.reduce((s, r) => s + (r.usd || 0), 0)
        const totalCount = filteredRows.reduce((s, r) => s + (r.count || 0), 0)
        const routeCount = filteredRows.length
        return { totalUsd, totalCount, routeCount }
    }, [filteredRows])

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Bridge Flows" />

            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:routing-2-bold-duotone"
                        width={28}
                        sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="h4">Bridge Flows</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Directional bridge activity visualized as a Sankey — band width represents
                    volume or transfer count between chains and tokens over the selected period.
                </Typography>
            </Box>

            {/* Sankey card */}
            <Card sx={{ mb: 3 }}>
                <CardHeader
                    title="Source chain → Token → Destination chain"
                    subheader={
                        <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Total volume: <b>{formatUsd(totals.totalUsd)}</b>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Transfers: <b>{formatCount(totals.totalCount)}</b>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Routes: <b>{totals.routeCount}</b>
                            </Typography>
                        </Stack>
                    }
                    action={
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={unit}
                                onChange={(_, v) => v && setUnit(v)}
                                aria-label="unit"
                            >
                                <ToggleButton value="usd">USD</ToggleButton>
                                <ToggleButton value="count">Count</ToggleButton>
                            </ToggleButtonGroup>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={mode}
                                onChange={(_, v) => v && setMode(v)}
                                aria-label="mode"
                            >
                                <ToggleButton value="gross">Gross</ToggleButton>
                                <ToggleButton value="net">Net</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    }
                />
                <Box sx={{ p: { xs: 1, sm: 2 } }}>
                    {isLoading && !data ? (
                        <Box
                            sx={{
                                height: 520,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'text.secondary',
                            }}
                        >
                            <Typography variant="body2">Loading flows…</Typography>
                        </Box>
                    ) : (
                        <FlowSankey
                            data={filteredRows}
                            unit={unit}
                            height={520}
                            chainLabel={chainLabel}
                            chainColor={chainColor}
                            tokenLabel={tokenLabel}
                            tokenColor={tokenColor}
                        />
                    )}
                </Box>
            </Card>

            {/* Top routes */}
            <Card sx={{ mb: 4 }}>
                <CardHeader
                    title="Top Routes"
                    subheader={`Ranked by ${unit === 'usd' ? 'USD volume' : 'transfer count'}`}
                />
                <Box sx={{ p: { xs: 1, sm: 2 }, pt: 0 }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>Route</TableCell>
                                    <TableCell align="right">Volume (USD)</TableCell>
                                    <TableCell align="right">Transfers</TableCell>
                                    <TableCell align="right">Avg size</TableCell>
                                    <TableCell align="right">% of total</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {topRoutes.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            align="center"
                                            sx={{ color: 'text.secondary', py: 3 }}
                                        >
                                            No routes in the selected period.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {topRoutes.map((r, i) => {
                                    const avg = r.count > 0 ? r.usd / r.count : 0
                                    const pct =
                                        totals.totalUsd > 0
                                            ? ((r.usd / totals.totalUsd) * 100).toFixed(1)
                                            : '0.0'
                                    return (
                                        <TableRow
                                            key={`${r.src_chain}-${r.dst_chain}-${r.token_id}`}
                                            hover
                                        >
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell>
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                >
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {chainLabel(r.src_chain)}
                                                    </Typography>
                                                    <Iconify
                                                        icon="eva:arrow-forward-fill"
                                                        width={14}
                                                        sx={{ color: 'text.disabled' }}
                                                    />
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        sx={{ color: tokenColor(r.token_id) }}
                                                    >
                                                        {tokenLabel(r.token_id)}
                                                    </Typography>
                                                    <Iconify
                                                        icon="eva:arrow-forward-fill"
                                                        width={14}
                                                        sx={{ color: 'text.disabled' }}
                                                    />
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {chainLabel(r.dst_chain)}
                                                    </Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="right">{formatUsd(r.usd)}</TableCell>
                                            <TableCell align="right">
                                                {formatCount(r.count)}
                                            </TableCell>
                                            <TableCell align="right">{formatUsd(avg)}</TableCell>
                                            <TableCell align="right">{pct}%</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Card>

            <TransferSizeHistogram />
        </DashboardContent>
    )
}
