'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    Box,
    Card,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Tabs,
    Tab,
    Typography,
    Skeleton,
    Chip,
    Tooltip,
    IconButton,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { endpoints, fetcher } from 'src/utils/axios'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { fCurrency, fNumber, fShortenNumber } from 'src/utils/format-number'
import { fDate } from 'src/utils/format-time'
import { Iconify } from 'src/components/iconify'
import { paths } from 'src/routes/paths'

import { MedalRank } from './medal-rank'
import { AddressCell } from './address-cell'
import { ActivitySparkline } from './activity-sparkline'
import { LeaderboardStats } from './leaderboard-stats'

import type { LeaderboardResponse } from 'src/pages/api/leaderboard'
import type { SparklineResponse } from 'src/pages/api/leaderboard-sparklines'

type AddressTypeFilter = 'all' | 'sui' | 'eth'
type SortByOption = 'volume' | 'count'

const ROWS_PER_PAGE = 25

export function LeaderboardTable() {
    const theme = useTheme()
    const router = useRouter()
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()

    const [page, setPage] = useState(0)
    const [addressType, setAddressType] = useState<AddressTypeFilter>('all')
    const [sortBy, setSortBy] = useState<SortByOption>('volume')

    // Reset page when filters change
    useEffect(() => {
        setPage(0)
    }, [addressType, sortBy, timePeriod])

    // Build query string
    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            network,
            period: timePeriod,
            addressType,
            sortBy,
            limit: String(ROWS_PER_PAGE),
            offset: String(page * ROWS_PER_PAGE),
        })
        return params.toString()
    }, [network, timePeriod, addressType, sortBy, page])

    // Fetch leaderboard data
    const { data, isLoading, error } = useSWR<LeaderboardResponse>(
        `${endpoints.leaderboard}?${queryString}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 30000,
        },
    )

    // Get addresses for sparklines
    const addresses = useMemo(() => {
        return data?.users?.map(u => u.address) || []
    }, [data?.users])

    // Fetch sparklines data
    const { data: sparklineData } = useSWR<SparklineResponse>(
        addresses.length > 0
            ? `${endpoints.leaderboardSparklines}?network=${network}&period=${encodeURIComponent(timePeriod)}&addresses=${addresses.join(',')}`
            : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        },
    )

    const handleChangePage = (_: unknown, newPage: number) => {
        setPage(newPage)
    }

    const handleAddressTypeChange = (_: React.SyntheticEvent, newValue: AddressTypeFilter) => {
        if (newValue !== null) {
            setAddressType(newValue)
        }
    }

    const handleSortChange = (_: React.MouseEvent<HTMLElement>, newSort: SortByOption) => {
        if (newSort !== null) {
            setSortBy(newSort)
        }
    }

    const handleRowClick = (address: string, addressType: 'sui' | 'eth') => {
        const queryParam = addressType === 'sui' ? 'suiAddress' : 'ethAddress'
        router.push(`${paths.profile.root}?${queryParam}=0x${address}`)
    }

    const users = data?.users || []
    const total = data?.total || 0
    const stats = data?.stats

    return (
        <Box>
            {/* Stats Cards */}
            <LeaderboardStats
                totalUsers={stats?.total_users || 0}
                totalVolumeUsd={stats?.total_volume_usd || 0}
                avgVolumePerUser={stats?.avg_volume_per_user || 0}
                topUserAddress={stats?.top_user_address || ''}
                topUserVolume={stats?.top_user_volume || 0}
                isLoading={isLoading}
            />

            {/* Main Card */}
            <Card>
                {/* Header with tabs and filters */}
                <Box
                    sx={{
                        px: 2,
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    }}
                >
                    {/* Address Type Tabs */}
                    <Tabs
                        value={addressType}
                        onChange={handleAddressTypeChange}
                        sx={{
                            minHeight: 40,
                            '& .MuiTab-root': {
                                minHeight: 40,
                                py: 1,
                            },
                        }}
                    >
                        <Tab
                            value="all"
                            label="All Users"
                            icon={<Iconify icon="solar:users-group-rounded-bold" width={18} />}
                            iconPosition="start"
                        />
                        <Tab
                            value="sui"
                            label="SUI"
                            icon={
                                <img
                                    src="/assets/icons/brands/sui.svg"
                                    alt="SUI"
                                    style={{ width: 18, height: 18 }}
                                />
                            }
                            iconPosition="start"
                        />
                        <Tab
                            value="eth"
                            label="ETH"
                            icon={
                                <img
                                    src="/assets/icons/brands/eth.svg"
                                    alt="ETH"
                                    style={{ width: 18, height: 18 }}
                                />
                            }
                            iconPosition="start"
                        />
                    </Tabs>

                    {/* Sort By Toggle */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Sort by:
                        </Typography>
                        <ToggleButtonGroup
                            value={sortBy}
                            exclusive
                            onChange={handleSortChange}
                            size="small"
                        >
                            <ToggleButton value="volume">
                                <Iconify
                                    icon="solar:wallet-money-bold"
                                    width={18}
                                    sx={{ mr: 0.5 }}
                                />
                                Volume
                            </ToggleButton>
                            <ToggleButton value="count">
                                <Iconify icon="solar:hashtag-bold" width={18} sx={{ mr: 0.5 }} />
                                Tx Count
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                {/* Table */}
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell width={70} align="center">
                                    Rank
                                </TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell align="right">Volume (USD)</TableCell>
                                <TableCell align="right">Transactions</TableCell>
                                <TableCell align="center">Top Token</TableCell>
                                <TableCell align="center" width={100}>
                                    Activity
                                </TableCell>
                                <TableCell align="right">First Active</TableCell>
                                <TableCell align="right">Last Active</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                // Loading skeletons
                                Array.from({ length: 10 }).map((_, index) => (
                                    <TableRow key={index}>
                                        <TableCell align="center">
                                            <Skeleton variant="circular" width={40} height={40} />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton width={180} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Skeleton width={100} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Skeleton width={60} />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Skeleton width={60} />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Skeleton width={80} height={30} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Skeleton width={80} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Skeleton width={80} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 2,
                                            }}
                                        >
                                            <Iconify
                                                icon="solar:users-group-rounded-broken"
                                                width={48}
                                                color="text.secondary"
                                            />
                                            <Typography variant="body1" color="text.secondary">
                                                No users found for the selected filters
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user, index) => {
                                    const globalRank = page * ROWS_PER_PAGE + index + 1
                                    const sparklineValues =
                                        sparklineData?.sparklines?.[user.address] || []

                                    return (
                                        <TableRow
                                            key={user.address}
                                            hover
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: alpha(
                                                        theme.palette.primary.main,
                                                        0.04,
                                                    ),
                                                },
                                                // Highlight top 3
                                                ...(globalRank <= 3 && {
                                                    bgcolor: alpha(
                                                        globalRank === 1
                                                            ? '#FFD700'
                                                            : globalRank === 2
                                                              ? '#C0C0C0'
                                                              : '#CD7F32',
                                                        0.04,
                                                    ),
                                                }),
                                            }}
                                            onClick={() =>
                                                handleRowClick(user.address, user.address_type)
                                            }
                                        >
                                            <TableCell align="center">
                                                <MedalRank rank={globalRank} />
                                            </TableCell>
                                            <TableCell>
                                                <AddressCell
                                                    address={user.address}
                                                    addressType={user.address_type}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={600}>
                                                    {fCurrency(user.total_volume_usd)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2">
                                                    {fNumber(user.transaction_count)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={user.most_used_token}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 500 }}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <ActivitySparkline data={sparklineValues} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" color="text.secondary">
                                                    {fDate(user.first_tx_date)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" color="text.secondary">
                                                    {fDate(user.last_tx_date)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Pagination */}
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={ROWS_PER_PAGE}
                    rowsPerPageOptions={[ROWS_PER_PAGE]}
                />
            </Card>
        </Box>
    )
}
