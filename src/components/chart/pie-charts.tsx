'use client'
import { useEffect, useState, useMemo } from 'react'
import { Grid, Card, CardHeader, Box, Skeleton, Button } from '@mui/material'
import { useChart, ChartSelect, Chart } from 'src/components/chart'
import { endpoints, fetcher } from 'src/utils/axios'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { calculateStartDate } from 'src/utils/format-chart-data'
import { getTokensList } from 'src/utils/types'
import { downloadCsv } from 'src/utils/csv'

export default function TokenVolumePieChart() {
    const network = getNetwork()
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

    const handleExport = (kind: 'inflow' | 'outflow' | 'total') => {
        if (!data?.length) return
        const startDate = calculateStartDate(timePeriod)
        const dateFilteredData = data.filter((item: any) =>
            dayjs(item.transfer_date).isAfter(startDate),
        )
        const filteredData = selectedTokens.includes('All')
            ? dateFilteredData
            : dateFilteredData.filter((item: any) => selectedTokens.includes(item.token_info.name))
        const rows = filteredData.map((it: any) => ({
            transfer_date: it.transfer_date,
            token: it?.token_info?.name,
            direction: it?.direction,
            total_volume_usd: it?.total_volume_usd,
            total_volume: it?.total_volume,
        }))
        const suffix =
            kind === 'inflow'
                ? 'token-inflow'
                : kind === 'outflow'
                  ? 'token-outflow'
                  : 'token-volume'
        downloadCsv(`${suffix}.csv`, rows)
    }

    // Move useChart calls to the top level and memoize them
    const inflowChartOptions = useChart({
        chart: { sparkline: { enabled: true } },
        labels: inflowData.labels,
        tooltip: {
            y: {
                formatter: (value: number) =>
                    `$${value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
        },
        colors: inflowData.colors,
        legend: {
            show: true,
            position: 'right',
        },
        plotOptions: { pie: { donut: { labels: { show: false } } } },
        stroke: { width: 0 },
        dataLabels: { enabled: true, dropShadow: { enabled: false } },
    })

    const outflowChartOptions = useChart({
        chart: { sparkline: { enabled: true } },
        labels: outflowData.labels,
        tooltip: {
            y: {
                formatter: (value: number) =>
                    `$${value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
        },
        colors: outflowData.colors,
        legend: {
            show: true,
            position: 'right',
        },
        plotOptions: { pie: { donut: { labels: { show: false } } } },
        stroke: { width: 0 },
        dataLabels: { enabled: true, dropShadow: { enabled: false } },
    })

    const totalChartOptions = useChart({
        chart: { sparkline: { enabled: true } },
        labels: pieChartData.labels,
        tooltip: {
            y: {
                formatter: (value: number) =>
                    `$${value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
        },
        colors: pieChartData.colors,
        legend: {
            show: true,
            position: 'right',
        },
        plotOptions: { pie: { donut: { labels: { show: false } } } },
        stroke: { width: 0 },
        dataLabels: { enabled: true, dropShadow: { enabled: false } },
    })

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
                    getTokensList(network).find(token => token.ticker === tokenName)?.color ||
                    '#000000' // Fallback color if not found

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

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader
                        title="Token Inflow Distribution"
                        subheader=""
                        action={
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleExport('inflow')}
                            >
                                Export CSV
                            </Button>
                        }
                    />

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
                            options={inflowChartOptions}
                            height={370}
                            loadingProps={{ sx: { p: 2.5 } }}
                            sx={{ py: 2.5, pl: 1, pr: 2.5, height: { xs: 250, md: 370 } }}
                        />
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader
                        title="Token Outflow Distribution"
                        subheader=""
                        action={
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleExport('outflow')}
                            >
                                Export CSV
                            </Button>
                        }
                    />
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
                            options={outflowChartOptions}
                            height={370}
                            loadingProps={{ sx: { p: 2.5 } }}
                            sx={{ py: 2.5, pl: 1, pr: 2.5, height: { xs: 250, md: 370 } }}
                        />
                    )}
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader
                        title="Token Volume Distribution"
                        subheader=""
                        action={
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleExport('total')}
                            >
                                Export CSV
                            </Button>
                        }
                    />

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
                            options={totalChartOptions}
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
