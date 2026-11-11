import { useId } from 'react'

type Props = {
    values: number[]
    color: string
    width?: number
    height?: number
}

/**
 * Tiny dependency-free trend line. Much lighter than an ApexCharts instance
 * per card, and the Tokens page can show several at once.
 */
export function Sparkline({ values, color, width = 120, height = 36 }: Props) {
    const gradientId = useId()
    if (values.length < 2 || values.every(v => v === 0)) {
        return <svg width={width} height={height} aria-hidden />
    }

    const max = Math.max(...values)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const pad = 2
    const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad
    const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2)

    const line = values
        .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join(' ')
    const area = `${line} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
        </svg>
    )
}
