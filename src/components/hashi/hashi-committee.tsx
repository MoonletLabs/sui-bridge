'use client'

import {
    Avatar,
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
import { useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import type { HashiCommitteeResponse } from 'src/pages/api/hashi/committee'
import { shortAddress } from './format'

const TOP_N = 15

export function HashiCommitteeSummary({
    data,
    loading,
}: {
    data?: HashiCommitteeResponse
    loading: boolean
}) {
    const latest = data?.stats.at(-1)
    const items = [
        {
            label: 'Largest operator',
            value: latest ? `${latest.top1Pct.toFixed(2)}%` : '-',
            sub: data?.members[0]?.name ?? undefined,
        },
        {
            label: 'Top 10 operators',
            value: latest ? `${latest.top10Pct.toFixed(1)}%` : '-',
            sub: 'share of total weight',
        },
        {
            label: 'Operators needed to block',
            value: latest ? String(latest.blockingMembers) : '-',
            sub: 'more than 1/3 of weight',
        },
        {
            label: 'Operators needed for quorum',
            value: latest ? String(latest.quorumMembers) : '-',
            sub: '2/3 of weight',
        },
    ]
    return (
        <Grid container spacing={2.5}>
            {items.map(item => (
                <Grid item xs={6} md={3} key={item.label}>
                    <Card sx={{ p: 2.5, height: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                            {item.label}
                        </Typography>
                        {loading ? (
                            <Skeleton width={80} height={32} />
                        ) : (
                            <Typography variant="h5">{item.value}</Typography>
                        )}
                        {item.sub && !loading && (
                            <Typography variant="caption" color="text.secondary">
                                {item.sub}
                            </Typography>
                        )}
                    </Card>
                </Grid>
            ))}
        </Grid>
    )
}

export function HashiConcentrationChart({
    data,
    loading,
}: {
    data?: HashiCommitteeResponse
    loading: boolean
}) {
    const stats = data?.stats ?? []
    const options = useChart({
        chart: { type: 'line', toolbar: { show: false }, animations: { enabled: false } },
        stroke: { width: 2, curve: 'smooth' },
        colors: ['#00A76F', '#F7931A', '#7635DC'],
        xaxis: { categories: stats.map(s => `E${s.epoch}`), tickAmount: 8 },
        yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}%` } },
        legend: { position: 'top', horizontalAlign: 'right' },
        tooltip: { y: { formatter: (v: number) => `${v.toFixed(2)}%` } },
    })
    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                title="Weight concentration"
                subheader="Share of voting weight held by the biggest operators, per epoch"
            />
            <Box sx={{ p: 2, pt: 0 }}>
                {loading ? (
                    <Skeleton variant="rounded" height={280} />
                ) : (
                    <Chart
                        type="line"
                        height={280}
                        options={options}
                        series={[
                            { name: 'Top 1', data: stats.map(s => Number(s.top1Pct.toFixed(2))) },
                            { name: 'Top 5', data: stats.map(s => Number(s.top5Pct.toFixed(2))) },
                            { name: 'Top 10', data: stats.map(s => Number(s.top10Pct.toFixed(2))) },
                        ]}
                    />
                )}
            </Box>
        </Card>
    )
}

export function HashiOperatorsTable({
    data,
    loading,
}: {
    data?: HashiCommitteeResponse
    loading: boolean
}) {
    const [showAll, setShowAll] = useState(false)
    const members = data?.members ?? []
    const rows = showAll ? members : members.slice(0, TOP_N)
    const maxPct = members[0]?.weightPct || 1

    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                title="Committee operators"
                subheader={
                    data
                        ? `${members.filter(m => m.inCommittee).length} of ${
                              members.length
                          } registered operators are in the epoch ${data.epoch.toLocaleString()} committee`
                        : undefined
                }
                action={
                    members.length > TOP_N && (
                        <Chip
                            size="small"
                            clickable
                            onClick={() => setShowAll(v => !v)}
                            label={showAll ? `Show top ${TOP_N}` : `Show all ${members.length}`}
                        />
                    )
                }
            />
            <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Operator</TableCell>
                            <TableCell>Weight</TableCell>
                            <TableCell align="right">Share</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading &&
                            Array.from({ length: 6 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}>
                                        <Skeleton />
                                    </TableCell>
                                </TableRow>
                            ))}
                        {rows.map((m, i) => (
                            <TableRow key={m.validator} hover>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Avatar
                                            src={m.imageUrl ?? undefined}
                                            sx={{ width: 24, height: 24, fontSize: 12 }}
                                        >
                                            {(m.name ?? '?').slice(0, 1)}
                                        </Avatar>
                                        <Typography variant="body2" noWrap>
                                            {m.name ?? shortAddress(m.validator)}
                                        </Typography>
                                        {!m.inCommittee && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label="not active"
                                            />
                                        )}
                                    </Stack>
                                </TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(m.weightPct / maxPct) * 100}
                                        sx={{ height: 6, borderRadius: 3 }}
                                    />
                                </TableCell>
                                <TableCell align="right">{m.weightPct.toFixed(2)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    )
}
