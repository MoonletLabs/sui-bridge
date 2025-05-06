'use client'
import { Box, Card, CardHeader, CircularProgress, Grid, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { BridgeMetricsResponse } from 'src/utils/types'
import useSWR from 'swr'

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

    const renderLoading = () => (
        <Box display="flex" justifyContent="center" alignItems="center" height={340}>
            <CircularProgress />
        </Box>
    )

    const chartOptions = () =>
        useChart({
            chart: {
                stacked: false,
                zoom: { enabled: false },
                toolbar: { show: false },
                fontFamily: 'inherit',
            },
            colors: ['#3780FF'],
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
                },
                tooltip: {
                    enabled: false, // Disable the x-axis tooltip to avoid duplication with main tooltip
                },
            },
            tooltip: {
                shared: true,
                followCursor: true,
                intersect: false,
                custom: ({
                    series,
                    seriesIndex,
                    dataPointIndex,
                    w,
                }: {
                    series: any
                    seriesIndex: any
                    dataPointIndex: any
                    w: any
                }) => {
                    const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex]
                    const value = series[seriesIndex][dataPointIndex]

                    // Format date using dayjs for consistency with the rest of the app
                    const date = dayjs(timestamp)
                    const formattedDate = date.format('D MMM YYYY')

                    // Format the transaction count
                    const formattedValue = `${fNumber(value)}`

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
                            <div style="
                                display: flex;
                                align-items: center;
                                padding: 6px;
                                background-color: rgba(255, 255, 255, 0.8);
                                color: #333;
                                border-radius: 4px;
                                text-align: left;
                                font-size: 12px;
                                border-left: 4px solid #3780FF;
                                margin-bottom: 4px;">
                                <span style="margin-left: 8px;"><strong>Bridges:</strong> ${formattedValue}</span>
                            </div>
                        </div>
                    `
                },
            },
            markers: { size: 0 },
            legend: {
                show: false,
            },
        })

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    {isLoading ? (
                        renderLoading()
                    ) : (
                        <>
                            <CardHeader title="Bridge Transactions" />

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
                                                                const suiPercent =
                                                                    total > 0
                                                                        ? (suiCount / total) * 100
                                                                        : 0
                                                                const ethPercent =
                                                                    total > 0
                                                                        ? (ethCount / total) * 100
                                                                        : 0

                                                                return (
                                                                    <>
                                                                        {/* SUI */}
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
                                                                                            '#E6F4FF',
                                                                                        color: '#0063CC',
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

                                                                        {/* ETH */}
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
                                                    <Box mb={3}>
                                                        {/* Total Count */}
                                                        <Typography
                                                            variant="h5"
                                                            color="info.main"
                                                            gutterBottom
                                                        >
                                                            {fNumber(
                                                                performanceData.uniqueAddressesCount
                                                                    ?.total || 0,
                                                            )}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            gutterBottom
                                                        >
                                                            Unique Wallets{' '}
                                                            {timePeriod.toLowerCase()}
                                                        </Typography>

                                                        {/* Network Breakdown */}
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
                                                                        ?.uniqueAddressesCount
                                                                        ?.total || 0
                                                                const suiCount =
                                                                    performanceData
                                                                        ?.uniqueAddressesCount
                                                                        ?.sui || 0
                                                                const ethCount =
                                                                    performanceData
                                                                        ?.uniqueAddressesCount
                                                                        ?.eth || 0
                                                                const suiPercent =
                                                                    total > 0
                                                                        ? (suiCount / total) * 100
                                                                        : 0
                                                                const ethPercent =
                                                                    total > 0
                                                                        ? (ethCount / total) * 100
                                                                        : 0

                                                                return (
                                                                    <>
                                                                        {/* SUI */}
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
                                                                                            '#E6F4FF',
                                                                                        color: '#0063CC',
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

                                                                        {/* ETH */}
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
                                                </>
                                            )}
                                        </Box>
                                    </Grid>

                                    <Grid item xs={12} md={9}>
                                        <Chart
                                            type="area"
                                            series={[
                                                {
                                                    name: 'Transactions',
                                                    data: performanceData?.transactionCount
                                                        ? performanceData.transactionCount?.chart?.map(
                                                              item => ({
                                                                  x: new Date(
                                                                      item.transfer_date,
                                                                  ).getTime(),
                                                                  y: item.total_count,
                                                              }),
                                                          )
                                                        : [],
                                                },
                                            ]}
                                            options={chartOptions()}
                                            height={340}
                                            loadingProps={{ sx: { p: 2.5 } }}
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
