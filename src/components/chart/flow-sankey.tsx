'use client'

import { Box, Typography, useTheme } from '@mui/material'
import { sankey, sankeyLinkHorizontal, SankeyGraph } from 'd3-sankey'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlowRow } from 'src/utils/types'

// ----------------------------------------------------------------------
// Types

type SankeyNodeDatum = {
    id: string
    label: string
    kind: 'chain' | 'token'
    side?: 'src' | 'dst'
    color: string
}

type SankeyLinkDatum = {
    source: string
    target: string
    value: number
    count: number
    usd: number
    route: string // "ETH → USDC → SUI"
    tokenLabel: string
    srcLabel: string
    dstLabel: string
}

export type FlowSankeyProps = {
    data: FlowRow[]
    unit: 'usd' | 'count'
    height?: number
    chainLabel: (id: number) => string
    chainColor: (id: number) => string
    tokenLabel: (id: number) => string
    tokenColor: (id: number) => string
}

// ----------------------------------------------------------------------

const NODE_WIDTH = 18
const NODE_PADDING = 14
const MARGIN = { top: 16, right: 120, bottom: 16, left: 80 }

function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return '$0'
    const abs = Math.abs(value)
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}k`
    return `$${value.toFixed(0)}`
}

function formatCount(n: number): string {
    if (!Number.isFinite(n)) return '0'
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
    return String(n)
}

// ----------------------------------------------------------------------

export function FlowSankey({
    data,
    unit,
    height = 520,
    chainLabel,
    chainColor,
    tokenLabel,
    tokenColor,
}: FlowSankeyProps) {
    const theme = useTheme()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [hoveredLinkIdx, setHoveredLinkIdx] = useState<number | null>(null)
    const [tooltip, setTooltip] = useState<{
        x: number
        y: number
        link: SankeyLinkDatum
    } | null>(null)

    // Responsive width
    const [width, setWidth] = useState<number>(960)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const onResize = () => {
            if (containerRef.current) {
                setWidth(containerRef.current.clientWidth || 960)
            }
        }
        window.addEventListener('resize', onResize)
        // Measure immediately after mount
        onResize()
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const { nodes, links, graph, totalValue } = useMemo(() => {
        // Build nodes:
        //  src chain (left), token (middle), dst chain (right).
        const srcChains = new Set<number>()
        const dstChains = new Set<number>()
        const tokenIds = new Set<number>()
        data.forEach(r => {
            srcChains.add(r.src_chain)
            dstChains.add(r.dst_chain)
            tokenIds.add(r.token_id)
        })

        const nodeList: SankeyNodeDatum[] = []
        const push = (n: SankeyNodeDatum) => {
            nodeList.push(n)
        }

        Array.from(srcChains).forEach(id =>
            push({
                id: `src:${id}`,
                label: chainLabel(id),
                kind: 'chain',
                side: 'src',
                color: chainColor(id),
            }),
        )
        Array.from(tokenIds).forEach(id =>
            push({
                id: `tok:${id}`,
                label: tokenLabel(id),
                kind: 'token',
                color: tokenColor(id),
            }),
        )
        Array.from(dstChains).forEach(id =>
            push({
                id: `dst:${id}`,
                label: chainLabel(id),
                kind: 'chain',
                side: 'dst',
                color: chainColor(id),
            }),
        )

        // Build links: each row → two links (src→token, token→dst).
        const linkList: SankeyLinkDatum[] = []
        let total = 0
        data.forEach(r => {
            const value = unit === 'usd' ? r.usd : r.count
            if (!value || value <= 0) return
            total += value
            const route = `${chainLabel(r.src_chain)} → ${tokenLabel(r.token_id)} → ${chainLabel(
                r.dst_chain,
            )}`
            const base = {
                value,
                count: r.count,
                usd: r.usd,
                route,
                tokenLabel: tokenLabel(r.token_id),
                srcLabel: chainLabel(r.src_chain),
                dstLabel: chainLabel(r.dst_chain),
            }
            linkList.push({
                source: `src:${r.src_chain}`,
                target: `tok:${r.token_id}`,
                ...base,
            })
            linkList.push({
                source: `tok:${r.token_id}`,
                target: `dst:${r.dst_chain}`,
                ...base,
            })
        })

        const innerW = Math.max(200, width - MARGIN.left - MARGIN.right)
        const innerH = Math.max(200, height - MARGIN.top - MARGIN.bottom)

        const gen = sankey<SankeyNodeDatum, SankeyLinkDatum>()
            .nodeId(d => d.id)
            .nodeWidth(NODE_WIDTH)
            .nodePadding(NODE_PADDING)
            .extent([
                [0, 0],
                [innerW, innerH],
            ])

        let g: SankeyGraph<SankeyNodeDatum, SankeyLinkDatum> | null = null
        try {
            g = gen({
                nodes: nodeList.map(n => ({ ...n })),
                links: linkList.map(l => ({ ...l })),
            })
        } catch (err) {
            g = null
        }

        return {
            nodes: (g?.nodes ?? []) as any[],
            links: (g?.links ?? []) as any[],
            graph: g,
            totalValue: total,
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, unit, width, height, chainLabel, chainColor, tokenLabel, tokenColor])

    const linkPath = sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>()

    if (!graph || !data || data.length === 0) {
        return (
            <Box
                sx={{
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                }}
            >
                <Typography variant="body2">No bridge activity in the selected period.</Typography>
            </Box>
        )
    }

    return (
        <Box ref={containerRef} sx={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{ display: 'block' }}
            >
                <defs>
                    {links.map((l: any, i: number) => {
                        const srcColor =
                            (l.source as SankeyNodeDatum & { x1: number }).color ||
                            theme.palette.primary.main
                        const tgtColor =
                            (l.target as SankeyNodeDatum & { x0: number }).color ||
                            theme.palette.primary.main
                        return (
                            <linearGradient
                                key={`grad-${i}`}
                                id={`flow-grad-${i}`}
                                gradientUnits="userSpaceOnUse"
                                x1={(l.source as any).x1}
                                x2={(l.target as any).x0}
                            >
                                <stop offset="0%" stopColor={srcColor} />
                                <stop offset="100%" stopColor={tgtColor} />
                            </linearGradient>
                        )
                    })}
                </defs>

                <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {/* Links */}
                    <g fill="none">
                        {links.map((l: any, i: number) => {
                            const d = linkPath(l) || ''
                            const isHover = hoveredLinkIdx === i
                            return (
                                <path
                                    key={`link-${i}`}
                                    d={d}
                                    stroke={`url(#flow-grad-${i})`}
                                    strokeOpacity={
                                        hoveredLinkIdx == null ? 0.35 : isHover ? 0.85 : 0.1
                                    }
                                    strokeWidth={Math.max(1, l.width)}
                                    style={{
                                        transition: 'stroke-opacity 120ms',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                        setHoveredLinkIdx(i)
                                        const rect = containerRef.current?.getBoundingClientRect()
                                        setTooltip({
                                            x: e.clientX - (rect?.left ?? 0),
                                            y: e.clientY - (rect?.top ?? 0),
                                            link: l as SankeyLinkDatum,
                                        })
                                    }}
                                    onMouseMove={e => {
                                        const rect = containerRef.current?.getBoundingClientRect()
                                        setTooltip({
                                            x: e.clientX - (rect?.left ?? 0),
                                            y: e.clientY - (rect?.top ?? 0),
                                            link: l as SankeyLinkDatum,
                                        })
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredLinkIdx(null)
                                        setTooltip(null)
                                    }}
                                />
                            )
                        })}
                    </g>

                    {/* Nodes */}
                    <g>
                        {nodes.map((n: any, i: number) => {
                            const h = Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))
                            const w = Math.max(1, (n.x1 ?? 0) - (n.x0 ?? 0))
                            const isLeft = (n as SankeyNodeDatum).side === 'src'
                            const isRight = (n as SankeyNodeDatum).side === 'dst'
                            const isMiddle = !isLeft && !isRight

                            const labelX = isLeft
                                ? (n.x0 ?? 0) - 8
                                : isRight
                                  ? (n.x1 ?? 0) + 8
                                  : (n.x0 ?? 0) + w / 2
                            const labelY = (n.y0 ?? 0) + h / 2
                            const textAnchor = isLeft ? 'end' : isRight ? 'start' : 'middle'

                            return (
                                <g key={`node-${i}`}>
                                    <rect
                                        x={n.x0}
                                        y={n.y0}
                                        width={w}
                                        height={h}
                                        fill={(n as SankeyNodeDatum).color}
                                        stroke={theme.palette.background.paper}
                                        strokeWidth={1}
                                        rx={2}
                                    />
                                    <text
                                        x={labelX}
                                        y={isMiddle ? (n.y0 ?? 0) - 6 : labelY}
                                        dy={isMiddle ? 0 : '0.35em'}
                                        textAnchor={textAnchor}
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            fill: theme.palette.text.primary,
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        {(n as SankeyNodeDatum).label}
                                    </text>
                                </g>
                            )
                        })}
                    </g>
                </g>
            </svg>

            {/* Tooltip */}
            {tooltip && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: Math.min(
                            tooltip.x + 12,
                            (containerRef.current?.clientWidth ?? 0) - 220,
                        ),
                        top: Math.max(8, tooltip.y - 12),
                        pointerEvents: 'none',
                        zIndex: 10,
                        bgcolor: 'background.paper',
                        boxShadow: 6,
                        borderRadius: 1.5,
                        px: 1.5,
                        py: 1,
                        minWidth: 200,
                        border: theme => `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {tooltip.link.route}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                        Volume: <b>{formatUsd(tooltip.link.usd)}</b>
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                        Transfers: <b>{formatCount(tooltip.link.count)}</b>
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                        Avg size:{' '}
                        <b>
                            {tooltip.link.count > 0
                                ? formatUsd(tooltip.link.usd / tooltip.link.count)
                                : '—'}
                        </b>
                    </Typography>
                    {totalValue > 0 && (
                        <Typography variant="caption" display="block" color="text.secondary">
                            {((tooltip.link.value / totalValue) * 100).toFixed(1)}% of total{' '}
                            {unit === 'usd' ? 'volume' : 'count'}
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    )
}

export default FlowSankey
