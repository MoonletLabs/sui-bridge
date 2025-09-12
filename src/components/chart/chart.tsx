import type { BoxProps } from '@mui/material/Box'

import dynamic from 'next/dynamic'

import Box from '@mui/material/Box'

import { chartClasses } from './classes'
import { ChartLoading } from './chart-loading'

import type { ChartProps, ChartBaseProps, ChartLoadingProps } from './types'
import { withLoadingProps } from 'src/utils/with-loading-props'

// ----------------------------------------------------------------------

type WithLoadingProps = ChartBaseProps & {
    loading?: ChartLoadingProps
}

const ApexChart = withLoadingProps<WithLoadingProps>(props =>
    dynamic(() => import('react-apexcharts').then(mod => mod.default), {
        ssr: false,
        loading: () => {
            const { loading, type } = props()

            return loading?.disabled ? null : <ChartLoading type={type} sx={loading?.sx} />
        },
    }),
)

export function Chart({
    sx,
    type,
    series,
    height,
    options,
    className,
    loadingProps,
    forceLoading,
    width = '100%',
    ...other
}: BoxProps & ChartProps) {
    // Performance optimization: prevent unnecessary re-renders
    const chartKey = `${type}-${height}-${JSON.stringify(series?.length || 0)}`

    return (
        <Box
            dir="ltr"
            className={chartClasses.root.concat(className ? ` ${className}` : '')}
            sx={{
                width,
                height,
                flexShrink: 0,
                borderRadius: 1.5,
                position: 'relative',
                ...sx,
            }}
            {...other}
        >
            {forceLoading ? (
                <ChartLoading type={type} sx={loadingProps?.sx} />
            ) : (
                <ApexChart
                    key={chartKey} // Add key to prevent unnecessary re-renders
                    type={type}
                    series={series}
                    options={{
                        ...options,
                        // Additional performance optimizations
                        chart: {
                            ...options?.chart,
                            redrawOnWindowResize: false,
                            redrawOnParentResize: false,
                            selection: { enabled: false }, // Disable selection for better performance
                            events: {
                                ...options?.chart?.events,
                                // Reduce event handling for better performance
                                beforeMount: undefined,
                                mounted: undefined,
                            },
                        },
                    }}
                    width="100%"
                    height="100%"
                    loading={loadingProps}
                />
            )}
        </Box>
    )
}
