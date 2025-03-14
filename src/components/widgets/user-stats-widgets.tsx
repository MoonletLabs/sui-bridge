import React from 'react'
import {
    Container,
    Grid,
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from '@mui/material'
import { TransactionType } from 'src/utils/types'

// Helper function to format timestamps into readable dates
const formatDate = (timestamp_ms: number) => new Date(timestamp_ms).toLocaleString()

interface UserStatsWidgetsProps {
    transactions: TransactionType[]
}

const computeStats = (txs: TransactionType[]) => {
    const totalTransactions = txs.length
    const totalUsdVolume = txs.reduce((acc, tx) => acc + tx.amount_usd, 0)
    const avgTransactionUsd = totalTransactions > 0 ? totalUsdVolume / totalTransactions : 0

    // Median calculation:
    let medianTransactionUsd = 0
    if (totalTransactions > 0) {
        const sortedAmounts = txs.map(tx => tx.amount_usd).sort((a, b) => a - b)
        if (totalTransactions % 2 === 0) {
            medianTransactionUsd =
                (sortedAmounts[totalTransactions / 2 - 1] + sortedAmounts[totalTransactions / 2]) /
                2
        } else {
            medianTransactionUsd = sortedAmounts[Math.floor(totalTransactions / 2)]
        }
    }

    // Standard deviation calculation:
    let stdDeviationUsd = 0
    if (totalTransactions > 0) {
        const mean = avgTransactionUsd
        const variance =
            txs.reduce((acc, tx) => acc + Math.pow(tx.amount_usd - mean, 2), 0) / totalTransactions
        stdDeviationUsd = Math.sqrt(variance)
    }

    // Count transactions by originating chain (from_chain)
    const chainCounts = txs.reduce(
        (acc, tx) => {
            const chain = tx.from_chain
            acc[chain] = (acc[chain] || 0) + 1
            return acc
        },
        {} as { [chain: string]: number },
    )

    // Find the most active chain
    let mostActiveChain = ''
    let mostActiveChainCount = 0
    Object.entries(chainCounts).forEach(([chain, count]) => {
        if (count > mostActiveChainCount) {
            mostActiveChainCount = count
            mostActiveChain = chain
        }
    })

    // Find the earliest and latest transactions based on timestamp
    let earliestTx = txs[0]
    let latestTx = txs[0]
    txs.forEach(tx => {
        if (tx.timestamp_ms < earliestTx.timestamp_ms) earliestTx = tx
        if (tx.timestamp_ms > latestTx.timestamp_ms) latestTx = tx
    })

    // Identify the largest and smallest transactions by USD amount
    let largestTx = txs[0]
    let smallestTx = txs[0]
    txs.forEach(tx => {
        if (tx.amount_usd > largestTx.amount_usd) largestTx = tx
        if (tx.amount_usd < smallestTx.amount_usd) smallestTx = tx
    })

    // Compute stats per token (group by token name)
    const tokenStats = txs.reduce(
        (acc, tx) => {
            const tokenName = tx.token_info.name
            if (!acc[tokenName]) {
                acc[tokenName] = { count: 0, totalAmount: 0, totalUsd: 0 }
            }
            acc[tokenName].count += 1
            acc[tokenName].totalAmount += tx.amount
            acc[tokenName].totalUsd += tx.amount_usd
            return acc
        },
        {} as { [token: string]: { count: number; totalAmount: number; totalUsd: number } },
    )

    // Find the most used token
    let mostUsedToken = ''
    let mostUsedTokenCount = 0
    Object.entries(tokenStats).forEach(([token, stats]) => {
        if (stats.count > mostUsedTokenCount) {
            mostUsedTokenCount = stats.count
            mostUsedToken = token
        }
    })

    // Number of unique tokens
    const uniqueTokensCount = Object.keys(tokenStats).length

    // SUI Inflow/Outflow Volume
    const suiInflowVolume = txs.reduce((acc, tx) => {
        if (tx.destination_chain === 'SUI') {
            return acc + tx.amount_usd
        }
        return acc
    }, 0)

    const suiOutflowVolume = txs.reduce((acc, tx) => {
        if (tx.from_chain === 'SUI') {
            return acc + tx.amount_usd
        }
        return acc
    }, 0)

    return {
        totalTransactions,
        totalUsdVolume,
        avgTransactionUsd,
        medianTransactionUsd,
        stdDeviationUsd,
        chainCounts,
        mostActiveChain,
        mostActiveChainCount,
        earliestTx,
        latestTx,
        largestTx,
        smallestTx,
        tokenStats,
        mostUsedToken,
        mostUsedTokenCount,
        uniqueTokensCount,
        suiInflowVolume,
        suiOutflowVolume,
    }
}

const UserStatsWidgets: React.FC<UserStatsWidgetsProps> = ({ transactions }) => {
    const stats = computeStats(transactions)

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
                            {Object.entries(stats.chainCounts).map(([chain, count]) => (
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
                                Earliest: {formatDate(stats.earliestTx.timestamp_ms)}
                            </Typography>
                            <Typography>
                                Latest: {formatDate(stats.latestTx.timestamp_ms)}
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
                                    {Object.entries(stats.tokenStats).map(([token, data]) => (
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
                                    ))}
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
