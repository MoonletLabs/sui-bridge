'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
    LinearProgress,
    Link,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { CopyButton } from 'src/components/copy-button'
import { Iconify } from 'src/components/iconify'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useQueryParamState } from 'src/hooks/use-query-param-state'
import { endpoints, fetcher } from 'src/utils/axios'
import { fDateTime } from 'src/utils/format-time'
import type { FailureSeverity } from 'src/utils/bridge-errors'
import type { FailuresResponse } from 'src/pages/api/health/failures'

const ROWS_PER_PAGE = 25

/**
 * `color` is the solid chip fill, paired with white text so chips stay legible
 * on the dark theme. `bar` is a brighter tone used for the share bars, which
 * sit on the card background and need more contrast.
 */
const SEVERITY: Record<
    FailureSeverity,
    { label: string; color: string; bar: string; hint: string }
> = {
    user: {
        label: 'User',
        color: '#D97706',
        bar: '#FBBF24',
        hint: 'Caused by how the transaction was submitted. Usually retryable.',
    },
    protocol: {
        label: 'Protocol',
        color: '#DC2626',
        bar: '#F87171',
        hint: 'Raised by bridge invariants or committee validation.',
    },
    unknown: {
        label: 'Other',
        color: '#64748B',
        bar: '#B6BECD',
        hint: 'Not mapped to a known bridge abort code.',
    },
}

