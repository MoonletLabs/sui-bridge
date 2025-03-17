import {
    Box,
    Container,
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
                <Typography variant="h4">Loading data...</Typography>
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

    console.log(stats)

    return (
        <Container sx={{ mt: 4 }}>
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
                                <KeyValue
                                    title="Total Transactions:"
                                    content={stats.totalTransactions}
                                />
                                <KeyValue
                                    title="Total Volume:"
                                    content={fNumber(stats.totalUsdVolume, { prefix: '$' })}
                                />

                                <KeyValue
                                    title="Inflow Volume:"
                                    content={fNumber(stats.suiInflowVolume, { prefix: '$' })}
                                />
                                <KeyValue
                                    title="Outlflow Volume:"
                                    content={fNumber(stats.suiOutflowVolume, { prefix: '$' })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <KeyValue
                                    title="Largest Transaction:"
                                    content={fNumber(stats.largestTx.amount_usd, { prefix: '$' })}
                                />
                                <KeyValue
                                    title="Smallest Transaction:"
                                    content={fNumber(stats.smallestTx.amount_usd, { prefix: '$' })}
                                />

                                <KeyValue
                                    title="Avg Transaction Value:"
                                    content={fNumber(stats.avgTransactionUsd, { prefix: '$' })}
                                />

                                <KeyValue
                                    title="Median Transaction:"
                                    content={fNumber(stats.medianTransactionUsd, { prefix: '$' })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <KeyValue
                                    title="Bridges From SUI:"
                                    content={stats.chainCounts['SUI'] || '-'}
                                />

                                <KeyValue
                                    title="Bridges From Ethereum:"
                                    content={stats.chainCounts['ETH'] || '-'}
                                />
                                <KeyValue
                                    title="Earlies Transaction:"
                                    content={formatDistanceToNow(stats.earliestTx.timestamp_ms, {
                                        addSuffix: true,
                                    })}
                                />

                                <KeyValue
                                    title="Latest Transaction:"
                                    content={formatDistanceToNow(stats.latestTx.timestamp_ms, {
                                        addSuffix: true,
                                    })}
                                />
                            </Grid>
                        </Grid>
                    </ProfileCard>
                </Grid>
                <Grid item xs={12}>
                    <ProfileCard
                        borderColor="#ff9800"
                        icon="eva:list-outline"
                        title="Token Statistics"
                    >
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Token</TableCell>
                                    <TableCell align="right">Txs</TableCell>
                                    <TableCell align="right">Total Amount</TableCell>
                                    <TableCell align="right">Total USD</TableCell>
                                    <TableCell align="right">Avg USD</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.entries(stats.tokenStats).map(
                                    ([token, data]: [any, any]) => (
                                        <TableRow key={token}>
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
                                        </TableRow>
                                    ),
                                )}
                            </TableBody>
                        </Table>
                    </ProfileCard>
                </Grid>
            </Grid>
        </Container>
    )
}

export default UserStatsWidgets
