'use client'
import { Box, Card, CardHeader, Grid, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from 'src/components/chart'
import {
    getDefaultTimeIntervalForPeriod,
    getTimeIntervalForPeriod,
    TimeInterval,
} from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { GasUsageDailyType } from 'src/utils/types'
import useSWR from 'swr'
import { downloadCsv } from 'src/utils/csv'

export default function GasUsageChart() {
    const theme = useTheme()
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
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

    const { data, isLoading } = useSWR<GasUsageDailyType[]>(
        `${endpoints.fees}?network=${network}&period=${timePeriod}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    const hiddenSeriesRef = useRef<number[]>([])

    const handleExport = () => {
        if (!data?.length) return
        const hidden = hiddenSeriesRef.current
        const rows = data.map(d => {
            const row: any = {
                transfer_date: d.transfer_date,
            }
            if (!hidden.includes(0)) row.eth_gas_usage = d.eth_gas_usage
            if (!hidden.includes(1)) row.sui_gas_usage = d.sui_gas_usage
            return row
        })
        const dateSuffix = dayjs().format('DD-MM-YYYY')
        downloadCsv(`average-gas-usage-${dateSuffix}.csv`, rows)
    }

    const chartOptions = useMemo(
        () => ({
            chart: {
                type: 'area' as const,
                stacked: false,
                zoom: { enabled: false },
                toolbar: { show: false },
                fontFamily: 'inherit',
                events: {
                    legendClick: (_: any, seriesIndex: number, config: any) => {
                        const hidden = hiddenSeriesRef.current
                        if (hidden.includes(seriesIndex)) {
                            hiddenSeriesRef.current = hidden.filter(i => i !== seriesIndex)
                        } else {
                            hiddenSeriesRef.current = [...hidden, seriesIndex]
                        }
                        // do not return anything to allow default toggle
                    },
                },
            },
            dataLabels: {
                enabled: false,
            },
            colors: ['#5c6bc0', '#26A17B'],
            stroke: {
                curve: 'smooth' as const,
                width: 3,
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    type: 'vertical',
                    opacityFrom: 0.5,
                    opacityTo: 0,
                    stops: [0, 100],
                    colorStops: [
                        [
                            { offset: 0, color: '#5c6bc0', opacity: 0.5 },
                            { offset: 100, color: '#5c6bc0', opacity: 0 },
                        ],
                        [
                            { offset: 0, color: '#26A17B', opacity: 0.5 },
                            { offset: 100, color: '#26A17B', opacity: 0 },
                        ],
                    ],
                },
            },
            grid: {
                strokeDashArray: 3,
                borderColor: 'rgba(145, 158, 171, 0.2)',
            },
            xaxis: {
                type: 'datetime' as const,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    format: 'dd MMM',
                },
                tooltip: {
                    enabled: false,
                },
            },
            yaxis: [
                {
                    // ETH axis (left)
                    labels: {
                        show: true,
                        formatter: (val: number) => val?.toFixed(5),
                        style: { colors: ['#5c6bc0'] },
                    },
                    title: {
                        text: 'ETH (gwei)',
                        style: { color: '#5c6bc0' },
                    },
                },
                {
                    // SUI axis (right)
                    opposite: true,
                    labels: {
                        show: true,
                        formatter: (val: number) => val?.toFixed(4),
                        style: { colors: ['#26A17B'] },
                    },
                    title: {
                        text: 'SUI (MIST)',
                        style: { color: '#26A17B' },
                    },
                },
            ],
            tooltip: {
                shared: true,
                followCursor: true,
                intersect: false,
                custom: ({
                    series,
                    dataPointIndex,
                    w,
                }: {
                    series: any
                    dataPointIndex: any
                    w: any
                }) => {
                    const timestamp = w.globals.seriesX[0][dataPointIndex]
                    const date = dayjs(timestamp)
                    const formattedDate = date.format('D MMM YYYY')
                    const tooltips = w.globals.series
                        .map((_: any, i: any) => {
                            const value = series[i][dataPointIndex]
                            if (value === null || value === undefined) return ''
                            const seriesName = w.globals.seriesNames[i]
                            const color = w.globals.colors[i]
                            const formattedValue = `${fNumber(value, { maximumFractionDigits: 7 })}`
                            return `
                            <div style="
                                display: flex;
                                align-items: center;
                                padding: 6px;
                                background-color: rgba(255, 255, 255, 0.8);
                                color: #333;
                                border-radius: 4px;
                                text-align: left;
                                font-size: 12px;
                                border-left: 4px solid ${color};
                                margin-bottom: 4px;">
                                <span style="margin-left: 8px;">
                                    <strong>${seriesName}:</strong> ${formattedValue}
                                </span>
                            </div>
                        `
                        })
                        .join('')
                    return `
                    <div style="
                        padding: 8px;
                        background-color: #e0e0e0;
                        border-radius: 6px;
                        box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
                        min-width: 120px;
                        text-align: left;
                        color: white;">
                        <strong style="color: black">${formattedDate}</strong>
                        ${tooltips}
                    </div>
                `
                },
            },
            markers: { size: 0 },
            legend: {
                show: true,
                position: 'top' as const,
                horizontalAlign: 'right' as const,
                fontSize: '13px',
                fontWeight: 500,
                markers: {
                    width: 16,
                    height: 16,
                    radius: 12,
                    fillColors: undefined,
                },
                itemMargin: {
                    horizontal: 12,
                    vertical: 8,
                },
                labels: {
                    colors: theme.palette.text.primary,
                    useSeriesColors: false,
                },
            },
        }),
        [data],
    )

    const handleChangeSeries = useCallback((newValue: string) => {
        setSelectedSeries(newValue as TimeInterval)
    }, [])

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Average Gas Usage"
                        subheader=""
                        action={
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
                        }
                    />
                    <Box sx={{ p: 1 }}>
                        <Chart
                            type="area"
                            series={[
                                {
                                    name: 'Ethereum',
                                    data:
                                        data?.map(d => ({
                                            x: new Date(d.transfer_date).getTime(),
                                            y: Number(d.eth_gas_usage),
                                        })) || [],
                                },
                                {
                                    name: 'Sui',
                                    data:
                                        data?.map(d => ({
                                            x: new Date(d.transfer_date).getTime(),
                                            y: Number(d.sui_gas_usage),
                                        })) || [],
                                },
                            ]}
                            options={chartOptions}
                            height={340}
                            forceLoading={isLoading}
                            loadingProps={{ sx: { p: 2.5 } }}
                        />
                    </Box>
                </Card>
            </Grid>
        </Grid>
    )
}
