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
import { getTokensList } from 'src/utils/types'

export default function InflowOutflowCharts() {
    const network = getNetwork()
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
                getTokensList(network),
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
                getTokensList(network),
            )
            const outflowData = formatChartData(
                filteredData
                    .filter((item: any) => item.direction === 'outflow')
                    .map((item: any) => ({
                        ...item,
                        total_volume: -item.total_volume,
                        total_volume_usd: -item.total_volume_usd,
                    })),
                selectedSeriesInflow as any,
                getTokensList(network),
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
            colors: isInflowOutflow
                ? ['#00A76F', '#FF5630', '#007BFF']
                : chartData.map(item => item.color),
            stroke: {
                width: 2,
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
                shared: true,
                followCursor: true,
                intersect: false,
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const xLabel = w.globals.labels[dataPointIndex] || 'Unknown'
                    const activeSeriesIndices = w.globals.series
                        .map((_: any, i: any) => i)
                        .filter((i: any) => !w.globals.collapsedSeriesIndices.includes(i))

                    const tooltips = activeSeriesIndices
                        .map((i: string | number) => {
                            const seriesName = w.globals.seriesNames[i] || 'Unknown'
                            let value = series[i][dataPointIndex]
                            const color = w.globals.colors[i]

                            const formattedValue =
                                value < 0
                                    ? `-$${Math.abs(value).toLocaleString()}`
                                    : `$${value.toLocaleString()}`

                            return value !== undefined && value !== 0
                                ? `
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    padding: 6px;
                                    background-color: rgba(255, 255, 255, 0.8); /* Transparent background */
                                    color: #333;
                                    border-radius: 4px;
                                    text-align: left;
                                    font-size: 12px;
                                    border-left: 4px solid ${color};
                                    margin-bottom: 4px;">
                                    <span style="margin-left: 8px;"><strong>${seriesName}:</strong>${formattedValue}</span>
                                </div>
                            `
                                : ''
                        })
                        .join('')

                    return tooltips.trim()
                        ? `
                            <div style="
                                padding: 8px;
                                background-color: #e0e0e0;
                                border-radius: 6px;
                                box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
                                min-width: 120px;
                                text-align: left;
                                color: white;">
                                <strong style="color: black">${xLabel}</strong>
                                ${tooltips}
                            </div>
                        `
                        : '' // If no valid tooltips, return empty string (no tooltip displayed)
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
                        title="Inflow/Outflow Volume"
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
                                data: (() => {
                                    const weekSums: { [key: string]: number } = {}

                                    inflowSeries.forEach(seriesItem => {
                                        seriesItem.data.forEach(point => {
                                            weekSums[point.period] =
                                                (weekSums[point.period] || 0) + point.value
                                        })
                                    })

                                    return Object.entries(weekSums)
                                        .sort(([a], [b]) => a.localeCompare(b)) // Ensure weeks are sorted correctly
                                        .map(([, value]) => value)
                                })(),
                            },
                            {
                                name: 'Outflow',
                                data: (() => {
                                    const weekSums: { [key: string]: number } = {}

                                    outflowSeries.forEach(seriesItem => {
                                        seriesItem.data.forEach(point => {
                                            weekSums[point.period] =
                                                (weekSums[point.period] || 0) + point.value
                                        })
                                    })

                                    return Object.entries(weekSums)
                                        .sort(([a], [b]) => a.localeCompare(b)) // Ensure weeks are sorted correctly
                                        .map(([, value]) => value)
                                })(),
                            },
                            ...(inflowSeries?.[0]?.data?.length > 2
                                ? [
                                      {
                                          name: 'Net Flow',
                                          type: 'line',
                                          data: (() => {
                                              const weekSums: { [key: string]: number } = {}

                                              inflowSeries.forEach(seriesItem => {
                                                  seriesItem.data.forEach(point => {
                                                      weekSums[point.period] =
                                                          (weekSums[point.period] || 0) +
                                                          point.value
                                                  })
                                              })

                                              outflowSeries.forEach(seriesItem => {
                                                  seriesItem.data.forEach(point => {
                                                      weekSums[point.period] =
                                                          (weekSums[point.period] || 0) +
                                                          point.value
                                                  })
                                              })

                                              return Object.entries(weekSums)
                                                  .sort(([a], [b]) => a.localeCompare(b))
                                                  .map(([, value]) => value)
                                          })(),
                                      },
                                  ]
                                : []),
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
                        title="Total Volume (inflow + outflow)"
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
