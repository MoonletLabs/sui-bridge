'use client'
import { Card, CardHeader, Grid, Button } from '@mui/material'
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
import { downloadCsv } from 'src/utils/csv'

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
    const [hiddenDirections, setHiddenDirections] = useState<number[]>([])
    const [hiddenTokenSeries, setHiddenTokenSeries] = useState<number[]>([])

    const { data, isLoading } = useSWR<any>(
        getVolumeEndpointForPeriod(timePeriod, network),
        fetcher,
        {
            revalidateOnFocus: false,
        },
    )

    type Row = {
        transfer_date: string
        token: string
        direction: 'inflow' | 'outflow'
        total_volume_usd: number
        total_volume: number
    }

    const getDateSuffix = () => dayjs().format('DD-MM-YYYY')

    const buildRows = (): Row[] => {
        if (!data?.length) return []
        const startDate = calculateStartDate(timePeriod)
        const dateFilter = data.filter((item: any) => dayjs(item.transfer_date).isAfter(startDate))
        const filtered = selectedTokens.includes('All')
            ? dateFilter
            : dateFilter.filter((item: any) => selectedTokens.includes(item?.token_info?.name))
        return filtered.map((it: any) => ({
            transfer_date: it.transfer_date,
            token: it?.token_info?.name as string,
            direction: it?.direction as 'inflow' | 'outflow',
            total_volume_usd: it?.total_volume_usd as number,
            total_volume: it?.total_volume as number,
        }))
    }

    const handleExportInflowOutflow = () => {
        let rows: Row[] = buildRows()
        // Respect legend (seriesIndex 0 = Inflow, 1 = Outflow)
        if (hiddenDirections.length) {
            rows = rows.filter((r: Row) => {
                if (r.direction === 'inflow' && hiddenDirections.includes(0)) return false
                if (r.direction === 'outflow' && hiddenDirections.includes(1)) return false
                return true
            })
        }
        if (!rows.length) return
        downloadCsv(`inflow-outflow-${getDateSuffix()}.csv`, rows)
    }

    const handleExportTotalVolume = () => {
        let rows: Row[] = buildRows()
        // Respect legend only in per-asset mode
        if (!showMergedValues && hiddenTokenSeries.length) {
            const visible = new Set(
                chartData.filter((_, i) => !hiddenTokenSeries.includes(i)).map(s => s.name),
            )
            rows = rows.filter((r: Row) => visible.has(r.token))
        }
        if (!rows.length) return
        downloadCsv(`total-volume-${getDateSuffix()}.csv`, rows)
    }

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

    // Chart Options - Get base options from useChart Hook
    const baseChartOptions = useChart({
        chart: {
            stacked: true,
            zoom: {
                enabled: true,
                type: 'x',
            },
        },
        colors: chartData.map(item => item.color), // Default colors
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
            categories: formatCategories(chartData, selectedSeries),
            labels: {
                formatter: (value, index, opts) => {
                    if (index === undefined) return value // Return full value if index is undefined

                    const totalPoints = chartData[0]?.data.length

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
            showTotal: true,
            showToken: true,
        }),
    })

    // Create chart options function that uses the base options
    const chartOptions = (
        isInflowOutflow: boolean,
        tooltipList: { period: string; value: number }[],
    ) => {
        if (!baseChartOptions) return {}

        return {
            ...baseChartOptions,
            colors: isInflowOutflow
                ? ['#00A76F', '#FF5630', '#007BFF']
                : chartData.map(item => item.color),
            xaxis: {
                ...baseChartOptions.xaxis,
                categories: formatCategories(
                    isInflowOutflow ? inflowSeries : chartData,
                    isInflowOutflow ? selectedSeriesInflow : selectedSeries,
                ),
            },
            chart: {
                ...baseChartOptions.chart,
                events: {
                    legendClick: (_: any, seriesIndex: number) => {
                        if (isInflowOutflow) {
                            setHiddenDirections(prev =>
                                prev.includes(seriesIndex)
                                    ? prev.filter(i => i !== seriesIndex)
                                    : [...prev, seriesIndex],
                            )
                        } else {
                            setHiddenTokenSeries(prev =>
                                prev.includes(seriesIndex)
                                    ? prev.filter(i => i !== seriesIndex)
                                    : [...prev, seriesIndex],
                            )
                        }
                        // allow default
                    },
                },
            },
            tooltip: buildTooltip({
                chartData,
                showTotal: !isInflowOutflow,
                showToken: !isInflowOutflow,
            }),
        }
    }

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
                            <Grid container alignItems="center" spacing={1} wrap="nowrap">
                                <Grid item>
                                    <ChartSelect
                                        options={getTimeIntervalForPeriod(timePeriod)}
                                        value={selectedSeriesInflow}
                                        onChange={handleChangeSeriesInflow}
                                    />
                                </Grid>
                                <Grid item>
                                    <Button
                                        variant="outlined"
                                        onClick={handleExportInflowOutflow}
                                        sx={{
                                            height: 34,
                                            typography: 'subtitle2',
                                            px: 1.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        Export CSV
                                    </Button>
                                </Grid>
                            </Grid>
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
                        forceLoading={isLoading}
                    />
                </Card>
            </Grid>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Total Volume (inflow + outflow)"
                        subheader=""
                        action={
                            <Grid container alignItems="center" spacing={1} wrap="nowrap">
                                <Grid item>
                                    <ChartActionButtons
                                        showTotal={showMergedValues}
                                        setShowTotal={setShowMergedValues}
                                        selectedSeries={selectedSeries}
                                        handleChangeSeries={handleChangeSeries}
                                        timePeriod={timePeriod}
                                    />
                                </Grid>
                                <Grid item>
                                    <Button
                                        variant="outlined"
                                        onClick={handleExportTotalVolume}
                                        sx={{
                                            height: 34,
                                            typography: 'subtitle2',
                                            px: 1.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        Export CSV
                                    </Button>
                                </Grid>
                            </Grid>
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
                        forceLoading={isLoading}
                    />
                </Card>
            </Grid>
        </Grid>
    )
}
