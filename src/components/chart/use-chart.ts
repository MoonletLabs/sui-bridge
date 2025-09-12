import { useTheme } from '@mui/material/styles'

import { varAlpha } from 'src/theme/styles'
import { mergePerformanceConfig } from './performance-config'
import type { ChartOptions } from './types'

// ----------------------------------------------------------------------

export function useChart(options?: ChartOptions): ChartOptions {
    const theme = useTheme()

    const LABEL_TOTAL = {
        show: true,
        label: 'Total',
        color: theme.vars.palette.text.secondary,
        fontSize: theme.typography.subtitle2.fontSize as string,
        fontWeight: theme.typography.subtitle2.fontWeight,
    }

    const LABEL_VALUE = {
        offsetY: 8,
        color: theme.vars.palette.text.primary,
        fontSize: theme.typography.h4.fontSize as string,
        fontWeight: theme.typography.h4.fontWeight,
    }

    const RESPONSIVE = [
        {
            breakpoint: theme.breakpoints.values.sm, // sm ~ 600
            options: {
                plotOptions: {
                    bar: {
                        borderRadius: 3,
                        columnWidth: '80%',
                    },
                },
            },
        },
        {
            breakpoint: theme.breakpoints.values.md, // md ~ 900
            options: {
                plotOptions: {
                    bar: {
                        columnWidth: '60%',
                    },
                },
            },
        },
        ...(options?.responsive ?? []),
    ]

    // Safely derive yAxis labels when yaxis is a single object (not an array)
    const yaxisOption = options?.yaxis as ApexYAxis | ApexYAxis[] | undefined
    const yaxisLabels = !Array.isArray(yaxisOption) ? yaxisOption?.labels : undefined

    const baseOptions = {
        ...options,

        /** **************************************
         * Chart
         *************************************** */
        chart: {
            toolbar: {
                show: false,
            },
            zoom: {
                enabled: false,
            },
            parentHeightOffset: 0,
            fontFamily: theme.typography.fontFamily,
            foreColor: theme.vars.palette.text.disabled,
            ...options?.chart,
            // animations: {
            //     enabled: true,
            //     speed: 360,
            //     animateGradually: { enabled: true, delay: 120 },
            //     dynamicAnimation: { enabled: true, speed: 360 },
            //     ...options?.chart?.animations,
            // },
        },

        /** **************************************
         * Colors
         *************************************** */
        colors: options?.colors ?? [
            theme.palette.primary.main,
            theme.palette.warning.main,
            theme.palette.info.main,
            theme.palette.error.main,
            theme.palette.success.main,
            theme.palette.warning.dark,
            theme.palette.success.darker,
            theme.palette.info.dark,
            theme.palette.info.darker,
        ],

        /** **************************************
         * States
         *************************************** */
        states: {
            ...options?.states,
            hover: {
                ...options?.states?.hover,
                filter: { type: 'darken', ...options?.states?.hover?.filter },
            },
            active: {
                ...options?.states?.active,
                filter: { type: 'darken', ...options?.states?.active?.filter },
            },
        },

        /** **************************************
         * Fill
         *************************************** */
        fill: {
            opacity: 1,
            ...options?.fill,
            gradient: {
                type: 'vertical',
                shadeIntensity: 0,
                opacityFrom: 0.4,
                opacityTo: 0,
                stops: [0, 100],
                ...options?.fill?.gradient,
            },
        },

        /** **************************************
         * Data labels
         *************************************** */
        dataLabels: {
            enabled: false,
            ...options?.dataLabels,
        },

        /** **************************************
         * Stroke
         *************************************** */
        stroke: {
            width: 2.5,
            curve: 'smooth',
            lineCap: 'round',
            ...options?.stroke,
        },

        /** **************************************
         * Grid
         *************************************** */
        grid: {
            strokeDashArray: 3,
            borderColor: theme.vars.palette.divider,
            ...options?.grid,
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
        },

        /** **************************************
         * X axis
         *************************************** */
        xaxis: {
            axisBorder: { show: false },
            axisTicks: { show: false },
            ...options?.xaxis,
        },

        /** **************************************
         * Y axis
         *************************************** */
        yaxis: {
            labels: {
                ...yaxisLabels,
                formatter: (value: number) => {
                    if (yaxisLabels?.formatter) {
                        return yaxisLabels.formatter(value as any)
                    }
                    return value.toLocaleString()
                },
            },
            ...options?.yaxis,
        },

        /** **************************************
         * Legend
         *************************************** */
        legend: {
            show: false,
            position: 'top',
            fontWeight: 500,
            fontSize: '13px',
            horizontalAlign: 'right',
            ...options?.legend,
            markers: {
                shape: 'circle',
                ...options?.legend?.markers,
            },
            labels: {
                colors: theme.vars.palette.text.primary,
                ...options?.legend?.labels,
            },
            itemMargin: {
                horizontal: 8,
                vertical: 8,
                ...options?.legend?.itemMargin,
            },
        },

        /** **************************************
         * Tooltip
         *************************************** */
        tooltip: {
            enabled: true,
            followCursor: true,
            intersect: false,
            ...options?.tooltip,
        },

        /** **************************************
         * Plot options
         *************************************** */
        plotOptions: {
            bar: {
                borderRadius: 0,
                columnWidth: '70%',
                ...options?.plotOptions?.bar,
            },
            pie: {
                donut: {
                    size: '0%',
                    ...options?.plotOptions?.pie?.donut,
                },
                ...options?.plotOptions?.pie,
            },
            ...options?.plotOptions,
        },

        /** **************************************
         * Responsive
         *************************************** */
        responsive: RESPONSIVE,

        /** **************************************
         * No data
         *************************************** */
        noData: {
            // text: 'No data',
            align: 'center',
            verticalAlign: 'middle',
            offsetX: 0,
            offsetY: 0,
            style: {
                color: theme.vars.palette.text.disabled,
                fontSize: '14px',
                fontFamily: theme.typography.fontFamily,
            },
            ...options?.noData,
        },
    }

    // Apply performance optimizations
    return mergePerformanceConfig(baseOptions)
}
