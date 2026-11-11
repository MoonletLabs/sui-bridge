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
    Typography,
} from '@mui/material'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { CopyButton } from 'src/components/copy-button'
import { Iconify } from 'src/components/iconify'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useQueryParamState } from 'src/hooks/use-query-param-state'
import { endpoints, fetcher } from 'src/utils/axios'
import { fDateTime } from 'src/utils/format-time'
import type { GovernanceResponse } from 'src/pages/api/governance'

const ROWS_PER_PAGE = 25

const TONE_COLOR = {
    info: 'default',
    success: 'success',
    warning: 'warning',
    error: 'error',
} as const

export function GovernanceTimeline() {
    const network = getNetwork()

    const [page, setPage] = useQueryParamState<number>('gpage', {
        defaultValue: 0,
        deserialize: raw => {
            const n = Number(raw)
            return Number.isInteger(n) && n > 0 ? n : null
        },
    })
    const [action, setAction] = useQueryParamState<string>('gaction', {
        defaultValue: 'all',
        deserialize: raw => (/^[A-Za-z]{1,40}$/.test(raw) ? raw : null),
    })

    const query = useMemo(() => {
        const params = new URLSearchParams({
            network,
            limit: String(ROWS_PER_PAGE),
            offset: String(page * ROWS_PER_PAGE),
        })
        if (action !== 'all') params.set('action', action)
        return params.toString()
    }, [network, action, page])

    const { data, isLoading, error } = useSWR<GovernanceResponse>(
        `${endpoints.governance}?${query}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true },
    )

    const total = data?.total
    // A page that exists on one network may be out of range on the other
    useEffect(() => {
        if (total === undefined) return
        const lastPage = total > 0 ? Math.ceil(total / ROWS_PER_PAGE) - 1 : 0
        if (page > lastPage) setPage(lastPage)
    }, [total, page, setPage])

    const events = data?.events || []

    return (
        <Card elevation={2}>
            <CardHeader
                title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Iconify
                            icon="solar:history-bold-duotone"
                            width={22}
                            sx={{ color: 'primary.main' }}
                        />
                        <Typography variant="h6" fontWeight="bold">
                            Governance Timeline
                        </Typography>
                    </Box>
                }
                subheader="Every committee action recorded on both the Sui and Ethereum bridge contracts, newest first."
                subheaderTypographyProps={{ variant: 'body2' }}
                sx={{ pb: 1 }}
            />

            <Box sx={{ px: 2, pb: 1.5, overflowX: 'auto' }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={action}
                    onChange={(_, v: string | null) => {
                        if (v) {
                            setAction(v)
                            setPage(0)
                        }
                    }}
                    aria-label="filter governance actions"
                >
                    <ToggleButton value="all">All</ToggleButton>
                    {(data?.actions || []).map(a => (
                        <ToggleButton key={a.action} value={a.action}>
                            {a.label} ({a.count})
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            <TableContainer sx={{ minHeight: 280 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>When</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>Details</TableCell>
                            <TableCell>Chain</TableCell>
                            <TableCell>Transaction</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading &&
                            Array.from({ length: 6 }).map((_, i) => (
                                <TableRow key={`sk-${i}`}>
                                    {Array.from({ length: 5 }).map((__, j) => (
                                        <TableCell key={j}>
                                            <Skeleton height={24} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}

                        {!isLoading && error && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                                    <Typography variant="body2" color="error.main">
                                        Could not load governance events. Please try again.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading && !error && events.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        No governance events recorded.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading &&
                            events.map(e => (
                                <TableRow key={e.id} hover>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {fDateTime(e.timestamp_ms)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            color={TONE_COLOR[e.tone]}
                                            label={
                                                data?.actions.find(a => a.action === e.action)
                                                    ?.label || e.action
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{e.summary}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {e.source === 'SUI' ? 'Sui' : 'Ethereum'}
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
                                            <Link
                                                href={formatExplorerUrl({
                                                    network,
                                                    address: e.tx_digest,
                                                    isAccount: false,
                                                    chain: e.source,
                                                })}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                underline="hover"
                                                color="primary"
                                                fontSize="0.8rem"
                                                fontFamily="monospace"
                                            >
                                                {truncateAddress(e.tx_digest, 6)}
                                            </Link>
                                            <CopyButton
                                                value={e.tx_digest}
                                                title="Copy transaction hash"
                                                size={14}
                                            />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={total || 0}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={ROWS_PER_PAGE}
                rowsPerPageOptions={[ROWS_PER_PAGE]}
            />
        </Card>
    )
}
