'use client'

import {
    Box,
    Card,
    CardHeader,
    Chip,
    Grid,
    LinearProgress,
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
import dayjs from 'dayjs'
import { useState } from 'react'
import type { HashiGovernance, HashiProposal } from 'src/utils/hashi-chain'
import { fBtc, fDuration, shortAddress } from './format'

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'default'> = {
    active: 'warning',
    executed: 'success',
    expired: 'default',
}

const TOP_VOTERS = 10

/** "bitcoin_withdrawal_minimum" -> BTC amount; anything else as-is */
const formatChange = (key: string, value: string) =>
    /minimum$/.test(key) && /^\d+$/.test(value) ? fBtc(Number(value)) : value

function Count({ label, value, sub }: { label: string; value: number; sub?: string }) {
    return (
        <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="h5">{value}</Typography>
            {sub && (
                <Typography variant="caption" color="text.secondary">
                    {sub}
                </Typography>
            )}
        </Card>
    )
}

function ProposalRow({ p }: { p: HashiProposal }) {
    const quorumPct = p.quorumBps / 100
    return (
        <TableRow hover>
            <TableCell sx={{ maxWidth: 360 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p.description ?? p.type}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={p.type} />
                    {p.changes.map(c => (
                        <Chip
                            key={c.key}
                            size="small"
                            variant="outlined"
                            label={`${c.key} → ${formatChange(c.key, c.value)}`}
                        />
                    ))}
                </Stack>
            </TableCell>
            <TableCell>
                <Chip size="small" color={STATUS_COLOR[p.status]} label={p.status} />
            </TableCell>
            <TableCell sx={{ minWidth: 180 }}>
                <Typography variant="body2">
                    {p.votes} votes · {p.voteWeightPct.toFixed(1)}% of weight
                </Typography>
                <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (p.voteWeightPct / quorumPct) * 100)}
                    color={p.voteWeightPct >= quorumPct ? 'success' : 'warning'}
                    sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                    {quorumPct.toFixed(2)}% needed
                </Typography>
            </TableCell>
            <TableCell>{p.creatorName ?? shortAddress(p.creator)}</TableCell>
            <TableCell align="right">{dayjs(p.createdMs).format('MMM D, YYYY')}</TableCell>
            <TableCell align="right">
                {p.executedMs
                    ? fDuration(p.executedMs - p.createdMs)
                    : p.status === 'active'
                      ? `expires ${dayjs(p.expiresMs).format('MMM D')}`
                      : '-'}
            </TableCell>
        </TableRow>
    )
}

export function HashiGovernanceSection({
    data,
    loading,
}: {
    data?: HashiGovernance
    loading: boolean
}) {
    const [showAllVoters, setShowAllVoters] = useState(false)
    const voters = data?.participation ?? []
    const shownVoters = showAllVoters ? voters : voters.slice(0, TOP_VOTERS)
    const total = data?.totalProposals ?? 0
    const empty = !loading && data && total === 0

    return (
        <>
            <Grid container spacing={2.5}>
                <Grid item xs={6} md={3}>
                    <Count
                        label="Active proposals"
                        value={data?.counts.active ?? 0}
                        sub="open for votes"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <Count
                        label="Executed proposals"
                        value={data?.counts.executed ?? 0}
                        sub="stay on-chain"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <Count
                        label="Expired, still on-chain"
                        value={data?.counts.expired ?? 0}
                        sub="deleted ones are not visible"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card sx={{ p: 2.5, height: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                            Quorum
                        </Typography>
                        <Typography variant="h5">2/3 of weight</Typography>
                        <Typography variant="caption" color="text.secondary">
                            5% to pause in an emergency
                        </Typography>
                    </Card>
                </Grid>
            </Grid>

            <Card sx={{ mt: 2.5 }}>
                <CardHeader
                    title="Proposals"
                    subheader="Any committee member can propose; creating one casts that member's vote. A proposal expires after 7 days."
                />
                {loading && (
                    <Box sx={{ p: 2.5, pt: 0 }}>
                        <Skeleton variant="rounded" height={120} />
                    </Box>
                )}
                {empty && (
                    <Box sx={{ p: 3, pt: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                            No governance proposals have been created on{' '}
                            {data?.network === 'testnet' ? 'testnet' : 'mainnet'} yet. They will
                            appear here once the committee creates one.
                        </Typography>
                    </Box>
                )}
                {total > 0 && (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Proposal</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Votes</TableCell>
                                    <TableCell>Created by</TableCell>
                                    <TableCell align="right">Created</TableCell>
                                    <TableCell align="right">Time to execute</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data?.proposals.map(p => <ProposalRow key={p.id} p={p} />)}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {total > 0 && (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            Vote weight is measured against today&apos;s committee, so it can differ
                            slightly from the weight at the time a proposal executed. Only
                            supporting votes are recorded on-chain.
                        </Typography>
                    </Box>
                )}
            </Card>

            {total > 0 && (
                <Card sx={{ mt: 2.5 }}>
                    <CardHeader
                        title="Operator participation"
                        subheader={`Proposals each operator supported, out of ${total}`}
                        action={
                            voters.length > TOP_VOTERS && (
                                <Chip
                                    size="small"
                                    clickable
                                    onClick={() => setShowAllVoters(v => !v)}
                                    label={
                                        showAllVoters
                                            ? `Show top ${TOP_VOTERS}`
                                            : `Show all ${voters.length}`
                                    }
                                />
                            )
                        }
                    />
                    <TableContainer sx={{ maxHeight: 480 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Operator</TableCell>
                                    <TableCell>Supported</TableCell>
                                    <TableCell align="right">Weight</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {shownVoters.map(v => (
                                    <TableRow key={v.validator} hover>
                                        <TableCell>{v.name ?? shortAddress(v.validator)}</TableCell>
                                        <TableCell sx={{ minWidth: 160 }}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={(v.votes / total) * 100}
                                                    sx={{ height: 6, borderRadius: 3, flex: 1 }}
                                                />
                                                <Typography variant="caption">
                                                    {v.votes}/{total}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">
                                            {v.weightPct.toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}
        </>
    )
}
