'use client'
import { Card, CardHeader, Grid } from '@mui/material'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { Chart, ChartSelect, useChart } from 'src/components/chart'
import {
    getDefaultTimeIntervalForPeriod,
    getTimeIntervalForPeriod,
    getVolumeEndpointForPeriod,
    TimeInterval,
} from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { fetcher } from 'src/utils/axios'
import {
    buildTooltip,
    calculateStartDate,
    ChartDataItem,
    formatCategories,
    formatChartData,
    labelFormatted,
} from 'src/utils/format-chart-data'
import { getTokensList } from 'src/utils/types'
import useSWR from 'swr'
import { ChartActionButtons } from './chart-action-buttons'

export default function InflowOutflowCharts() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()

    const [chartData, setChartData] = useState<ChartDataItem[]>([])
    const [inflowSeries, setInflowSeries] = useState<ChartDataItem[]>([])
    const [outflowSeries, setOutflowSeries] = useState<ChartDataItem[]>([])

    const [showMergedValues, setShowMergedValues] = useState(false)
    const [selectedSeries, setSelectedSeries] = useState<TimeInterval>(
        getDefaultTimeIntervalForPeriod(timePeriod),
    )
    const [selectedSeriesInflow, setSelectedSeriesInflow] = useState<TimeInterval>(
        getDefaultTimeIntervalForPeriod(timePeriod),
    )

    const { data } = useSWR<any>(getVolumeEndpointForPeriod(timePeriod, network), fetcher, {
        revalidateOnFocus: false,
    })

    useEffect(() => {
        const defaultValue = getDefaultTimeIntervalForPeriod(timePeriod)
        const valuesValues = getTimeIntervalForPeriod(timePeriod)

        if (selectedSeries !== defaultValue) {
            if (!valuesValues?.find(it => it === selectedSeries)) {
                setSelectedSeries(defaultValue)
            }
        }

        if (selectedSeriesInflow !== defaultValue) {
            if (!valuesValues?.find(it => it === selectedSeriesInflow)) {
                setSelectedSeriesInflow(defaultValue)
            }
        }
    }, [timePeriod])

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
                selectedSeries,
                getTokensList(network),
                timePeriod,
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
                timePeriod,
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
                timePeriod,
            )

            setInflowSeries(inflowData)
            setOutflowSeries(outflowData)
            const formattedData = formatChartData(
                filteredData,
                selectedSeriesInflow,
                getTokensList(network),
                timePeriod,
            )
            setChartData(formattedData)
        }
    }, [data, timePeriod, selectedTokens, selectedSeriesInflow])

    // Chart Options
    const chartOptions = (
        isInflowOutflow: boolean,
        tooltipList: { period: string; value: number }[],
    ) =>
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
            plotOptions: {
                bar: {
                    borderRadius: 0,
                },
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

                        const skipInterval =
                            totalPoints && totalPoints > 100 ? 8 : totalPoints > 20 ? 2 : 1

                        if (selectedSeries === 'Daily') {
                            const skip = totalPoints && totalPoints > 100 ? 4 : 2
                            return opts?.i % skip === 0 ? value : ''
                        } else {
                            return opts?.i % skipInterval === 0 ? value : ''
                        }
                    },
                    style: {
                        fontSize: '12px',
                    },
                },
            },
            yaxis: {
                labels: {
                    formatter: value => labelFormatted(value),
                },
            },
            tooltip: buildTooltip({
                chartData,
                showTotal: !isInflowOutflow,
                showToken: !isInflowOutflow,
            }),
        })

    const handleChangeSeries = useCallback((newValue: string) => {
        setSelectedSeries(newValue as TimeInterval)
    }, [])

    const handleChangeSeriesInflow = useCallback((newValue: string) => {
        setSelectedSeriesInflow(newValue as TimeInterval)
    }, [])

    const totalChartData =
        chartData.length > 0
            ? [
                  {
                      name: 'Total Volume',
                      data: chartData[0].data.map((_, index) => ({
                          value: chartData.reduce(
                              (sum, series) => sum + series.data[index].value,
                              0,
                          ),
                      })),
                  },
              ]
            : []

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Inflow/Outflow Volume"
                        subheader=""
                        action={
                            <ChartSelect
                                options={getTimeIntervalForPeriod(timePeriod)}
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
                                          name: 'Net Inflow',
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
                        options={chartOptions(true, inflowSeries?.[0]?.data)}
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
                            <ChartActionButtons
                                showTotal={showMergedValues}
                                setShowTotal={setShowMergedValues}
                                selectedSeries={selectedSeries}
                                handleChangeSeries={handleChangeSeries}
                                timePeriod={timePeriod}
                            />
                        }
                    />

                    <Chart
                        type="bar"
                        series={
                            showMergedValues
                                ? totalChartData.map(item => ({
                                      name: item.name,
                                      data: item.data.map(point => point.value),
                                  }))
                                : chartData.map(item => ({
                                      name: item.name,
                                      data: item.data.map(point => point.value),
                                  }))
                        }
                        options={chartOptions(showMergedValues, chartData?.[0]?.data)}
                        height={370}
                        loadingProps={{ sx: { p: 2.5 } }}
                        sx={{ py: 2.5, pl: { xs: 0, md: 1 }, pr: 2.5 }}
                    />
                </Card>
            </Grid>
        </Grid>
    )
}
