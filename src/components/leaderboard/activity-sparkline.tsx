import { Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { useMemo } from 'react'

interface ActivitySparklineProps {
    data: number[]
    width?: number
    height?: number
    color?: string
}

export function ActivitySparkline({
    data,
    width = 80,
    height = 30,
    color,
}: ActivitySparklineProps) {
    const theme = useTheme()
    const strokeColor = color || theme.palette.primary.main

    const { path, maxValue, hasActivity } = useMemo(() => {
        if (!data || data.length === 0) {
            return { path: '', maxValue: 0, hasActivity: false }
        }

        const max = Math.max(...data, 1) // Ensure at least 1 to avoid division by zero
        const hasAct = data.some(v => v > 0)

        const padding = 2
        const chartWidth = width - padding * 2
        const chartHeight = height - padding * 2

        const points = data.map((value, index) => {
            const x = padding + (index / (data.length - 1 || 1)) * chartWidth
            const y = padding + chartHeight - (value / max) * chartHeight
            return { x, y }
        })

        // Create SVG path
        const pathData = points
            .map((point, index) => {
                if (index === 0) return `M ${point.x} ${point.y}`
                return `L ${point.x} ${point.y}`
            })
            .join(' ')

        return { path: pathData, maxValue: max, hasActivity: hasAct }
    }, [data, width, height])

    // Create area path (for fill) - must be called before any conditional returns
    const areaPath = useMemo(() => {
        if (!data || data.length === 0 || !path) return ''

        const padding = 2
        const chartWidth = width - padding * 2
        const chartHeight = height - padding * 2
        const max = Math.max(...data, 1)

        const points = data.map((value, index) => {
            const x = padding + (index / (data.length - 1 || 1)) * chartWidth
            const y = padding + chartHeight - (value / max) * chartHeight
            return { x, y }
        })

        const bottomY = padding + chartHeight
        const firstX = points[0]?.x || padding
        const lastX = points[points.length - 1]?.x || width - padding

        return `${path} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
    }, [data, width, height, path])

    // No activity - show placeholder (after all hooks)
    if (!hasActivity) {
        return (
            <Box
                sx={{
                    width,
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.grey[500], 0.08),
                    borderRadius: 1,
                }}
            >
                <Box
                    sx={{
                        width: '60%',
                        height: 2,
                        bgcolor: alpha(theme.palette.grey[500], 0.3),
                        borderRadius: 1,
                    }}
                />
            </Box>
        )
    }

    return (
        <Box
            sx={{
                width,
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <svg width={width} height={height}>
                {/* Gradient definition */}
                <defs>
                    <linearGradient
                        id={`sparkline-gradient-${strokeColor.replace('#', '')}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity={0.05} />
                    </linearGradient>
                </defs>

                {/* Area fill */}
                <path
                    d={areaPath}
                    fill={`url(#sparkline-gradient-${strokeColor.replace('#', '')})`}
                />

                {/* Line */}
                <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </Box>
    )
}
