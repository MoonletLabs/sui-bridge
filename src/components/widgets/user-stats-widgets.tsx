import {
    Box,
    Card,
    CardContent,
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
import { UserStatsType } from 'src/utils/types'
import useSWR from 'swr'

interface UserStatsWidgetsProps {
    ethAddress?: string
    suiAddress?: string
}

const UserStatsWidgets: React.FC<UserStatsWidgetsProps> = ({ ethAddress, suiAddress }) => {
    const network = getNetwork()

    const { data: stats, isLoading } = useSWR<UserStatsType>(
        `${endpoints.userStats}?network=${network}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''} `,
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
                <Typography variant={'h4'}>Loading data...</Typography>
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
                <Typography variant={'h4'}>
                    {!stats
                        ? 'Failed to load stats'
                        : !stats?.totalTransactions
                          ? 'No stats for current available'
                          : ''}
                </Typography>
            </Box>
        )
    }

    console.log(stats)

    return (
        <Container sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Bridge Statistics Dashboard
            </Typography>
            <Grid container spacing={3}>
                {/* Summary Card */}
                <Grid item xs={12} sm={4}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Summary
                            </Typography>
                            <Typography>Total Transactions: {stats.totalTransactions}</Typography>
                            <Typography>
                                Total USD Volume: $
                                {stats.totalUsdVolume.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                            <Typography>
                                Avg Transaction Value: $
                                {stats.avgTransactionUsd.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Chain Activity Card */}
                <Grid item xs={12} sm={4}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Chain Activity
                            </Typography>
                            {Object.entries(stats.chainCounts).map(([chain, count]: [any, any]) => (
                                <Typography key={chain}>
                                    {chain}: {count}
                                </Typography>
                            ))}
                            <Typography sx={{ mt: 1 }}>
                                Most Active Chain: {stats.mostActiveChain} (
                                {stats.mostActiveChainCount})
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Date Range Card */}
                <Grid item xs={12} sm={4}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Transaction Date Range
                            </Typography>
                            <Typography>
                                Earliest:{' '}
                                {formatDistanceToNow(stats.earliestTx.timestamp_ms, {
                                    addSuffix: true,
                                })}
                            </Typography>
                            <Typography>
                                Latest:{' '}
                                {formatDistanceToNow(stats.latestTx.timestamp_ms, {
                                    addSuffix: true,
                                })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Extreme Values Card */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Extreme Transactions
                            </Typography>
                            <Typography>
                                Largest Transaction: $
                                {stats.largestTx.amount_usd.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                            <Typography>
                                Smallest Transaction: $
                                {stats.smallestTx.amount_usd.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Token Stats Table Card */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Token Statistics
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Token</TableCell>
                                        <TableCell align="right">Count</TableCell>
                                        <TableCell align="right">Total Amount</TableCell>
                                        <TableCell align="right">Total USD</TableCell>
                                        <TableCell align="right">Avg USD</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(stats.tokenStats).map(
                                        ([token, data]: [any, any]) => (
                                            <TableRow key={token}>
                                                <TableCell>{token}</TableCell>
                                                <TableCell align="right">{data.count}</TableCell>
                                                <TableCell align="right">
                                                    {data.totalAmount.toLocaleString()}
                                                </TableCell>
                                                <TableCell align="right">
                                                    $
                                                    {data.totalUsd.toLocaleString(undefined, {
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </TableCell>
                                                <TableCell align="right">
                                                    $
                                                    {(data.totalUsd / data.count).toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 2,
                                                        },
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ),
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Additional Metrics Card */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Additional Metrics
                            </Typography>
                            <Typography>
                                Median Transaction Value: $
                                {stats.medianTransactionUsd.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                            <Typography>
                                Std. Deviation: $
                                {stats.stdDeviationUsd.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Most Active Entities Card */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Most Active Entities
                            </Typography>
                            <Typography>
                                Most Used Token: {stats.mostUsedToken} ({stats.mostUsedTokenCount})
                            </Typography>
                            <Typography>Unique Tokens: {stats.uniqueTokensCount}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                {/* SUI Inflow/Outflow Volume Card */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                SUI Inflow / Outflow Volume
                            </Typography>
                            <Typography>
                                Inflow Volume (USD): $
                                {stats.suiInflowVolume.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                            <Typography>
                                Outflow Volume (USD): $
                                {stats.suiOutflowVolume.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    )
}

export default UserStatsWidgets
