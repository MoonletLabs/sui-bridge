'use client'

import {
    Card,
    CardHeader,
    Link as MuiLink,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import type { HashiActivityResponse } from 'src/pages/api/hashi/activity'
import { fBtc, shortAddress, sinceNote, suiAccountUrl } from './format'

/** The busiest Sui addresses by what they moved through Hashi (completed requests only) */
export function HashiAccounts({
    data,
    loading,
    network,
}: {
    data?: HashiActivityResponse
    loading: boolean
    network: string
}) {
    const accounts = data?.accounts ?? []
    // The recent-only view has too little history for a ranking
    if (!loading && (data?.mode !== 'full' || accounts.length === 0)) return null

    return (
        <Card>
            <CardHeader
                title="Top accounts"
                subheader={
                    data
                        ? `${data.accountCount.toLocaleString()} addresses have used Hashi${sinceNote(data.coverage)}. The busiest ${accounts.length}, by volume.`
                        : 'The busiest addresses, by volume'
                }
            />
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 48 }}>#</TableCell>
                            <TableCell>Sui address</TableCell>
                            <TableCell align="right">Deposits</TableCell>
                            <TableCell align="right">Withdrawals</TableCell>
                            <TableCell align="right">Volume</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading &&
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}>
                                        <Skeleton />
                                    </TableCell>
                                </TableRow>
                            ))}
                        {accounts.map((a, i) => (
                            <TableRow key={a.address} hover>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>
                                    <MuiLink
                                        href={suiAccountUrl(a.address, network)}
                                        target="_blank"
                                        rel="noopener"
                                        underline="hover"
                                    >
                                        {shortAddress(a.address, 8, 6)}
                                    </MuiLink>
                                </TableCell>
                                <TableCell align="right">
                                    {a.deposits.toLocaleString()}
                                    <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {' · '}
                                        {fBtc(a.depositSats)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    {a.withdrawals.toLocaleString()}
                                    <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {' · '}
                                        {fBtc(a.withdrawalSats)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                    {fBtc(a.depositSats + a.withdrawalSats)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Stack sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    Counts and amounts are completed requests. Addresses link to Suiscan.
                </Typography>
            </Stack>
        </Card>
    )
}
