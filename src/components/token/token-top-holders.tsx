'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
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
    Tooltip,
    Typography,
    IconButton,
} from '@mui/material'
import { useState } from 'react'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { Iconify } from 'src/components/iconify'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { truncateAddress, formatExplorerUrl } from 'src/config/helper'
import type { TokenHoldersResponse } from 'src/pages/api/token/[id]/holders'

type SortBy = 'volume' | 'count'

function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return '$0'
    const abs = Math.abs(value)
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}k`
    return `$${value.toFixed(2)}`
}

type Props = {
    tokenId: number
}

export function TokenTopHolders({ tokenId }: Props) {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [sortBy, setSortBy] = useState<SortBy>('volume')

    const url = `${endpoints.token.holders(tokenId)}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}&limit=25&sortBy=${sortBy}`

    const { data, isLoading } = useSWR<TokenHoldersResponse>(url, fetcher, {
        revalidateOnFocus: false,
    })

    const holders = data?.holders ?? []

    return (
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Top Senders"
                subheader={`Bridge activity by sender address · ${data?.total ?? 0} unique`}
                action={
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={sortBy}
                        onChange={(_, v) => v && setSortBy(v)}
                    >
                        <ToggleButton value="volume">By Volume</ToggleButton>
                        <ToggleButton value="count">By Count</ToggleButton>
                    </ToggleButtonGroup>
                }
            />
            <Box sx={{ p: { xs: 1, sm: 2 }, pt: 0 }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 50 }}>#</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell align="right">Volume (USD)</TableCell>
                                <TableCell align="right">Transfers</TableCell>
                                <TableCell align="right">In / Out</TableCell>
                                <TableCell align="right">Last seen</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && !data && (
                                <>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            <TableCell colSpan={6}>
                                                <Skeleton height={28} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                            {!isLoading && holders.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        align="center"
                                        sx={{ color: 'text.secondary', py: 3 }}
                                    >
                                        No senders found in this period.
                                    </TableCell>
                                </TableRow>
                            )}
                            {holders.map(h => {
                                const chain = h.address_type === 'sui' ? 'SUI' : 'ETH'
                                const explorerUrl = formatExplorerUrl({
                                    network,
                                    address: h.address,
                                    isAccount: true,
                                    chain,
                                })
                                return (
                                    <TableRow key={`${h.address}-${h.rank}`} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {h.rank}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip
                                                    label={chain}
                                                    size="small"
                                                    sx={{
                                                        bgcolor:
                                                            chain === 'SUI'
                                                                ? 'rgba(77,162,255,0.15)'
                                                                : 'rgba(98,126,234,0.15)',
                                                        color:
                                                            chain === 'SUI' ? '#4DA2FF' : '#627EEA',
                                                        fontWeight: 600,
                                                        minWidth: 44,
                                                    }}
                                                />
                                                <Tooltip
                                                    title={`0x${h.address}`}
                                                    placement="top-start"
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontFamily="monospace"
                                                    >
                                                        {truncateAddress(`0x${h.address}`, 6)}
                                                    </Typography>
                                                </Tooltip>
                                                <IconButton
                                                    size="small"
                                                    href={explorerUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Iconify
                                                        icon="eva:external-link-fill"
                                                        width={14}
                                                    />
                                                </IconButton>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" fontWeight={600}>
                                                {formatUsd(h.total_volume_usd)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">{fNumber(h.tx_count)}</TableCell>
                                        <TableCell align="right">
                                            <Typography variant="caption" color="success.main">
                                                {fNumber(h.inflow_count)}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.disabled"
                                                sx={{ mx: 0.5 }}
                                            >
                                                /
                                            </Typography>
                                            <Typography variant="caption" color="error.main">
                                                {fNumber(h.outflow_count)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="caption" color="text.secondary">
                                                {h.last_tx_ms
                                                    ? dayjs(h.last_tx_ms).format('MMM D, YYYY')
                                                    : '—'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Card>
    )
}
