'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
    Link,
    Skeleton,
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
import { alpha, useTheme } from '@mui/material/styles'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CopyButton } from 'src/components/copy-button'
import { Iconify } from 'src/components/iconify'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useQueryParamState } from 'src/hooks/use-query-param-state'
import { endpoints, fetcher } from 'src/utils/axios'
import { downloadCsv } from 'src/utils/csv'
import { fNumber } from 'src/utils/format-number'
import { fDateTime } from 'src/utils/format-time'
import type { UnclaimedResponse } from 'src/pages/api/health/unclaimed'

const ROWS_PER_PAGE = 25
type SortBy = 'age' | 'value'

const fUsd = (n: number) => {
    if (!Number.isFinite(n)) return '$0'
    const abs = Math.abs(n)
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
    return `$${n.toFixed(2)}`
}

const fAge = (hours: number) => {
    if (hours >= 8760) return `${(hours / 8760).toFixed(1)}y`
    if (hours >= 24) return `${Math.round(hours / 24)}d`
    return `${Math.round(hours)}h`
}

/**
 * Token amounts here span 1e-08 to thousands, so a fixed 2 decimal format
 * would render most dust transfers as "0". Keep significant digits instead.
 */
const fTokenAmount = (n: number) => {
    if (!Number.isFinite(n) || n === 0) return '0'
    if (n >= 1) return fNumber(n)
    if (n >= 0.0001) return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
    return n.toExponential(2)
}

/** Older + larger transfers are the ones worth chasing */
const ageTone = (hours: number) => {
    if (hours >= 8760) return { label: 'Over 1 year', color: '#EF4444' }
    if (hours >= 720) return { label: 'Over 30 days', color: '#F59E0B' }
    if (hours >= 24) return { label: 'Over 24 hours', color: '#4DA2FF' }
    return { label: 'Recent', color: '#22C55E' }
}