export function FailuresPanel() {
    const theme = useTheme()
    const network = getNetwork()

    const [page, setPage] = useQueryParamState<number>('fpage', {
        defaultValue: 0,
        deserialize: raw => {
            const n = Number(raw)
            return Number.isInteger(n) && n > 0 ? n : null
        },
    })

    const query = useMemo(
        () =>
            new URLSearchParams({
                network,
                limit: String(ROWS_PER_PAGE),
                offset: String(page * ROWS_PER_PAGE),
            }).toString(),
        [network, page],
    )

    const { data, isLoading, error } = useSWR<FailuresResponse>(
        `${endpoints.health.failures}?${query}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 },
    )

    const breakdown = (data?.breakdown || []).slice(0, 6)
    const rows = data?.transactions || []
    const total = data?.total

    // Clamp an out of range page once the new network's total is known
    useEffect(() => {
        if (total === undefined) {
            return
        }
        const lastPage = total > 0 ? Math.ceil(total / ROWS_PER_PAGE) - 1 : 0
        if (page > lastPage) {
            setPage(lastPage)
        }
    }, [total, page, setPage])

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Why transactions fail */}
            <Card elevation={2}>
                <CardHeader
                    title={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Iconify
                                icon="solar:danger-triangle-bold-duotone"
                                width={22}
                                sx={{ color: 'error.main' }}
                            />
                            <Typography variant="h6" fontWeight="bold">
                                Why Transactions Fail
                            </Typography>
                        </Box>
                    }
                    subheader="Move abort codes decoded from the bridge contract, ranked by frequency"
                    subheaderTypographyProps={{ variant: 'body2' }}
                    sx={{ pb: 1 }}
                />
                <Box sx={{ px: 3, pb: 3 }}>
                    {isLoading &&
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={`fb-${i}`} height={56} sx={{ mb: 1 }} />
                        ))}

                    {!isLoading && error && (
                        <Typography variant="body2" color="error.main" sx={{ py: 3 }}>
                            Could not load failure breakdown. Please try again.
                        </Typography>
                    )}

                    {!isLoading && !error && breakdown.length === 0 && (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Iconify
                                icon="solar:check-circle-bold-duotone"
                                width={40}
                                sx={{ color: 'success.main', mb: 1 }}
                            />
                            <Typography variant="subtitle1">No failed transactions</Typography>
                            <Typography variant="body2" color="text.secondary">
                                No bridge transaction failures recorded on this network.
                            </Typography>
                        </Box>
                    )}

                    {!isLoading &&
                        breakdown.map(item => {
                            const sev = SEVERITY[item.severity]
                            return (
                                <Box key={item.key} sx={{ mb: 2.25 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mb: 0.75,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Tooltip title={sev.hint}>
                                            <Chip
                                                label={sev.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: sev.color,
                                                    fontWeight: 700,
                                                    fontSize: '0.7rem',
                                                    height: 20,
                                                    // The dark theme forces grey[800] on filled
                                                    // default chips, so set the label explicitly
                                                    '& .MuiChip-label': { color: '#fff' },
                                                }}
                                            />
                                        </Tooltip>
                                        <Typography variant="subtitle2" fontWeight={700}>
                                            {item.label}
                                        </Typography>
                                        {item.location && (
                                            <Typography
                                                variant="caption"
                                                fontFamily="monospace"
                                                color="text.secondary"
                                                sx={{ wordBreak: 'break-word' }}
                                            >
                                                {item.location}
                                                {item.abort_code !== undefined
                                                    ? ` · abort ${item.abort_code}`
                                                    : ''}
                                            </Typography>
                                        )}
                                        <Box sx={{ flex: 1 }} />
                                        <Typography variant="body2" fontWeight={700}>
                                            {item.count.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {item.share.toFixed(1)}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(item.share, 100)}
                                        sx={{
                                            height: 6,
                                            borderRadius: 1,
                                            bgcolor: alpha(theme.palette.grey[500], 0.16),
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: sev.bar,
                                                borderRadius: 1,
                                            },
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ mt: 0.5, display: 'block' }}
                                    >
                                        {item.description}
                                    </Typography>
                                </Box>
                            )
                        })}
                </Box>
            </Card>

            {/* Recent failures */}
            <Card elevation={2}>
                <CardHeader
                    title={
                        <Typography variant="h6" fontWeight="bold">
                            Recent Failed Transactions
                        </Typography>
                    }
                    subheader="Sui transactions that aborted while interacting with the bridge contract"
                    subheaderTypographyProps={{ variant: 'body2' }}
                    sx={{ pb: 1 }}
                />
                <TableContainer sx={{ minHeight: 260 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Reason</TableCell>
                                <TableCell>Sender</TableCell>
                                <TableCell>Transaction</TableCell>
                                <TableCell>When</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading &&
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={`ft-${i}`}>
                                        {Array.from({ length: 4 }).map((__, j) => (
                                            <TableCell key={`ft-${i}-${j}`}>
                                                <Skeleton height={24} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}

                            {!isLoading && !error && rows.length === 0 && total === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No failed transactions to show.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading &&
                                rows.map(r => {
                                    const sev = SEVERITY[r.severity]
                                    return (
                                        <TableRow key={r.tx_digest} hover>
                                            <TableCell>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Tooltip title={r.raw_status}>
                                                        <Chip
                                                            label={r.label}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: sev.color,
                                                                fontWeight: 700,
                                                                fontSize: '0.75rem',
                                                                maxWidth: '100%',
                                                                // The dark theme forces grey[800]
                                                                // on filled default chips
                                                                '& .MuiChip-label': {
                                                                    color: '#fff',
                                                                },
                                                            }}
                                                        />
                                                    </Tooltip>
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
                                                            address: r.sender_address,
                                                            isAccount: true,
                                                            chain: 'SUI',
                                                        })}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        underline="hover"
                                                        color="primary"
                                                        fontSize="0.8rem"
                                                        fontFamily="monospace"
                                                    >
                                                        {truncateAddress(r.sender_address, 6)}
                                                    </Link>
                                                    <CopyButton
                                                        value={r.sender_address}
                                                        title="Copy sender address"
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
                                                            address: r.tx_digest,
                                                            isAccount: false,
                                                            chain: 'SUI',
                                                        })}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        underline="hover"
                                                        color="primary"
                                                        fontSize="0.8rem"
                                                        fontFamily="monospace"
                                                    >
                                                        {truncateAddress(r.tx_digest, 6)}
                                                    </Link>
                                                    <CopyButton
                                                        value={r.tx_digest}
                                                        title="Copy transaction digest"
                                                        size={14}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
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
        </Box>
    )
}
