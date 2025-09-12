// Chart performance configuration
export const CHART_PERFORMANCE_CONFIG = {
    // Animation settings
    animations: {
        enabled: false, // Disable animations by default for better performance
        speed: 200, // Reduced animation speed when enabled
        animateGradually: false, // Disable gradual animations
        dynamicAnimation: false, // Disable dynamic animations
    },

    // Rendering optimizations
    rendering: {
        redrawOnWindowResize: false,
        redrawOnParentResize: false,
        selection: { enabled: false },
        events: {
            beforeMount: undefined,
            mounted: undefined,
        },
    },

    // Data optimization
    data: {
        maxDataPoints: 1000, // Limit data points for better performance
        enableDataLabels: false, // Disable data labels for better performance
    },

    // Tooltip optimization
    tooltip: {
        enabled: true,
        custom: undefined, // Use default tooltips for better performance
        followCursor: true,
        intersect: false,
    },

    // Grid optimization
    grid: {
        strokeDashArray: 3,
        borderColor: 'rgba(145, 158, 171, 0.2)',
        show: true,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
    },
}

// Function to merge performance config with chart options
export function mergePerformanceConfig(chartOptions: any) {
    return {
        ...chartOptions,
        chart: {
            ...CHART_PERFORMANCE_CONFIG.rendering,
            animations: CHART_PERFORMANCE_CONFIG.animations,
            ...chartOptions?.chart,
        },
        tooltip: {
            ...CHART_PERFORMANCE_CONFIG.tooltip,
            ...chartOptions?.tooltip,
        },
        grid: {
            ...CHART_PERFORMANCE_CONFIG.grid,
            ...chartOptions?.grid,
        },
        dataLabels: {
            enabled: CHART_PERFORMANCE_CONFIG.data.enableDataLabels,
            ...chartOptions?.dataLabels,
        },
    }
}