export function UnclaimedTable() {
    const theme = useTheme()
    const network = getNetwork()

    const [page, setPage] = useQueryParamState<number>('upage', {
        defaultValue: 0,
        deserialize: raw => {
            const n = Number(raw)
            return Number.isInteger(n) && n > 0 ? n : null
        },
    })
    const [sortBy, setSortBy] = useQueryParamState<SortBy>('usort', {
        defaultValue: 'age',
        deserialize: raw => (raw === 'value' ? raw : null),
    })

    const query = useMemo(
        () =>
            new URLSearchParams({
                network,
                sortBy,
                limit: String(ROWS_PER_PAGE),
                offset: String(page * ROWS_PER_PAGE),
            }).toString(),
        [network, sortBy, page],
    )

    const { data, isLoading, error } = useSWR<UnclaimedResponse>(
        `${endpoints.health.unclaimed}?${query}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 },
    )

    const rows = data?.transfers || []

    const handleExport = () => {
        downloadCsv(
            'unclaimed-bridge-transfers',
            rows.map(r => ({
                tx_hash: r.tx_hash,
                direction: r.direction,
                token: r.token_name,
                amount: r.amount,
                amount_usd: r.amount_usd,
                age_hours: Math.round(r.age_hours),
                deposited_at: new Date(r.timestamp_ms).toISOString(),
                sender_address: r.sender_address,
                recipient_address: r.recipient_address,
                nonce: r.nonce,
            })),
        )
    }

    return (
        <Card elevation={2}>
            <CardHeader
                title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Iconify
                            icon="solar:hourglass-bold-duotone"
                            width={22}
                            sx={{ color: 'warning.main' }}
                        />
                        <Typography variant="h6" fontWeight="bold">
                            Unclaimed Transfers
                        </Typography>
                    </Box>
                }
                subheader="Deposits that were never claimed on the destination chain. These funds are still recoverable by the recipient."
                subheaderTypographyProps={{ variant: 'body2' }}
                action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={sortBy}
                            onChange={(_, v: SortBy | null) => {
                                if (v) {
                                    setSortBy(v)
                                    setPage(0)
                                }
                            }}
                            aria-label="sort unclaimed"
                        >
                            <ToggleButton value="age">Oldest</ToggleButton>
                            <ToggleButton value="value">Largest</ToggleButton>
                        </ToggleButtonGroup>
                        <Tooltip title="Export current page to CSV">
                            <span>
                                <ToggleButton
                                    value="csv"
                                    size="small"
                                    selected={false}
                                    disabled={!rows.length}
                                    onClick={handleExport}
                                >
                                    <Iconify icon="solar:download-minimalistic-bold" width={18} />
                                </ToggleButton>
                            </span>
                        </Tooltip>
                    </Box>
                }
                sx={{ pb: 1, flexWrap: 'wrap', gap: 1 }}
            />

            <TableContainer sx={{ minHeight: 320 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Age</TableCell>
                            <TableCell>Direction</TableCell>
                            <TableCell>Token</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Recipient</TableCell>
                            <TableCell>Deposit tx</TableCell>
                            <TableCell>Deposited</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading &&
                            Array.from({ length: 8 }).map((_, i) => (
                                <TableRow key={`sk-${i}`}>
                                    {Array.from({ length: 7 }).map((__, j) => (
                                        <TableCell key={`sk-${i}-${j}`}>
                                            <Skeleton height={24} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}

                        {!isLoading && error && (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                    <Typography variant="body2" color="error.main">
                                        Could not load unclaimed transfers. Please try again.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading && !error && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                    <Iconify
                                        icon="solar:check-circle-bold-duotone"
                                        width={40}
                                        sx={{ color: 'success.main', mb: 1 }}
                                    />
                                    <Typography variant="subtitle1">
                                        No unclaimed transfers
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Every bridge deposit on this network has been claimed.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading &&
                            rows.map(r => {
                                const tone = ageTone(r.age_hours)
                                const isInflow = r.direction === 'ETH → SUI'
                                return (
                                    <TableRow key={`${r.chain_id}-${r.nonce}`} hover>
                                        <TableCell>
                                            <Tooltip title={tone.label}>
                                                <Chip
                                                    label={fAge(r.age_hours)}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: alpha(tone.color, 0.16),
                                                        color: tone.color,
                                                        fontWeight: 700,
                                                        minWidth: 52,
                                                    }}
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={r.direction}
                                                size="small"
                                                sx={{
                                                    bgcolor: isInflow ? '#22C55E' : '#EF4444',
                                                    color: '#fff',
                                                    fontWeight: 700,
                                                    fontSize: '0.7rem',
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {r.token_name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={`${r.amount} ${r.token_name}`}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {fTokenAmount(r.amount)}
                                                </Typography>
                                            </Tooltip>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                            >
                                                ≈ {fUsd(r.amount_usd)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.25,
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontFamily="monospace"
                                                    fontSize="0.8rem"
                                                >
                                                    {truncateAddress(`0x${r.recipient_address}`, 6)}
                                                </Typography>
                                                <CopyButton
                                                    value={`0x${r.recipient_address}`}
                                                    title="Copy recipient address"
                                                    size={14}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.25,
                                                }}
                                            >
                                                <Link
                                                    href={formatExplorerUrl({
                                                        network,
                                                        address: r.tx_hash,
                                                        isAccount: false,
                                                        chain: isInflow ? 'ETH' : 'SUI',
                                                    })}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    underline="hover"
                                                    color="primary"
                                                    fontSize="0.8rem"
                                                    fontFamily="monospace"
                                                >
                                                    {truncateAddress(`0x${r.tx_hash}`, 6)}
                                                </Link>
                                                <CopyButton
                                                    value={r.tx_hash}
                                                    title="Copy transaction hash"
                                                    size={14}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">
                                                {fDateTime(r.timestamp_ms)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={data?.total || 0}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={ROWS_PER_PAGE}
                rowsPerPageOptions={[ROWS_PER_PAGE]}
            />
        </Card>
    )
}
