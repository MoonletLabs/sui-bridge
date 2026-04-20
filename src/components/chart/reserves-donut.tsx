'use client'

import { Card, CardHeader } from '@mui/material'
import { Chart, useChart } from 'src/components/chart'
import { useLiquiditySnapshot } from 'src/hooks/use-liquidity-snapshot'

export default function ReservesDonut() {
    const { snapshot, isLoading } = useLiquiditySnapshot()

    const rows = snapshot?.rows ?? []
    const labels = rows.map(r => r.token)
    const series = rows.map(r => Number(r.current.usd.toFixed(2)))
    const colors = rows.map(r => r.color || '#999999')

    const options = useChart({
        labels,
        colors,
        legend: { show: true, position: 'right' },
        stroke: { width: 0 },
        dataLabels: { enabled: true, dropShadow: { enabled: false } },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Locked',
                            formatter: () =>
                                `$${Math.round(snapshot?.totalUsd || 0).toLocaleString()}`,
                        },
                    },
                },
            },
        },
        tooltip: {
            y: {
                formatter: (value: number) =>
                    `$${value?.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    })}`,
            },
        },
    })

    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <CardHeader
                title="Reserves Composition"
                subheader="Current USD share per token"
                sx={{ mb: 3 }}
            />
            <Chart
                type="donut"
                series={series}
                options={options}
                height={370}
                loadingProps={{ sx: { p: 2.5 } }}
                forceLoading={isLoading}
                sx={{ py: 2.5, px: 2.5, flexGrow: 1 }}
            />
        </Card>
    )
}
