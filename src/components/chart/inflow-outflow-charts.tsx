'use client'
import { useChart, ChartSelect, Chart } from 'src/components/chart'
import { endpoints, fetcher } from 'src/utils/axios'
import useSWR from 'swr'
import { useCallback, useEffect, useState } from 'react'
import { Grid, Card, CardHeader } from '@mui/material'
import {
    ChartDataItem,
    calculateStartDate,
    formatCategories,
    formatChartData,
} from 'src/utils/format-chart-data'
import { getNetwork } from 'src/hooks/get-network-storage'
import dayjs from 'dayjs'
import { useGlobalContext } from 'src/provider/global-provider'
import { getNetworkConfig } from 'src/config/helper'

export default function InflowOutflowCharts() {
    const network = getNetwork()
    const networkConfig = getNetworkConfig({ network })
    const { timePeriod, selectedTokens } = useGlobalContext()

    const [chartData, setChartData] = useState<ChartDataItem[]>([])
    const [inflowSeries, setInflowSeries] = useState<ChartDataItem[]>([])
    const [outflowSeries, setOutflowSeries] = useState<ChartDataItem[]>([])
    const [selectedSeries, setSelectedSeries] = useState('Weekly')
    const [selectedSeriesInflow, setSelectedSeriesInflow] = useState('Weekly')

    const volumeEndpoint = `${endpoints.volume.daily}?network=${network}`
    const { data } = useSWR<any>(volumeEndpoint, fetcher, { revalidateOnFocus: false })

    useEffect(() => {
        if (data?.length > 0) {
            const startDate = calculateStartDate(timePeriod)
            const dateFilter = data.filter((item: any) =>
                dayjs(item.transfer_date).isAfter(startDate),
            )

            const filteredData = selectedTokens.includes('All')
                ? dateFilter
                : dateFilter.filter(
                      (item: any) =>
                          selectedTokens.includes('All') ||
                          selectedTokens.includes(item?.token_info?.name),
                  )

            const formattedData = formatChartData(
                filteredData,
                selectedSeries as any,
                Object.values(networkConfig?.config?.coins),
            )
            setChartData(formattedData)
        }
    }, [data, timePeriod, selectedTokens, selectedSeries])

    useEffect(() => {
        if (data?.length > 0) {
            const startDate = calculateStartDate(timePeriod)
            const dateFilter = data.filter((item: any) =>
                dayjs(item.transfer_date).isAfter(startDate),
            )

            const filteredData = selectedTokens.includes('All')
                ? dateFilter
                : dateFilter.filter(
                      (item: any) =>
                          selectedTokens.includes('All') ||
                          selectedTokens.includes(item?.token_info?.name),
                  )
            const inflowData = formatChartData(
                filteredData.filter((item: any) => item.direction === 'inflow'),
                selectedSeriesInflow as any,
                Object.values(networkConfig?.config?.coins),
            )
            const outflowData = formatChartData(
                filteredData.filter((item: any) => item.direction === 'outflow'),
                selectedSeriesInflow as any,
                Object.values(networkConfig?.config?.coins),
            )

            setInflowSeries(inflowData)
            setOutflowSeries(outflowData)
        }
    }, [data, timePeriod, selectedTokens, selectedSeriesInflow])

    // Chart Options
    const chartOptions = (isInflowOutflow: boolean) =>
        useChart({
            chart: {
                stacked: true,
                zoom: {
                    enabled: true,
                    type: 'x',
                },
            },
            colors: isInflowOutflow ? ['#00A76F', '#FF5630'] : chartData.map(item => item.color),
            stroke: {
                width: 0,
            },
            legend: {
                show: true,
            },
            xaxis: {
                categories: formatCategories(
                    isInflowOutflow ? inflowSeries : chartData,
                    isInflowOutflow ? selectedSeriesInflow : selectedSeries,
                ),
                labels: {
                    formatter: (value, index, opts) => {
                        if (index === undefined) return value // Return full value if index is undefined

                        const totalPoints = isInflowOutflow
                            ? inflowSeries[0]?.data.length
                            : chartData[0]?.data.length
                        const skipInterval = totalPoints && totalPoints > 100 ? 8 : 1 // Show every 8th label if over 100 points
                        return opts?.i % skipInterval === 0 ? value : '' // Only show label every `skipInterval` points
                    },
                },
            },
            yaxis: {
                labels: {
                    formatter: (value: number) => {
                        const isMobile = window.innerWidth <= 600 // Adjust breakpoint as needed
                        if (isMobile) {
                            // Abbreviate value for mobile (e.g., 150000 becomes 150k)
                            if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`
                            if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`
                            return `$${value}`
                        }
                        // Full format for larger screens
                        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    },
                },
            },
            tooltip: {
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const seriesName = w.globals.seriesNames[seriesIndex]
                    const value = series[seriesIndex][dataPointIndex]
                    const color = w.globals.colors[seriesIndex]

                    const formattedValue = value.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    })
                    return value !== undefined
                        ? `<div style="
                        display: flex;
                        align-items: center;
                        padding: 8px;
                        background-color: #e0e0e0;
                        color: #333;
                        border-radius: 4px;
                        text-align: left;">
                        <span style="
                            display: inline-block;
                            width: 8px;
                            height: 8px;
                            background-color: ${color};
                            border-radius: 50%;
                            margin-right: 8px;">
                        </span>
                        <strong>${seriesName}</strong>: $${formattedValue}
                      </div>`
                        : ''
                },
            },
        })

    const handleChangeSeries = useCallback((newValue: string) => {
        setSelectedSeries(newValue)
    }, [])

    const handleChangeSeriesInflow = useCallback((newValue: string) => {
        setSelectedSeriesInflow(newValue)
    }, [])

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Sui Inflow/Outflow Volume"
                        subheader=""
                        action={
                            <ChartSelect
                                options={['Daily', 'Weekly', 'Monthly']}
                                value={selectedSeriesInflow}
                                onChange={handleChangeSeriesInflow}
                            />
                        }
                    />

                    <Chart
                        type="bar"
                        series={[
                            {
                                name: 'Inflow',
                                data: inflowSeries[0]?.data.map(point => point.value) || [],
                            },
                            {
                                name: 'Outflow',
                                data: outflowSeries[0]?.data.map(point => point.value) || [],
                            },
                        ]}
                        options={chartOptions(true)}
                        height={370}
                        loadingProps={{ sx: { p: 2.5 } }}
                        sx={{ py: 2.5, pl: { xs: 0, md: 1 }, pr: 2.5 }}
                    />
                </Card>
            </Grid>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Sui Total Volume"
                        subheader=""
                        action={
                            <ChartSelect
                                options={['Daily', 'Weekly', 'Monthly']}
                                value={selectedSeries}
                                onChange={handleChangeSeries}
                            />
                        }
                    />

                    <Chart
                        type="bar"
                        series={chartData.map(item => ({
                            name: item.name,
                            data: item.data.map(point => point.value),
                        }))}
                        options={chartOptions(false)}
                        height={370}
                        loadingProps={{ sx: { p: 2.5 } }}
                        sx={{ py: 2.5, pl: { xs: 0, md: 1 }, pr: 2.5 }}
                    />
                </Card>
            </Grid>
        </Grid>
    )
}
