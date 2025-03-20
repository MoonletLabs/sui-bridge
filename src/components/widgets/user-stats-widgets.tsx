import {
    Box,
    CircularProgress,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import React from 'react'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { getTokensList, UserStatsType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { KeyValue } from './key-value'
import { ProfileCard } from './profile-card'

interface UserStatsWidgetsProps {
    ethAddress?: string
    suiAddress?: string
}

const UserStatsWidgets: React.FC<UserStatsWidgetsProps> = ({ ethAddress, suiAddress }) => {
    const network = getNetwork()

    const { data: stats, isLoading } = useSWR<UserStatsType>(
        `${endpoints.userStats}?network=${network}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''}`,
        fetcher,
    )

    if (isLoading) {
        return (
            <Box
                sx={{
                    alignContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    flex: 1,
                    alignSelf: 'center',
                }}
            >
                <CircularProgress size={25} sx={{ marginRight: 1 }} />

                <Typography variant="h5">Fetching stats...</Typography>
            </Box>
        )
    }

    if (!stats?.totalTransactions) {
        return (
            <Box
                sx={{
                    alignContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    flex: 1,
                    alignSelf: 'center',
                }}
            >
                <Typography variant="h4">No stats available for current selection</Typography>
            </Box>
        )
    }

    return (
        <Grid container spacing={3}>
            {/* Row 1: Summary (full width) */}
            <Grid item xs={12}>
                <ProfileCard
                    borderColor="#3f51b5"
                    icon="eva:activity-outline"
                    title="Bridge Summary"
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <KeyValue title="Total Bridges:" content={stats.totalTransactions} />
                            <KeyValue
                                title="Total Volume:"
                                content={fNumber(stats.totalUsdVolume, { prefix: '$' })}
                            />
                            <KeyValue
                                title="Inflow Volume:"
                                content={fNumber(stats.suiInflowVolume, { prefix: '$' })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <KeyValue
                                title="Largest Bridge:"
                                content={fNumber(stats.largestTx.amount_usd, { prefix: '$' })}
                            />
                            <KeyValue
                                title="Smallest Bridge:"
                                content={fNumber(stats.smallestTx.amount_usd, { prefix: '$' })}
                            />

                            <KeyValue
                                title="Outflow Volume:"
                                content={fNumber(stats.suiOutflowVolume, { prefix: '$' })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <KeyValue
                                title="Avg Bridge Value:"
                                content={fNumber(stats.avgTransactionUsd, { prefix: '$' })}
                            />
                            <KeyValue
                                title="Oldest Bridge:"
                                content={formatDistanceToNow(stats.earliestTx.timestamp_ms, {
                                    addSuffix: true,
                                })}
                            />
                            <KeyValue
                                title="Latest Bridge:"
                                content={formatDistanceToNow(stats.latestTx.timestamp_ms, {
                                    addSuffix: true,
                                })}
                            />
                        </Grid>
                    </Grid>
                </ProfileCard>
            </Grid>

            {/* New Chain Statistics Table */}
            <Grid item xs={12}>
                <ProfileCard
                    borderColor="#4caf50"
                    icon="eva:globe-outline"
                    title="Bridge Flow Statistics"
                >
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: '20%' }}>Flow</TableCell>
                                <TableCell align="right">Bridges</TableCell>
                                <TableCell align="right">Total USD</TableCell>
                                <TableCell align="right">Avg USD</TableCell>
                                <TableCell align="right">Different Tokens</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {stats?.chainStats &&
                                Object.entries(stats.chainStats).map(
                                    ([chain, data]: [
                                        string,
                                        {
                                            count: number
                                            differentTokensCount: number
                                            totalUsd: number
                                            avgUsd: number
                                        },
                                    ]) => (
                                        <TableRow
                                            key={chain}
                                            sx={{
                                                height: 60,
                                                borderRadius: 2,
                                                transition: 'all 0.3s ease-in-out',
                                                '&:hover': {
                                                    transform: 'scale(1.01)',
                                                },
                                            }}
                                        >
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <img
                                                        src={`/assets/icons/brands/eth.svg`}
                                                        alt={'eth logo'}
                                                        style={{ width: 24, height: 24 }}
                                                    />

                                                    <Iconify
                                                        width={20}
                                                        icon={
                                                            chain === 'ETH'
                                                                ? 'solar:round-arrow-right-bold-duotone'
                                                                : 'solar:round-arrow-left-bold-duotone'
                                                        }
                                                        sx={{
                                                            flexShrink: 0,
                                                            color:
                                                                chain === 'ETH'
                                                                    ? '#38B137'
                                                                    : '#FA3913',
                                                            marginLeft: 1,
                                                            marginRight: 1,
                                                        }}
                                                    />

                                                    <img
                                                        src={`/assets/icons/brands/sui.svg`}
                                                        alt={'SUI logo'}
                                                        style={{ width: 24, height: 24 }}
                                                    />
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight="bold"
                                                        sx={{ marginLeft: 1 }}
                                                    >
                                                        {chain === 'ETH' ? 'Inflow' : 'Outflow'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold">
                                                    {fNumber(data.count)}
                                                </Typography>
                                            </TableCell>

                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold">
                                                    {fNumber(data.totalUsd, { prefix: '$' })}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold">
                                                    {fNumber(data.avgUsd, { prefix: '$' })}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold">
                                                    {fNumber(data.differentTokensCount)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ),
                                )}
                        </TableBody>
                    </Table>
                </ProfileCard>
            </Grid>

            {/* Token Statistics */}
            <Grid item xs={12}>
                <ProfileCard
                    borderColor="#ff9800"
                    icon="eva:list-outline"
                    title="Bridge Token Statistics"
                >
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: '20%' }}>Token</TableCell>
                                <TableCell align="right">Bridges</TableCell>
                                <TableCell align="right">Total USD</TableCell>
                                <TableCell align="right">Avg USD</TableCell>
                                <TableCell align="right">Total Amount</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(stats.tokenStats).map(([token, data]: [any, any]) => (
                                <TableRow
                                    key={token}
                                    sx={{
                                        height: 60,
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease-in-out',
                                        '&:hover': {
                                            transform: 'scale(1.01)',
                                        },
                                    }}
                                >
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <img
                                                src={
                                                    getTokensList(network)?.find(
                                                        it => it.ticker === token,
                                                    )?.icon || ''
                                                }
                                                width={20}
                                                height={20}
                                                style={{ marginRight: 6 }}
                                            />
                                            <Typography variant="body2" fontWeight="bold">
                                                {getTokensList(network)?.find(
                                                    it => it.ticker === token,
                                                )?.name || ''}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight="bold">
                                            {fNumber(data.count)}
                                        </Typography>
                                    </TableCell>

                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight="bold">
                                            {fNumber(data.totalUsd, { prefix: '$' })}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight="bold">
                                            {fNumber(data.totalUsd / data.count, {
                                                prefix: '$',
                                            })}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'right',
                                            }}
                                        >
                                            <Typography variant="body2" fontWeight="bold">
                                                {fNumber(data.totalAmount)}
                                            </Typography>
                                            <Box>
                                                <img
                                                    src={
                                                        getTokensList(network)?.find(
                                                            it => it.ticker === token,
                                                        )?.icon || ''
                                                    }
                                                    width={20}
                                                    height={20}
                                                    style={{ marginLeft: 6 }}
                                                />
                                            </Box>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ProfileCard>
            </Grid>
        </Grid>
    )
}

export default UserStatsWidgets
