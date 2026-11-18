'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
    IconButton,
    LinearProgress,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import NextLink from 'next/link'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { CopyButton } from 'src/components/copy-button'
import { Iconify } from 'src/components/iconify'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { useRouter } from 'src/routes/hooks'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { buildProfileQuery } from 'src/utils/helper'
import { truncateAddress, formatExplorerUrl } from 'src/config/helper'
import type { TokenHoldersResponse } from 'src/pages/api/token/[id]/holders'

type SortBy = 'volume' | 'count'

const PAGE_SIZE = 25

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
    const router = useRouter()
    const { timePeriod } = useGlobalContext()
    const [sortBy, setSortBy] = useState<SortBy>('volume')
    const [page, setPage] = useState(0)

    // Back to the first page whenever the ranking itself changes
    useEffect(() => {
        setPage(0)
    }, [sortBy, timePeriod, tokenId, network])

    const url = `${endpoints.token.holders(tokenId)}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&sortBy=${sortBy}`

    const { data, isLoading } = useSWR<TokenHoldersResponse>(url, fetcher, {
        revalidateOnFocus: false,
        keepPreviousData: true,
    })

    const holders = data?.holders ?? []
    const total = data?.total ?? 0

    return (
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Top Senders"
                subheader={`Bridge activity by sender address · ${total} unique`}
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

            {/* How concentrated is the volume? */}
            {data && data.period_volume_usd > 0 && (
                <Box sx={{ px: 3, pb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        The top 3 senders account for <b>{data.top3_share.toFixed(1)}%</b> of this
                        token&apos;s volume, the top 10 for <b>{data.top10_share.toFixed(1)}%</b>.
                    </Typography>
                </Box>
            )}

            <Box sx={{ p: { xs: 1, sm: 2 }, pt: 0 }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 50 }}>#</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell align="right">Volume (USD)</TableCell>
                                <TableCell sx={{ minWidth: 130 }}>Share</TableCell>
                                <TableCell align="right">Transfers</TableCell>
                                <TableCell align="right">Direction</TableCell>
                                <TableCell align="right">Last seen</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && !data && (
                                <>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            <TableCell colSpan={7}>
                                                <Skeleton height={28} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                            {!isLoading && holders.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        align="center"
                                        sx={{ color: 'text.secondary', py: 3 }}
                                    >
                                        No senders found in this period.
                                    </TableCell>
                                </TableRow>
                            )}
                            {holders.map(h => {
                                // Sender address chain is the *source* chain.
                                // address_type='eth' means the sender's address is on ETH,
                                // so they bridged ETH → SUI (inflow).
                                const senderChain = h.address_type === 'sui' ? 'SUI' : 'ETH'
                                const direction =
                                    senderChain === 'ETH'
                                        ? { label: 'ETH → SUI', color: '#16A34A' }
                                        : { label: 'SUI → ETH', color: '#627EEA' }
                                const explorerUrl = formatExplorerUrl({
                                    network,
                                    address: `0x${h.address}`,
                                    isAccount: true,
                                    chain: senderChain,
                                })
                                const share =
                                    data && data.period_volume_usd > 0
                                        ? (h.total_volume_usd / data.period_volume_usd) * 100
                                        : 0
                                const profileHref = buildProfileQuery(
                                    senderChain === 'SUI'
                                        ? { suiAddress: `0x${h.address}` }
                                        : { ethAddress: `0x${h.address}` },
                                )
                                return (
                                    <TableRow
                                        key={`${h.address}-${h.rank}`}
                                        hover
                                        sx={{ cursor: profileHref ? 'pointer' : 'default' }}
                                        onClick={e => {
                                            if ((e.target as HTMLElement).closest('a, button'))
                                                return
                                            if (profileHref) router.push(profileHref)
                                        }}
                                    >
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {h.rank}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Tooltip
                                                    title={`0x${h.address}. Click the row to see this address's bridge history`}
                                                    placement="top-start"
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontFamily="monospace"
                                                        {...(profileHref
                                                            ? {
                                                                  component: NextLink,
                                                                  href: profileHref,
                                                                  color: 'inherit',
                                                                  sx: { textDecoration: 'none' },
                                                              }
                                                            : {})}
                                                    >
                                                        {truncateAddress(`0x${h.address}`, 6)}
                                                    </Typography>
                                                </Tooltip>
                                                <CopyButton
                                                    value={`0x${h.address}`}
                                                    title="Copy address"
                                                    size={14}
                                                />
                                                <IconButton
                                                    size="small"
                                                    href={explorerUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label="View on explorer"
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
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(100, share)}
                                                    sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ width: 42, textAlign: 'right' }}
                                                >
                                                    {share < 0.1 ? '<0.1' : share.toFixed(1)}%
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">{fNumber(h.tx_count)}</TableCell>
                                        <TableCell align="right">
                                            <Chip
                                                label={direction.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: direction.color,
                                                    fontWeight: 700,
                                                    fontSize: '0.7rem',
                                                    '& .MuiChip-label': { color: '#fff' },
                                                }}
                                            />
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

                {total > PAGE_SIZE && (
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={PAGE_SIZE}
                        rowsPerPageOptions={[PAGE_SIZE]}
                    />
                )}
            </Box>
        </Card>
    )
}
