'use client'

import { Box, Button, TableCell, TableRow, Typography } from '@mui/material'
import dynamic from 'next/dynamic'
import { CustomTable } from 'src/components/table/table'
import { TokenSnapshot, useLiquiditySnapshot } from 'src/hooks/use-liquidity-snapshot'
import { downloadCsv } from 'src/utils/csv'
import { fNumber } from 'src/utils/format-number'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

function DeltaCell({ usd, pct }: { usd: number; pct: number }) {
    const up = usd >= 0
    const color = up ? 'success.main' : 'error.main'
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
                {up ? '+' : ''}${fNumber(usd)}
            </Typography>
            <Typography variant="caption" sx={{ color }}>
                {up ? '+' : ''}
                {Number((pct || 0).toFixed(2))}%
            </Typography>
        </Box>
    )
}

function Sparkline({ values, color }: { values: number[]; color?: string }) {
    if (!values?.length) return null
    const strokeColor = color || '#3780FF'
    return (
        <Box sx={{ width: 120, height: 36 }}>
            <ReactApexChart
                type="line"
                height={36}
                width={120}
                series={[{ data: values }]}
                options={{
                    chart: {
                        sparkline: { enabled: true },
                        animations: { enabled: false },
                        toolbar: { show: false },
                    },
                    stroke: { width: 2, curve: 'smooth' },
                    colors: [strokeColor],
                    tooltip: { enabled: false },
                }}
            />
        </Box>
    )
}

export default function CurrentReservesTable() {
    const { snapshot, isLoading } = useLiquiditySnapshot()
    const rows = snapshot?.rows ?? []

    const handleExport = () => {
        if (!rows.length) return
        downloadCsv(
            'bridge-current-reserves',
            rows.map((r: TokenSnapshot) => ({
                token: r.token,
                native_amount: r.current.amount,
                usd_value: r.current.usd,
                share_pct: r.sharePct,
                delta_24h_usd: r.delta24h.usd,
                delta_24h_pct: r.delta24h.pct,
                delta_7d_usd: r.delta7d.usd,
                delta_7d_pct: r.delta7d.pct,
            })),
        )
    }

    return (
        <Box>
            <CustomTable<TokenSnapshot>
                title="Current Reserves"
                titleContent={
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            gap: 1,
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography variant="h6" fontWeight="bold">
                            Current Reserves
                        </Typography>
                        <Button
                            variant="outlined"
                            onClick={handleExport}
                            sx={{
                                height: 34,
                                typography: 'subtitle2',
                                px: 1.5,
                                borderRadius: 1,
                            }}
                        >
                            Export CSV
                        </Button>
                    </Box>
                }
                subheader="Latest per-token stock on the bridge, with 24h and 7d change"
                headLabel={[
                    { id: 'token', label: 'Token' },
                    { id: 'native', label: 'Native amount', align: 'right' },
                    { id: 'usd', label: 'USD value', align: 'right' },
                    { id: 'share', label: 'Share %', align: 'right' },
                    { id: 'd24', label: '24h change', align: 'right' },
                    { id: 'd7d', label: '7d change', align: 'right' },
                    { id: 'spark', label: 'Last 30d', align: 'right' },
                ]}
                tableData={rows}
                RowComponent={({ row }) => (
                    <TableRow hover>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {row.icon ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={row.icon} alt={row.token} width={20} height={20} />
                                ) : null}
                                <Typography variant="body2" fontWeight={600}>
                                    {row.token}
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell align="right">
                            {fNumber(row.current.amount)} {row.token}
                        </TableCell>
                        <TableCell align="right">${fNumber(row.current.usd)}</TableCell>
                        <TableCell align="right">{Number(row.sharePct.toFixed(2))}%</TableCell>
                        <TableCell align="right">
                            <DeltaCell usd={row.delta24h.usd} pct={row.delta24h.pct} />
                        </TableCell>
                        <TableCell align="right">
                            <DeltaCell usd={row.delta7d.usd} pct={row.delta7d.pct} />
                        </TableCell>
                        <TableCell align="right">
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <Sparkline values={row.sparkline} color={row.color} />
                            </Box>
                        </TableCell>
                    </TableRow>
                )}
                loading={isLoading}
                hidePagination
                rowHeight={68}
                minHeight={360}
                handleExport={handleExport}
            />
        </Box>
    )
}
