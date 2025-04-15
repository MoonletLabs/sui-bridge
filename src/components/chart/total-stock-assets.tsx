'use client'
import { useChart, ChartSelect, Chart } from 'src/components/chart'
import { endpoints, fetcher } from 'src/utils/axios'
import useSWR from 'swr'
import { useCallback, useEffect, useState } from 'react'
import { Grid, Card, CardHeader } from '@mui/material'
import {
    ChartDataItem,
    buildTooltip,
    calculateStartDate,
    formatCategories,
    formatChartData,
    labelFormatted,
} from 'src/utils/format-chart-data'
import { getNetwork } from 'src/hooks/get-network-storage'
import dayjs from 'dayjs'
import { useGlobalContext } from 'src/provider/global-provider'
import { getTokensList } from 'src/utils/types'
import {
    getDefaultTimeIntervalForPeriod,
    getTimeIntervalForPeriod,
    getVolumeEndpointForPeriod,
    TimeInterval,
} from 'src/config/helper'

export default function StockOfAssetsChart() {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()

    const [chartData, setChartData] = useState<ChartDataItem[]>([])
    const [selectedSeries, setSelectedSeries] = useState<TimeInterval>(
        getDefaultTimeIntervalForPeriod(timePeriod),
    )

    useEffect(() => {
        const defaultValue = getDefaultTimeIntervalForPeriod(timePeriod)
        const valuesValues = getTimeIntervalForPeriod(timePeriod)

        if (selectedSeries !== defaultValue) {
            if (!valuesValues?.find(it => it === selectedSeries)) {
                setSelectedSeries(defaultValue)
            }
        }
    }, [timePeriod])

    const { data } = useSWR<any>(getVolumeEndpointForPeriod(timePeriod, network), fetcher, {
        revalidateOnFocus: false,
    })

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
                filteredData.map((item: any) => {
                    if (item.direction === 'outflow') {
                        return {
                            ...item,
                            total_volume: -item.total_volume,
                            total_volume_usd: -item.total_volume_usd,
                        }
                    } else {
                        return { ...item }
                    }
                }),
                selectedSeries as any,
                getTokensList(network),
                timePeriod,
            )

            setChartData(formattedData)
        }
    }, [data, timePeriod, selectedTokens, selectedSeries])

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
                        const skipInterval = totalPoints && totalPoints > 100 ? 8 : 1 // Show every 8th label if over 100 points
                        return opts?.i % skipInterval === 0 ? value : '' // Only show label every `skipInterval` points
                    },
                },
            },
            yaxis: {
                labels: {
                    formatter: labelFormatted,
                },
            },
            tooltip: buildTooltip({ chartData }),
        })

    const handleChangeSeries = useCallback((newValue: string) => {
        setSelectedSeries(newValue as TimeInterval)
    }, [])

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Net inflow per asset"
                        subheader=""
                        action={
                            <ChartSelect
                                options={getTimeIntervalForPeriod(timePeriod)}
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
