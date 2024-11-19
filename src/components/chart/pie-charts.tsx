'use client'
import { useEffect, useState } from 'react'
import { Grid, Card, CardHeader, Box, Skeleton } from '@mui/material'
import { useChart, ChartSelect, Chart } from 'src/components/chart'
import { endpoints, fetcher } from 'src/utils/axios'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { calculateStartDate } from 'src/utils/format-chart-data'
import { getNetworkConfig } from 'src/config/helper'

export default function TokenVolumePieChart() {
    const network = getNetwork()
    const networkConfig = getNetworkConfig({ network })
    const { timePeriod, selectedTokens } = useGlobalContext()

    const [inflowData, setInflowData] = useState<{
        labels: string[]
        series: number[]
        colors: string[]
    }>({ labels: [], series: [], colors: [] })
    const [outflowData, setOutflowData] = useState<{
        labels: string[]
        series: number[]
        colors: string[]
    }>({ labels: [], series: [], colors: [] })
    const [pieChartData, setPieChartData] = useState<{
        labels: string[]
        series: number[]
        colors: string[]
    }>({ labels: [], series: [], colors: [] })

    const volumeEndpoint = `${endpoints.volume.daily}?network=${network}`
    const { data, isLoading } = useSWR<any>(volumeEndpoint, fetcher, { revalidateOnFocus: false })

    useEffect(() => {
        if (data?.length > 0) {
            const startDate = calculateStartDate(timePeriod)
            const dateFilteredData = data.filter((item: any) =>
                dayjs(item.transfer_date).isAfter(startDate),
            )

            const filteredData = selectedTokens.includes('All')
                ? dateFilteredData
                : dateFilteredData.filter((item: any) =>
                      selectedTokens.includes(item.token_info.name),
                  )

            const inflowVolumes: { [tokenName: string]: { volume: number; color: string } } = {}
            const outflowVolumes: { [tokenName: string]: { volume: number; color: string } } = {}
            const totalVolumes: { [tokenName: string]: { volume: number; color: string } } = {}

            filteredData.forEach((item: any) => {
                const tokenName = item.token_info.name
                const volume = item.total_volume_usd
                const color =
                    Object.values(networkConfig?.config?.coins).find(
                        token => token.name === tokenName,
                    )?.color || '#000000' // Fallback color if not found

                if (item.direction === 'inflow') {
                    inflowVolumes[tokenName] = {
                        volume: (inflowVolumes[tokenName]?.volume || 0) + volume,
                        color: color,
                    }
                } else if (item.direction === 'outflow') {
                    outflowVolumes[tokenName] = {
                        volume: (outflowVolumes[tokenName]?.volume || 0) + volume,
                        color: color,
                    }
                }
                totalVolumes[tokenName] = {
                    volume: (totalVolumes[tokenName]?.volume || 0) + volume,
                    color: color,
                }
            })

            const nonZeroInflowTokens = Object.keys(inflowVolumes).filter(
                token => inflowVolumes[token].volume > 0,
            )
            const nonZeroOutflowTokens = Object.keys(outflowVolumes).filter(
                token => outflowVolumes[token].volume > 0,
            )
            const nonZeroTotalTokens = Object.keys(totalVolumes).filter(
                token => totalVolumes[token].volume > 0,
            )
            // Set data for each chart
            setInflowData({
                labels: nonZeroInflowTokens,
                series: nonZeroInflowTokens.map(token => inflowVolumes[token]?.volume || 0),
                colors: nonZeroInflowTokens.map(token => inflowVolumes[token]?.color || '#000000'), // Fallback to black if no color
            })

            // Set outflow chart data
            setOutflowData({
                labels: nonZeroOutflowTokens,
                series: nonZeroOutflowTokens.map(token => outflowVolumes[token]?.volume || 0),
                colors: nonZeroOutflowTokens.map(
                    token => outflowVolumes[token]?.color || '#000000',
                ), // Fallback to black if no color
            })

            setPieChartData({
                labels: nonZeroTotalTokens,
                series: nonZeroTotalTokens.map(token => totalVolumes[token]?.volume || 0),
                colors: nonZeroTotalTokens.map(token => totalVolumes[token]?.color || '#000000'), // Fallback to black if no color
            })
        }
    }, [data, timePeriod, selectedTokens])

    const pieChartOptions = (data: { labels: string[]; colors: string[] }) =>
        useChart({
            chart: { sparkline: { enabled: true } },
            labels: data.labels,
            tooltip: {
                y: {
                    formatter: (value: number) =>
                        `$${value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                },
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const label = w.globals.labels[seriesIndex]
                    const value = series[seriesIndex]
                    return `
                        <div style="
                            padding: 8px; 
                            background-color: #e0e0e0; 
                            border-radius: 4px; 
                            color: #000; 
                            font-size: 12px; 
                            text-align: center;">
                            <strong>${label}</strong>: $${value?.toLocaleString()}
                        </div>`
                },
            },
            colors: data.colors,
            legend: {
                show: true,
                position: 'right',
            },
            plotOptions: { pie: { donut: { labels: { show: false } } } },
            stroke: { width: 0 },
            dataLabels: { enabled: true, dropShadow: { enabled: false } },
        })

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader title="Token Inflow Distribution" subheader="" />

                    {isLoading ? (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            height={370}
                        >
                            <Skeleton
                                variant="circular"
                                width={322} // Equal width and height to ensure it's a circle
                                height={322}
                            />
                        </Box>
                    ) : (
                        <Chart
                            type="pie"
                            series={inflowData.series}
                            options={pieChartOptions(inflowData)}
                            height={370}
                            loadingProps={{ sx: { p: 2.5 } }}
                            sx={{ py: 2.5, pl: 1, pr: 2.5, height: { xs: 250, md: 370 } }}
                        />
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader title="Token Outflow Distribution" subheader="" />
                    {isLoading ? (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            height={370}
                        >
                            <Skeleton
                                variant="circular"
                                width={322} // Equal width and height to ensure it's a circle
                                height={322}
                            />
                        </Box>
                    ) : (
                        <Chart
                            type="pie"
                            series={outflowData.series}
                            options={pieChartOptions(outflowData)}
                            height={370}
                            loadingProps={{ sx: { p: 2.5 } }}
                            sx={{ py: 2.5, pl: 1, pr: 2.5, height: { xs: 250, md: 370 } }}
                        />
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader title="Token Volume Distribution" subheader="" />

                    {isLoading ? (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            height={370}
                        >
                            <Skeleton
                                variant="circular"
                                width={322} // Equal width and height to ensure it's a circle
                                height={322}
                            />
                        </Box>
                    ) : (
                        <Chart
                            type="pie"
                            series={pieChartData.series}
                            options={pieChartOptions(pieChartData)}
                            height={370}
                            loadingProps={{ sx: { p: 2.5 } }}
                            sx={{ py: 2.5, pl: 1, pr: 2.5, height: { xs: 250, md: 370 } }}
                        />
                    )}
                </Card>
            </Grid>
        </Grid>
    )
}
