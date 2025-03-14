import React from 'react'
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
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { UserStatsType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'

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
            <Typography variant="h4" gutterBottom>
                Bridge Statistics Dashboard
            </Typography>
            <Grid container spacing={3}>
                {/* Row 1: Summary (full width) */}
                <Grid item xs={12}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #3f51b5' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:activity-outline"
                                    width={24}
                                    height={24}
                                    color="#3f51b5"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Summary</Typography>
                            </Box>
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
                {/* Row 2: Chain Activity & Transaction Date Range */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #009688' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:trending-up-outline"
                                    width={24}
                                    height={24}
                                    color="#009688"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Chain Activity</Typography>
                            </Box>
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
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #f44336' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:clock-outline"
                                    width={24}
                                    height={24}
                                    color="#f44336"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Transaction Date Range</Typography>
                            </Box>
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
                {/* Row 3: Extreme Transactions & Additional Metrics */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #9c27b0' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:bar-chart-outline"
                                    width={24}
                                    height={24}
                                    color="#9c27b0"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Extreme Transactions</Typography>
                            </Box>
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
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #607d8b' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:metrics-outline"
                                    width={24}
                                    height={24}
                                    color="#607d8b"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Additional Metrics</Typography>
                            </Box>
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
                {/* Row 4: Most Active Entities & SUI Inflow/Outflow */}
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #8bc34a' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:people-outline"
                                    width={24}
                                    height={24}
                                    color="#8bc34a"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Most Active Entities</Typography>
                            </Box>
                            <Typography>
                                Most Used Token: {stats.mostUsedToken} ({stats.mostUsedTokenCount})
                            </Typography>
                            <Typography>Unique Tokens: {stats.uniqueTokensCount}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #00bcd4' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:swap-horizontal-outline"
                                    width={24}
                                    height={24}
                                    color="#00bcd4"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">SUI Inflow / Outflow</Typography>
                            </Box>
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
                {/* Row 5: Token Stats Table (full width) */}
                <Grid item xs={12}>
                    <Card elevation={3} sx={{ borderLeft: '5px solid #ff9800' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Iconify
                                    icon="eva:list-outline"
                                    width={24}
                                    height={24}
                                    color="#ff9800"
                                    style={{ marginRight: 8 }}
                                />
                                <Typography variant="h6">Token Statistics</Typography>
                            </Box>
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
            </Grid>
        </Container>
    )
}

export default UserStatsWidgets
