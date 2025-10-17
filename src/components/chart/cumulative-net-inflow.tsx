'use client'
import { Card, CardHeader, Grid, Button } from '@mui/material'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { Chart, useChart } from 'src/components/chart'
import {
    getCumulativeInflowEndpointForPeriod,
    getDefaultTimeIntervalForPeriod,
    getTimeIntervalForPeriod,
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
import { CumulativeInflowType, getTokensList } from 'src/utils/types'
import useSWR from 'swr'
import { ChartActionButtons } from './chart-action-buttons'
import { downloadCsv } from 'src/utils/csv'

export default function CumulativeNetInflow() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()

    const [chartData, setChartData] = useState<ChartDataItem[]>([])
    const [selectedSeries, setSelectedSeries] = useState<TimeInterval>(
        getDefaultTimeIntervalForPeriod(timePeriod),
    )
    const [showMergedValues, setShowMergedValues] = useState(false)

    useEffect(() => {
        const defaultValue = getDefaultTimeIntervalForPeriod(timePeriod)
        const valuesValues = getTimeIntervalForPeriod(timePeriod)

        if (selectedSeries !== defaultValue) {
            if (!valuesValues?.find(it => it === selectedSeries)) {
                setSelectedSeries(defaultValue)
            }
        }
    }, [timePeriod])

    const { data, isLoading } = useSWR<CumulativeInflowType[]>(
        getCumulativeInflowEndpointForPeriod(timePeriod, network),
        fetcher,
        {
            revalidateOnFocus: false,
        },
    )

    const handleExport = () => {
        if (!data?.length) return
        const startDate = calculateStartDate(timePeriod)
        const rows = data
            .filter((item: any) => dayjs(item.transfer_date).isAfter(startDate))
            .map((it: any) => ({
                transfer_date: it.transfer_date,
                token: it?.token_info?.name,
                total_volume_usd: it?.total_volume_usd,
                total_volume: it?.total_volume,
            }))
        downloadCsv('cumulative-net-inflow.csv', rows)
    }

    useEffect(() => {
        if (data && data?.length > 0) {
            const startDate = calculateStartDate(timePeriod)
            const dateFilter = data.filter((item: any) =>
                dayjs(item.transfer_date).isAfter(startDate),
            )

            let filteredData = selectedTokens.includes('All')
                ? dateFilter
                : dateFilter.filter(
                      (item: CumulativeInflowType) =>
                          selectedTokens.includes('All') ||
                          selectedTokens.includes(item?.token_info?.name),
                  )

            const formattedData = formatChartData(
                filteredData,
                selectedSeries as any,
                getTokensList(network),
                timePeriod,
                true,
            )

            setChartData(formattedData)
        }
    }, [data, timePeriod, selectedTokens, selectedSeries])

    // Chart Options - Get base options from useChart Hook
    const baseChartOptions = useChart({
        chart: {
            stacked: true,
            zoom: {
                enabled: true,
                type: 'x',
            },
        },
        colors: ['#00A76F', '#FF5630'], // Default colors
        stroke: {
            width: 0,
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
            showTotal: !showMergedValues,
            showToken: true,
        }), // Use showToken state
    })

    // Create chart options function that uses the base options
    const chartOptions = (isInflowOutflow: boolean) => ({
        ...baseChartOptions,
        colors: isInflowOutflow ? ['#00A76F', '#FF5630'] : chartData.map(item => item.color),
    })

    const handleChangeSeries = useCallback((newValue: string) => {
        setSelectedSeries(newValue as TimeInterval)
    }, [])

    const totalChartData =
        chartData.length > 0
            ? [
                  {
                      name: 'Net Inflow',
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
                        title="Cumulative Net inflow"
                        subheader=""
                        sx={{
                            alignItems: { xs: 'flex-start', sm: 'center' },
                        }}
                        action={
                            <Grid
                                container
                                alignItems={{ xs: 'flex-end', sm: 'center' }}
                                spacing={1}
                                wrap="nowrap"
                                flexDirection={{ xs: 'column', sm: 'row' }}
                            >
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
                        options={chartOptions(showMergedValues)}
                        height={370}
                        loadingProps={{ sx: { p: 2.5 } }}
                        forceLoading={isLoading}
                        sx={{ py: 2.5, pl: { xs: 0, md: 1 }, pr: 2.5 }}
                    />
                </Card>
            </Grid>
        </Grid>
    )
}
