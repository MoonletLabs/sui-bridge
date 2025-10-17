'use client'
import { useMemo, useState } from 'react'
import { Box, ButtonGroup, Button, Typography, TableRow, TableCell } from '@mui/material'
import useSWR from 'swr'
import { endpoints, fetcher } from 'src/utils/axios'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { fNumber } from 'src/utils/format-number'
import { getTokensList } from 'src/utils/types'
import { CustomTable } from 'src/components/table/table'
import { downloadCsv } from 'src/utils/csv'
import dayjs from 'dayjs'

type SortMode = 'usd' | 'count'

type TopTokenRow = {
    token: string
    icon?: string
    inflowUsd: number
    outflowUsd: number
    netUsd: number
    sharePct: number
    inflowCount: number
    outflowCount: number
    uniqueAddresses?: number
}

export default function TopTokens() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()
    const [sortMode, setSortMode] = useState<SortMode>('usd')

    const { data, isLoading } = useSWR<any>(
        `${endpoints.cards}?network=${network}&timePeriod=${timePeriod}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const rows: TopTokenRow[] = useMemo(() => {
        if (!data) return []

        const byToken: Record<
            string,
            {
                token: string
                icon?: string
                color?: string
                totalUsd: number
                txCount: number
                inflowUsd: number
                outflowUsd: number
                inflowCount: number
                outflowCount: number
                uniqueAddresses?: number
            }
        > = {}

        const includeToken = (name: string) =>
            selectedTokens.includes('All') || selectedTokens.includes(name)

        const tokensMeta = getTokensList(network)

        const add = (list: any[], direction: 'inflow' | 'outflow') => {
            list?.forEach(item => {
                const token = item?.token_info?.name
                if (!token || !includeToken(token)) return
                const usd = Number(item?.total_volume_usd || 0)
                const cnt = Number(item?.total_count || 0)
                if (!byToken[token]) {
                    const meta = tokensMeta.find(t => t.ticker === token)
                    byToken[token] = {
                        token,
                        icon: meta?.icon,
                        color: meta?.color,
                        totalUsd: 0,
                        txCount: 0,
                        inflowUsd: 0,
                        outflowUsd: 0,
                        inflowCount: 0,
                        outflowCount: 0,
                    }
                }
                byToken[token].totalUsd += usd
                byToken[token].txCount += cnt
                if (direction === 'inflow') {
                    byToken[token].inflowUsd += usd
                    byToken[token].inflowCount += cnt
                } else {
                    byToken[token].outflowUsd += usd
                    byToken[token].outflowCount += cnt
                }
            })
        }

        add(data?.inflows || [], 'inflow')
        add(data?.outflows || [], 'outflow')

        // unique addresses per token
        ;(data?.addresses || []).forEach((item: any) => {
            const token = item?.token_info?.name
            if (!token || !byToken[token]) return
            byToken[token].uniqueAddresses = Number(item?.total_unique_addresses || 0)
        })

        const totalAll = Object.values(byToken).reduce((s, t) => s + (t.totalUsd || 0), 0)

        const list: TopTokenRow[] = Object.values(byToken)
            .sort((a, b) => (sortMode === 'usd' ? b.totalUsd - a.totalUsd : b.txCount - a.txCount))
            .slice(0, 5)
            .map(t => ({
                token: t.token,
                icon: t.icon,
                inflowUsd: t.inflowUsd,
                outflowUsd: t.outflowUsd,
                netUsd: t.inflowUsd - t.outflowUsd,
                sharePct: totalAll ? (t.totalUsd / totalAll) * 100 : 0,
                inflowCount: t.inflowCount,
                outflowCount: t.outflowCount,
                uniqueAddresses: t.uniqueAddresses,
            }))

        return list
    }, [data, selectedTokens, sortMode, network])

    const handleExport = () => {
        if (!rows?.length) return
        const dateSuffix = dayjs().format('DD-MM-YYYY')
        downloadCsv(
            `top-tokens-${dateSuffix}.csv`,
            rows.map(r => ({
                token: r.token,
                inflow_usd: r.inflowUsd,
                outflow_usd: r.outflowUsd,
                net_usd: r.netUsd,
                share_pct: r.sharePct,
                inflow_count: r.inflowCount,
                outflow_count: r.outflowCount,
                unique_addresses: r.uniqueAddresses || 0,
            })),
        )
    }

    return (
        <Box>
            <CustomTable<TopTokenRow>
                title="Top Tokens"
                titleContent={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                            Top Tokens
                        </Typography>
                        <ButtonGroup
                            variant="outlined"
                            sx={{
                                ml: 'auto',
                                '& .MuiButton-root': {
                                    fontSize: '14px',
                                    padding: '5px 12px',
                                    lineHeight: 1.2,
                                    minHeight: '36px',
                                },
                            }}
                        >
                            <Button
                                onClick={() => setSortMode('usd')}
                                variant={sortMode === 'usd' ? 'contained' : 'outlined'}
                            >
                                USD volume
                            </Button>
                            <Button
                                onClick={() => setSortMode('count')}
                                variant={sortMode === 'count' ? 'contained' : 'outlined'}
                            >
                                Tx count
                            </Button>
                        </ButtonGroup>
                    </Box>
                }
                subheader={`Top by ${sortMode === 'usd' ? 'USD volume' : 'transactions'}`}
                headLabel={[
                    { id: 'token', label: 'Token' },
                    { id: 'inflowUsd', label: 'Inflow (USD)', align: 'right' },
                    { id: 'outflowUsd', label: 'Outflow (USD)', align: 'right' },
                    { id: 'netUsd', label: 'Net (USD)', align: 'right' },
                    { id: 'sharePct', label: 'Share %', align: 'right' },
                    { id: 'tx', label: 'Tx (in/out)', align: 'right' },
                    { id: 'uniqueAddresses', label: 'Unique addrs', align: 'right' },
                ]}
                tableData={rows}
                RowComponent={({ row }) => (
                    <TableRow hover>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {row.icon ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={row.icon} alt={row.token} width={18} height={18} />
                                ) : null}
                                {row.token}
                            </Box>
                        </TableCell>
                        <TableCell align="right">${fNumber(row.inflowUsd)}</TableCell>
                        <TableCell align="right">${fNumber(row.outflowUsd)}</TableCell>
                        <TableCell align="right">${fNumber(row.netUsd)}</TableCell>
                        <TableCell align="right">{fNumber(row.sharePct)}%</TableCell>
                        <TableCell align="right">
                            {fNumber(row.inflowCount)}/{fNumber(row.outflowCount)}
                        </TableCell>
                        <TableCell align="right">{fNumber(row.uniqueAddresses || 0)}</TableCell>
                    </TableRow>
                )}
                loading={isLoading}
                hidePagination
                rowHeight={60}
                minHeight={360}
                handleExport={handleExport}
            />
        </Box>
    )
}
