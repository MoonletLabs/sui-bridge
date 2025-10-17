'use client'
import { Box, Card, CardHeader, CircularProgress, Grid, Typography, Button } from '@mui/material'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { Chart, useChart } from 'src/components/chart'
import { BridgePerformanceChartLoading } from '../skeletons/bridge-performance-chart-loading'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { BridgeMetricsResponse } from 'src/utils/types'
import useSWR from 'swr'
import { downloadCsv } from 'src/utils/csv'

export default function BridgePerformanceChart() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()

    // New endpoints for bridge performance metrics
    const { data: performanceData, isLoading } = useSWR<BridgeMetricsResponse>(
        endpoints.bridgeMetrics
            ? `${endpoints.bridgeMetrics}?network=${network}&period=${timePeriod}`
            : null,
        fetcher,
        { revalidateOnFocus: false },
    )

    // Get base chart options from useChart Hook
    const baseChartOptions = useChart({
        chart: {
            stacked: false,
            zoom: { enabled: false },
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: false }, // Disable animations for better performance
        },
        colors: ['#00A76F', '#FF5630'], // Inflow (green), Outflow (red)
        plotOptions: {
            area: {
                fillTo: 'end',
            },
        },
        fill: {
            type: 'gradient',
            gradient: {
                colorStops: [
                    {
                        offset: 0,
                        color: '#3780FF',
                        opacity: 0.5,
                    },
                    {
                        offset: 100,
                        color: '#3780FF',
                        opacity: 0.0,
                    },
                ],
            },
        },
        stroke: { curve: 'smooth', width: 3 },
        grid: {
            strokeDashArray: 3,
            borderColor: 'rgba(145, 158, 171, 0.2)',
        },
        xaxis: {
            type: 'datetime',
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                format: 'dd MMM',
                rotate: -45, // Rotate labels to prevent overlap
                rotateAlways: false, // Only rotate when needed
            },
            tooltip: {
                enabled: false, // Disable the x-axis tooltip to avoid duplication with main tooltip
            },
        },
        tooltip: {
            shared: true,
            followCursor: true,
            intersect: false,
            enabled: true,
            custom: ({ series, dataPointIndex, w }: any) => {
                const timestamp = w.globals.seriesX[0][dataPointIndex]
                const date = dayjs(timestamp)
                const formattedDate = date.format('D MMM YYYY')

                const suiVal = series?.[0]?.[dataPointIndex] ?? 0
                const ethVal = series?.[1]?.[dataPointIndex] ?? 0
                const total = (suiVal || 0) + (ethVal || 0)

                const row = (label: string, color: string, value: number) => `
                    <div style="
                        display: flex;
                        align-items: center;
                        padding: 6px;
                        background-color: rgba(255, 255, 255, 0.85);
                        color: #333;
                        border-radius: 4px;
                        text-align: left;
                        font-size: 12px;
                        border-left: 4px solid ${color};
                        margin-bottom: 4px;">
                        <span style="margin-left: 8px;"><strong>${label}:</strong> ${fNumber(value)}</span>
                    </div>`

                return `
                    <div style="
                        padding: 8px;
                        background-color: #e0e0e0;
                        border-radius: 6px;
                        box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
                        min-width: 160px;
                        text-align: left;
                        color: white;">
                        <strong style="color: black">${formattedDate}</strong>
                        ${row('Inflow (to SUI)', '#00A76F', suiVal)}
                        ${row('Outflow (to ETH)', '#FF5630', ethVal)}
                        <div style="
                            margin-top: 6px;
                            padding: 6px;
                            background-color: rgba(0, 0, 0, 0.75);
                            color: #fff;
                            border-radius: 4px;
                            font-size: 12px;">
                            <strong>Total:</strong> ${fNumber(total)}
                        </div>
                    </div>
                `
            },
        },
        markers: { size: 0 },
        legend: {
            show: true,
            position: 'top',
        },
    })

    // Optimize chart options with useMemo to prevent unnecessary re-renders
    const chartOptions = useMemo(() => baseChartOptions, [baseChartOptions, timePeriod])

    // Optimize chart series data with useMemo
    const chartSeries = useMemo(() => {
        if (!performanceData?.transactionCount?.chart) return []

        return [
            {
                name: 'Inflow (to SUI)',
                data: performanceData.transactionCount.chart.map((item: any) => ({
                    x: new Date(item.transfer_date).getTime(),
                    y: Number(item.sui_count || 0),
                })),
            },
            {
                name: 'Outflow (to ETH)',
                data: performanceData.transactionCount.chart.map((item: any) => ({
                    x: new Date(item.transfer_date).getTime(),
                    y: Number(item.eth_count || 0),
                })),
            },
        ]
    }, [performanceData?.transactionCount?.chart])

    const handleExport = () => {
        if (!performanceData?.transactionCount?.chart) return
        const rows = performanceData.transactionCount.chart.map(it => ({
            transfer_date: it.transfer_date,
            total_count: it.total_count,
            sui_count: it.sui_count,
            eth_count: it.eth_count,
        }))
        downloadCsv('bridge-transactions', rows)
    }

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    {isLoading ? (
                        <BridgePerformanceChartLoading />
                    ) : (
                        <>
                            <CardHeader
                                title="Bridge Transactions"
                                action={
                                    <Button size="small" onClick={handleExport} variant="outlined">
                                        Export CSV
                                    </Button>
                                }
                            />

                            <Box sx={{ p: 1 }}>
                                <Grid
                                    container
                                    justifyContent="center"
                                    alignItems="center"
                                    spacing={2}
                                >
                                    <Grid item xs={12} md={3}>
                                        <Box sx={{ p: 2, textAlign: 'center' }}>
                                            {performanceData && (
                                                <>
                                                    {/* Total Bridges */}
                                                    <Box mb={4}>
                                                        <Typography
                                                            variant="h5"
                                                            color="primary"
                                                            gutterBottom
                                                        >
                                                            {performanceData
                                                                ? fNumber(
                                                                      performanceData
                                                                          ?.transactionCount
                                                                          ?.total || 0,
                                                                  )
                                                                : ''}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            gutterBottom
                                                        >
                                                            Total Bridges {timePeriod.toLowerCase()}
                                                        </Typography>

                                                        {/* Network Breakdown for Transaction Counts */}
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 1,
                                                                mt: 1.5,
                                                            }}
                                                        >
                                                            {/* Calculate percentages */}
                                                            {(() => {
                                                                const total =
                                                                    performanceData
                                                                        ?.transactionCount?.total ||
                                                                    0
                                                                const suiCount =
                                                                    performanceData
                                                                        ?.transactionCount?.sui || 0
                                                                const ethCount =
                                                                    performanceData
                                                                        ?.transactionCount?.eth || 0

                                                                const suiPercent = total
                                                                    ? (suiCount / total) * 100
                                                                    : 0
                                                                const ethPercent = total
                                                                    ? (ethCount / total) * 100
                                                                    : 0

                                                                return (
                                                                    <>
                                                                        <Box
                                                                            sx={{
                                                                                p: 1.5,
                                                                                borderRadius: 1,
                                                                                bgcolor:
                                                                                    'background.neutral',
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                justifyContent:
                                                                                    'space-between',
                                                                            }}
                                                                        >
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    gap: 1,
                                                                                }}
                                                                            >
                                                                                <Box
                                                                                    component="img"
                                                                                    src="/assets/icons/brands/sui.svg"
                                                                                    alt="SUI"
                                                                                    sx={{
                                                                                        width: 20,
                                                                                        height: 20,
                                                                                    }}
                                                                                />
                                                                                <Typography
                                                                                    variant="body2"
                                                                                    fontWeight="medium"
                                                                                >
                                                                                    SUI
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    gap: 1,
                                                                                }}
                                                                            >
                                                                                <Typography variant="body2">
                                                                                    {fNumber(
                                                                                        suiCount,
                                                                                    )}
                                                                                </Typography>
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    sx={{
                                                                                        bgcolor:
                                                                                            '#EBF8FF',
                                                                                        color: '#006399',
                                                                                        borderRadius:
                                                                                            '3px',
                                                                                        px: 0.5,
                                                                                        py: 0.1,
                                                                                        fontWeight:
                                                                                            'medium',
                                                                                        fontSize:
                                                                                            '0.65rem',
                                                                                    }}
                                                                                >
                                                                                    {suiPercent.toFixed(
                                                                                        1,
                                                                                    )}
                                                                                    %
                                                                                </Typography>
                                                                            </Box>
                                                                        </Box>

                                                                        <Box
                                                                            sx={{
                                                                                p: 1.5,
                                                                                borderRadius: 1,
                                                                                bgcolor:
                                                                                    'background.neutral',
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                justifyContent:
                                                                                    'space-between',
                                                                            }}
                                                                        >
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    gap: 1,
                                                                                }}
                                                                            >
                                                                                <Box
                                                                                    component="img"
                                                                                    src="/assets/icons/brands/eth.svg"
                                                                                    alt="ETH"
                                                                                    sx={{
                                                                                        width: 20,
                                                                                        height: 20,
                                                                                    }}
                                                                                />
                                                                                <Typography
                                                                                    variant="body2"
                                                                                    fontWeight="medium"
                                                                                >
                                                                                    ETH
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    gap: 1,
                                                                                }}
                                                                            >
                                                                                <Typography variant="body2">
                                                                                    {fNumber(
                                                                                        ethCount,
                                                                                    )}
                                                                                </Typography>
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    sx={{
                                                                                        bgcolor:
                                                                                            '#EBF8FF',
                                                                                        color: '#006399',
                                                                                        borderRadius:
                                                                                            '3px',
                                                                                        px: 0.5,
                                                                                        py: 0.1,
                                                                                        fontWeight:
                                                                                            'medium',
                                                                                        fontSize:
                                                                                            '0.65rem',
                                                                                    }}
                                                                                >
                                                                                    {ethPercent.toFixed(
                                                                                        1,
                                                                                    )}
                                                                                    %
                                                                                </Typography>
                                                                            </Box>
                                                                        </Box>
                                                                    </>
                                                                )
                                                            })()}
                                                        </Box>
                                                    </Box>

                                                    {/* Unique Wallets Section */}
                                                    <Box mb={2}>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            gutterBottom
                                                        >
                                                            Unique Wallets{' '}
                                                            {timePeriod.toLowerCase()}
                                                        </Typography>

                                                        {(() => {
                                                            const total =
                                                                performanceData
                                                                    ?.uniqueAddressesCount?.total ||
                                                                0
                                                            const suiCount =
                                                                performanceData
                                                                    ?.uniqueAddressesCount?.sui || 0
                                                            const ethCount =
                                                                performanceData
                                                                    ?.uniqueAddressesCount?.eth || 0

                                                            const suiPercent = total
                                                                ? (suiCount / total) * 100
                                                                : 0
                                                            const ethPercent = total
                                                                ? (ethCount / total) * 100
                                                                : 0

                                                            return (
                                                                <>
                                                                    <Box
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 1,
                                                                            bgcolor:
                                                                                'background.neutral',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent:
                                                                                'space-between',
                                                                            mb: 1,
                                                                        }}
                                                                    >
                                                                        <Typography
                                                                            variant="body2"
                                                                            fontWeight="medium"
                                                                        >
                                                                            Total
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            {fNumber(total)}
                                                                        </Typography>
                                                                    </Box>

                                                                    <Box
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 1,
                                                                            bgcolor:
                                                                                'background.neutral',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent:
                                                                                'space-between',
                                                                            mb: 1,
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                gap: 1,
                                                                            }}
                                                                        >
                                                                            <Box
                                                                                component="img"
                                                                                src="/assets/icons/brands/sui.svg"
                                                                                alt="SUI"
                                                                                sx={{
                                                                                    width: 20,
                                                                                    height: 20,
                                                                                }}
                                                                            />
                                                                            <Typography
                                                                                variant="body2"
                                                                                fontWeight="medium"
                                                                            >
                                                                                SUI
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                gap: 1,
                                                                            }}
                                                                        >
                                                                            <Typography variant="body2">
                                                                                {fNumber(suiCount)}
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{
                                                                                    bgcolor:
                                                                                        '#EBF8FF',
                                                                                    color: '#006399',
                                                                                    borderRadius:
                                                                                        '3px',
                                                                                    px: 0.5,
                                                                                    py: 0.1,
                                                                                    fontWeight:
                                                                                        'medium',
                                                                                    fontSize:
                                                                                        '0.65rem',
                                                                                }}
                                                                            >
                                                                                {suiPercent.toFixed(
                                                                                    1,
                                                                                )}
                                                                                %
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>

                                                                    <Box
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 1,
                                                                            bgcolor:
                                                                                'background.neutral',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent:
                                                                                'space-between',
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                gap: 1,
                                                                            }}
                                                                        >
                                                                            <Box
                                                                                component="img"
                                                                                src="/assets/icons/brands/eth.svg"
                                                                                alt="ETH"
                                                                                sx={{
                                                                                    width: 20,
                                                                                    height: 20,
                                                                                }}
                                                                            />
                                                                            <Typography
                                                                                variant="body2"
                                                                                fontWeight="medium"
                                                                            >
                                                                                ETH
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems:
                                                                                    'center',
                                                                                gap: 1,
                                                                            }}
                                                                        >
                                                                            <Typography variant="body2">
                                                                                {fNumber(ethCount)}
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{
                                                                                    bgcolor:
                                                                                        '#EBF8FF',
                                                                                    color: '#006399',
                                                                                    borderRadius:
                                                                                        '3px',
                                                                                    px: 0.5,
                                                                                    py: 0.1,
                                                                                    fontWeight:
                                                                                        'medium',
                                                                                    fontSize:
                                                                                        '0.65rem',
                                                                                }}
                                                                            >
                                                                                {ethPercent.toFixed(
                                                                                    1,
                                                                                )}
                                                                                %
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                </>
                                                            )
                                                        })()}
                                                    </Box>
                                                </>
                                            )}
                                        </Box>
                                    </Grid>

                                    <Grid item xs={12} md={9}>
                                        <Chart
                                            type="area"
                                            series={chartSeries}
                                            options={chartOptions}
                                            height={340}
                                            loadingProps={{ sx: { p: 2.5 } }}
                                            forceLoading={isLoading}
                                        />
                                    </Grid>
                                </Grid>
                            </Box>
                        </>
                    )}
                </Card>
            </Grid>
        </Grid>
    )
}
