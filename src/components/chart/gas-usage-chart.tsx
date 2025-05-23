'use client'
import { Box, Card, CardHeader } from '@mui/material'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import useSWR from 'swr'
import type { GasUsageDailyType } from 'src/utils/types'
import { fNumber } from 'src/utils/format-number'

export default function GasUsageChart() {
    const network = getNetwork()

    const { data } = useSWR<GasUsageDailyType[]>(
        `${endpoints.fees}?network=${network}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const chartOptions = useChart({
        chart: { zoom: { enabled: false } },
        colors: ['#7A0CFA'],
        xaxis: { type: 'datetime' },
        yaxis: {
            labels: {
                formatter: (value: number) => fNumber(value, { maximumFractionDigits: 2 }),
            },
        },
        tooltip: {
            y: {
                formatter: (val: number) => fNumber(val),
            },
        },
    })

    return (
        <Card>
            <CardHeader title="Daily Gas Usage" />
            <Box sx={{ p: 3 }}>
                <Chart
                    type="area"
                    series={[
                        {
                            name: 'Gas Usage',
                            data:
                                data?.map(d => ({
                                    x: new Date(d.transfer_date).getTime(),
                                    y: Number(d.total_gas_usage),
                                })) || [],
                        },
                    ]}
                    options={chartOptions}
                    height={340}
                    loadingProps={{ sx: { p: 2.5 } }}
                />
            </Box>
        </Card>
    )
}
