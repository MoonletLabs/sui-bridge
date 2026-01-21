'use client'

import {
    Card,
    CardHeader,
    Grid,
    ToggleButton,
    ToggleButtonGroup,
    Box,
    Typography,
} from '@mui/material'
import { useCallback, useState, useMemo } from 'react'
import { Chart, useChart } from 'src/components/chart'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { endpoints, fetcher } from 'src/utils/axios'
import { fShortenNumber } from 'src/utils/format-number'
import useSWR from 'swr'

type MetricType = 'volume_usd' | 'count' | 'volume'
type FlowType = 'all' | 'inflow' | 'outflow'
type ViewType = 'hourly' | 'daily' | 'monthly' | 'timeline'

interface HeatmapResponse {
    viewType: ViewType
    matrix: number[][]
    labels: {
        rows: string[] // Y-axis labels
        cols: string[] // X-axis labels
    }
    summary: {
        peak_row: number
        peak_row_label: string
        peak_col: number
        peak_col_label: string
        peak_value: number
        quietest_row: number
        quietest_row_label: string
        quietest_col: number
        quietest_col_label: string
        quietest_value: number
        total: number
    }
    period: string
    metric: string
}

export default function ActivityHeatmap() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    const [metric, setMetric] = useState<MetricType>('volume_usd')
    const [flow, setFlow] = useState<FlowType>('all')

    const queryParams = new URLSearchParams({
        network,
        period: timePeriod,
        metric,
        flow,
    }).toString()

    const { data, isLoading } = useSWR<HeatmapResponse>(
        `${endpoints.analytics.heatmap}?${queryParams}`,
        fetcher,
        {
            revalidateOnFocus: false,
        },
    )

    const handleMetricChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newMetric: MetricType | null) => {
            if (newMetric) setMetric(newMetric)
        },
        [],
    )

    const handleFlowChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newFlow: FlowType | null) => {
            if (newFlow) setFlow(newFlow)
        },
        [],
    )

    const formatValue = useCallback(
        (value: number): string => {
            if (metric === 'count') {
                return value.toLocaleString()
            }
            if (metric === 'volume_usd') {
                return `$${fShortenNumber(value)}`
            }
            return fShortenNumber(value)
        },
        [metric],
    )

    // Round to nice display numbers (e.g., 413.81k -> 500k, 2.69m -> 3m)
    const roundToNice = useCallback((value: number): number => {
        if (value === 0) return 0

        // Determine the magnitude
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)))

        // Nice increments based on magnitude
        let niceIncrement: number
        if (magnitude >= 1000000) {
            // Millions: round to nearest 0.5M or 1M
            niceIncrement = magnitude / 2
        } else if (magnitude >= 100000) {
            // Hundreds of thousands: round to nearest 100K
            niceIncrement = 100000
        } else if (magnitude >= 10000) {
            // Tens of thousands: round to nearest 10K or 50K
            niceIncrement = 50000
        } else if (magnitude >= 1000) {
            // Thousands: round to nearest 1K or 5K
            niceIncrement = 5000
        } else if (magnitude >= 100) {
            // Hundreds: round to nearest 100
            niceIncrement = 100
        } else if (magnitude >= 10) {
            // Tens: round to nearest 10
            niceIncrement = 10
        } else {
            // Small numbers: round to nearest 1
            niceIncrement = 1
        }

        // Round up to the nearest nice increment
        return Math.ceil(value / niceIncrement) * niceIncrement
    }, [])

    const viewType = data?.viewType ?? 'monthly'
    const isHourlyView = viewType === 'hourly'
    const isDailyView = viewType === 'daily'
    const isMonthlyView = viewType === 'monthly'
    const isTimelineView = viewType === 'timeline'
    const isSingleRowView = isHourlyView

    // Transform data for ApexCharts heatmap format
    // ApexCharts heatmap renders series from bottom to top, so reverse to put first row at top
    const series = useMemo(() => {
        if (!data?.labels?.rows) return []

        const seriesData = data.labels.rows.map((rowName, rowIndex) => ({
            name: rowName,
            data:
                data?.labels?.cols?.map((colLabel, colIndex) => ({
                    x: colLabel,
                    y: data.matrix[rowIndex]?.[colIndex] ?? 0,
                })) ?? [],
        }))

        // For single-row view (hourly), no need to reverse
        // For multi-row views (daily, monthly, timeline), reverse so first row appears at top
        return isSingleRowView ? seriesData : seriesData.reverse()
    }, [data, isSingleRowView])

    // Get peak value for color scale
    const peakValue = useMemo(() => {
        return data?.summary?.peak_value ?? 1000000
    }, [data?.summary?.peak_value])

    // Color scale ranges with value labels (using nice rounded numbers)
    const colorRanges = useMemo(() => {
        // Calculate raw thresholds
        const rawLowMax = peakValue * 0.1
        const rawMedMax = peakValue * 0.35
        const rawHighMax = peakValue * 0.65

        // Round to nice display values
        const lowMax = roundToNice(rawLowMax)
        const medMax = roundToNice(rawMedMax)
        const highMax = roundToNice(rawHighMax)
        const veryHighMax = peakValue * 1.1

        return [
            {
                from: 0,
                to: 0,
                name: 'No Activity',
                color: '#454F5B',
            },
            {
                from: 0.01,
                to: lowMax,
                name: `Low (< ${formatValue(lowMax)})`,
                color: '#22C55E',
            },
            {
                from: lowMax,
                to: medMax,
                name: `Medium (${formatValue(lowMax)} - ${formatValue(medMax)})`,
                color: '#FACC15',
            },
            {
                from: medMax,
                to: highMax,
                name: `High (${formatValue(medMax)} - ${formatValue(highMax)})`,
                color: '#F97316',
            },
            {
                from: highMax,
                to: veryHighMax,
                name: `Very High (> ${formatValue(highMax)})`,
                color: '#EF4444',
            },
        ]
    }, [peakValue, formatValue, roundToNice])

    // Reversed row labels for tooltip (since series is reversed for multi-row views)
    const reversedRowLabels = useMemo(() => {
        if (!data?.labels?.rows) return []
        return isSingleRowView ? data.labels.rows : [...data.labels.rows].reverse()
    }, [data?.labels?.rows, isSingleRowView])

    // Dynamic chart height based on view type
    const chartHeight = useMemo(() => {
        if (isSingleRowView) return 180 // Single row for hourly
        if (isDailyView) return 340 // 7 days (rows)
        if (isMonthlyView) return 280 // 5 weeks (rows)
        return 340 // 7 days (rows) for timeline
    }, [isSingleRowView, isDailyView, isMonthlyView])

    const chartOptions = useChart({
        chart: {
            type: 'heatmap',
            toolbar: {
                show: false,
            },
        },
        dataLabels: {
            enabled: false,
        },
        colors: ['#E53935'],
        xaxis: {
            type: 'category',
            categories: data?.labels?.cols ?? [],
            labels: {
                style: {
                    fontSize: isSingleRowView ? '11px' : '10px',
                },
                rotate: isTimelineView ? -45 : 0,
                rotateAlways: isTimelineView,
            },
        },
        yaxis: {
            show: !isSingleRowView, // Hide Y-axis labels for single-row views (hourly/daily)
            labels: {
                style: {
                    fontSize: '11px',
                },
                offsetX: -10,
            },
        },
        grid: {
            padding: {
                left: isSingleRowView ? 10 : 20,
                right: 10,
                bottom: isTimelineView ? 10 : 0,
            },
        },
        plotOptions: {
            heatmap: {
                enableShades: false,
                radius: 2,
                useFillColorAsStroke: false,
                colorScale: {
                    ranges: colorRanges,
                },
            },
        },
        tooltip: {
            custom: ({
                seriesIndex,
                dataPointIndex,
            }: {
                seriesIndex: number
                dataPointIndex: number
            }) => {
                const row = reversedRowLabels[seriesIndex] ?? ''
                const col = data?.labels?.cols?.[dataPointIndex] ?? ''
                const reversedMatrix = isSingleRowView
                    ? data?.matrix
                    : data?.matrix
                      ? [...data.matrix].reverse()
                      : []
                const value = reversedMatrix?.[seriesIndex]?.[dataPointIndex] ?? 0

                // Format label based on view type
                let label: string
                if (isHourlyView) {
                    label = col // "14:00"
                } else if (isDailyView) {
                    // Days on Y-axis, time intervals on X-axis: "Mon, 08:00-12:00"
                    label = `${row}, ${col}`
                } else if (isMonthlyView) {
                    // Weeks on Y-axis, days on X-axis: "21 Jan-27 Jan, Mon"
                    label = `${row}, ${col}`
                } else {
                    // timeline: Days on Y-axis, months on X-axis: "Mon, Jan '25"
                    label = `${row}, ${col}`
                }

                return `
                    <div style="padding: 8px 12px; background: #1C252E; border-radius: 4px; border: 1px solid #454F5B;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: #fff;">${label}</div>
                        <div style="color: #22C55E; font-weight: 500;">${formatValue(value)}</div>
                    </div>
                `
            },
        },
        legend: {
            show: true,
            position: 'bottom',
            horizontalAlign: 'center',
            offsetY: 5,
            showForSingleSeries: true,
            itemMargin: {
                horizontal: 12,
                vertical: 8,
            },
            markers: {
                size: 6,
            },
        },
    })

    // Update chart options when colorRanges change
    const finalChartOptions = useMemo(
        () => ({
            ...chartOptions,
            plotOptions: {
                ...chartOptions?.plotOptions,
                heatmap: {
                    ...chartOptions?.plotOptions?.heatmap,
                    colorScale: {
                        ranges: colorRanges,
                    },
                },
            },
            legend: {
                show: true,
                position: 'bottom' as const,
                horizontalAlign: 'center' as const,
                offsetY: 5,
                showForSingleSeries: true,
                itemMargin: {
                    horizontal: 12,
                    vertical: 8,
                },
                markers: {
                    size: 6,
                },
            },
        }),
        [chartOptions, colorRanges],
    )

    const metricLabel = {
        volume_usd: 'Volume (USD)',
        count: 'Transaction Count',
        volume: 'Volume (Raw)',
    }

    // Dynamic subheader based on view type
    const subheader = useMemo(() => {
        if (isHourlyView) {
            return `${metricLabel[metric]} by hour (UTC)`
        }
        if (isDailyView) {
            return `${metricLabel[metric]} by day and time interval (UTC)`
        }
        if (isMonthlyView) {
            return `${metricLabel[metric]} by week and day of week (UTC)`
        }
        // timeline
        return `${metricLabel[metric]} by day of week and month (UTC)`
    }, [isHourlyView, isDailyView, isMonthlyView, metric])

    // Format summary labels based on view type
    const formatSummaryLabel = useCallback(
        (rowLabel: string, colLabel: string) => {
            if (isHourlyView) {
                return colLabel // "14:00"
            }
            if (isDailyView) {
                // Days on Y-axis, time intervals on X-axis: "Mon, 08:00-12:00"
                return `${rowLabel}, ${colLabel}`
            }
            if (isMonthlyView) {
                // Weeks on Y-axis, days on X-axis: "21 Jan-27 Jan, Mon"
                return `${rowLabel}, ${colLabel}`
            }
            // timeline: Days on Y-axis, months on X-axis: "Mon, Jan '25"
            return `${rowLabel}, ${colLabel}`
        },
        [isHourlyView, isDailyView, isMonthlyView],
    )

    const statCardSx = {
        p: 2,
        borderRadius: 1,
        bgcolor: 'background.neutral',
        textAlign: 'center',
        height: '100%',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    }

    return (
        <Grid container spacing={4} marginTop={2}>
            <Grid item xs={12}>
                <Card>
                    <CardHeader
                        title="Activity Heatmap"
                        subheader={subheader}
                        action={
                            <Grid container alignItems="center" spacing={1} wrap="nowrap">
                                <Grid item>
                                    <ToggleButtonGroup
                                        value={flow}
                                        exclusive
                                        onChange={handleFlowChange}
                                        size="small"
                                    >
                                        <ToggleButton value="all">All</ToggleButton>
                                        <ToggleButton value="inflow">Inflow</ToggleButton>
                                        <ToggleButton value="outflow">Outflow</ToggleButton>
                                    </ToggleButtonGroup>
                                </Grid>
                                <Grid item>
                                    <ToggleButtonGroup
                                        value={metric}
                                        exclusive
                                        onChange={handleMetricChange}
                                        size="small"
                                    >
                                        <ToggleButton value="volume_usd">USD</ToggleButton>
                                        <ToggleButton value="count">Count</ToggleButton>
                                    </ToggleButtonGroup>
                                </Grid>
                            </Grid>
                        }
                    />

                    <Chart
                        key={`heatmap-${timePeriod}-${metric}-${flow}-${peakValue}-${viewType}`}
                        type="heatmap"
                        series={series}
                        options={finalChartOptions}
                        height={chartHeight}
                        loadingProps={{ sx: { p: 2.5 } }}
                        sx={{ py: 2.5, pl: { xs: 1, md: 3 }, pr: 2.5 }}
                        forceLoading={isLoading}
                    />

                    {/* Summary Stats */}
                    {data?.summary && (
                        <Box sx={{ px: 3, pb: 3 }}>
                            <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
                                <Grid item xs={6} md={3}>
                                    <Box sx={statCardSx}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 0.5 }}
                                        >
                                            Peak Activity
                                        </Typography>
                                        <Typography variant="h6" color="error.main">
                                            {formatSummaryLabel(
                                                data.summary.peak_row_label,
                                                data.summary.peak_col_label,
                                            )}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatValue(data.summary.peak_value)}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Box sx={statCardSx}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 0.5 }}
                                        >
                                            Quietest Time
                                        </Typography>
                                        <Typography variant="h6" color="success.main">
                                            {formatSummaryLabel(
                                                data.summary.quietest_row_label,
                                                data.summary.quietest_col_label,
                                            )}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatValue(data.summary.quietest_value)}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Box sx={statCardSx}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 0.5 }}
                                        >
                                            Total ({timePeriod})
                                        </Typography>
                                        <Typography variant="h6" color="primary.main">
                                            {formatValue(data.summary.total)}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ visibility: 'hidden' }}
                                        >
                                            &nbsp;
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Box sx={statCardSx}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 0.5 }}
                                        >
                                            Period
                                        </Typography>
                                        <Typography variant="h6">{data.period}</Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ visibility: 'hidden' }}
                                        >
                                            &nbsp;
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </Card>
            </Grid>
        </Grid>
    )
}
