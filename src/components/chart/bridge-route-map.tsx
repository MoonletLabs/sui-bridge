'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
    Card,
    CardHeader,
    Box,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    Stack,
    Skeleton,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import useSWR from 'swr'
import { useGlobalContext } from 'src/provider/global-provider'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { RouteMapRow, getTokensList } from 'src/utils/types'
import { fNumber } from 'src/utils/format-number'

// Dynamic import for Sankey to avoid SSR issues
const ResponsiveSankey = dynamic(() => import('@nivo/sankey').then(mod => mod.ResponsiveSankey), {
    ssr: false,
})

type ValueType = 'usd' | 'count'

// Chain colors - more vibrant
const CHAIN_COLORS: Record<string, string> = {
    SUI: '#4da2ff',
    ETH: '#8c7cf0',
}

// Helper to strip prefix from node ID for display
const getDisplayLabel = (id: string): string => {
    if (id.startsWith('from:')) return id.slice(5)
    if (id.startsWith('to:')) return id.slice(3)
    if (id.startsWith('token:')) return id.slice(6)
    return id
}

// Helper to check if a node matches the highlighted item
const isNodeHighlightMatch = (nodeId: string, highlighted: string): boolean => {
    if (highlighted.startsWith('chain:')) {
        // Highlighting a chain - match both from: and to: nodes for that chain
        const chainName = highlighted.slice(6)
        return nodeId === `from:${chainName}` || nodeId === `to:${chainName}`
    }
    if (highlighted.startsWith('token:')) {
        // Highlighting a token - match the token node
        return nodeId === highlighted
    }
    return false
}

// Helper to check if a link matches the highlighted item
const isLinkHighlightMatch = (source: string, target: string, highlighted: string): boolean => {
    return isNodeHighlightMatch(source, highlighted) || isNodeHighlightMatch(target, highlighted)
}

interface SankeyNode {
    id: string
    nodeColor: string
}

interface SankeyLink {
    source: string
    target: string
    value: number
}

interface SankeyData {
    nodes: SankeyNode[]
    links: SankeyLink[]
}

export default function BridgeRouteMap() {
    const theme = useTheme()
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()
    const [valueType, setValueType] = useState<ValueType>('usd')
    const [highlightedItem, setHighlightedItem] = useState<string | null>(null)

    const tokensList = getTokensList(network)

    // Fetch route data
    const { data, isLoading } = useSWR<RouteMapRow[]>(
        `${endpoints.routes}?network=${network}&timePeriod=${encodeURIComponent(timePeriod)}`,
        fetcher,
        { revalidateOnFocus: false },
    )

    // Filter data by selected tokens
    const filteredData = useMemo(() => {
        if (!data) return []
        if (selectedTokens.includes('All')) return data
        return data.filter(row => selectedTokens.includes(row.token_info.name))
    }, [data, selectedTokens])

    // Build Sankey data structure
    // Structure: Source Chain (left) -> Token -> Destination Chain (right)
    // To avoid circular links, we create separate source/destination chain nodes
    const sankeyData = useMemo((): SankeyData => {
        if (!filteredData.length) {
            return { nodes: [], links: [] }
        }

        const nodesMap = new Map<string, SankeyNode>()
        const linksMap = new Map<string, number>()

        filteredData.forEach(row => {
            // Create separate nodes for source and destination to avoid cycles
            // Source chains are on the left, destination chains on the right
            const sourceNode = `from:${row.from_chain}`
            const tokenNode = `token:${row.token_info.name}`
            const targetNode = `to:${row.destination_chain}`

            // Add source chain node
            if (!nodesMap.has(sourceNode)) {
                nodesMap.set(sourceNode, {
                    id: sourceNode,
                    nodeColor: CHAIN_COLORS[row.from_chain] || '#888888',
                })
            }
            // Add token node
            if (!nodesMap.has(tokenNode)) {
                const tokenColor =
                    tokensList.find(t => t.ticker === row.token_info.name)?.color || '#888888'
                nodesMap.set(tokenNode, { id: tokenNode, nodeColor: tokenColor })
            }
            // Add destination chain node
            if (!nodesMap.has(targetNode)) {
                nodesMap.set(targetNode, {
                    id: targetNode,
                    nodeColor: CHAIN_COLORS[row.destination_chain] || '#888888',
                })
            }

            const value = valueType === 'usd' ? row.total_volume_usd : row.total_count

            // Link: source chain -> token
            const link1Key = `${sourceNode}|${tokenNode}`
            linksMap.set(link1Key, (linksMap.get(link1Key) || 0) + value)

            // Link: token -> destination chain
            const link2Key = `${tokenNode}|${targetNode}`
            linksMap.set(link2Key, (linksMap.get(link2Key) || 0) + value)
        })

        // Build links (filter out zero values)
        const links: SankeyLink[] = Array.from(linksMap.entries())
            .filter(([, value]) => value > 0)
            .map(([key, value]) => {
                const [source, target] = key.split('|')
                return { source, target, value }
            })

        return { nodes: Array.from(nodesMap.values()), links }
    }, [filteredData, valueType, tokensList])

    const handleValueTypeChange = (
        _: React.MouseEvent<HTMLElement>,
        newValue: ValueType | null,
    ) => {
        if (newValue) {
            setValueType(newValue)
        }
    }

    // Check if a node should be highlighted based on legend hover
    const isNodeHighlighted = useCallback(
        (nodeId: string): boolean => {
            if (!highlightedItem) return true
            return isNodeHighlightMatch(nodeId, highlightedItem)
        },
        [highlightedItem],
    )

    // Check if a link should be highlighted based on legend hover
    const isLinkHighlighted = useCallback(
        (source: string, target: string): boolean => {
            if (!highlightedItem) return true
            return isLinkHighlightMatch(source, target, highlightedItem)
        },
        [highlightedItem],
    )

    // Get dynamic opacity for nodes
    const getNodeOpacity = (nodeId: string): number => {
        if (!highlightedItem) return 1
        return isNodeHighlighted(nodeId) ? 1 : 0.15
    }

    // Get dynamic opacity for links
    const getLinkOpacity = (source: string, target: string): number => {
        if (!highlightedItem) return 0.7
        return isLinkHighlighted(source, target) ? 0.85 : 0.08
    }

    const hasData = sankeyData.nodes.length > 0 && sankeyData.links.length > 0

    // Modify sankey data to include opacity based on highlight
    const styledSankeyData = useMemo((): SankeyData => {
        if (!hasData) return sankeyData

        return {
            nodes: sankeyData.nodes.map(node => ({
                ...node,
                nodeColor:
                    highlightedItem && !isNodeHighlighted(node.id)
                        ? alpha(node.nodeColor, 0.15)
                        : node.nodeColor,
            })),
            links: sankeyData.links,
        }
    }, [sankeyData, highlightedItem, hasData, isNodeHighlighted])

    return (
        <Card sx={{ mt: 3 }}>
            <CardHeader
                title="Bridge Route Map"
                subheader="Flow of assets between chains"
                action={
                    <ToggleButtonGroup
                        value={valueType}
                        exclusive
                        onChange={handleValueTypeChange}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 2,
                                py: 0.5,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderRadius: 1,
                                '&.Mui-selected': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.16),
                                    color: theme.palette.primary.main,
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.primary.main, 0.24),
                                    },
                                },
                            },
                        }}
                    >
                        <ToggleButton value="usd">USD Volume</ToggleButton>
                        <ToggleButton value="count">Tx Count</ToggleButton>
                    </ToggleButtonGroup>
                }
            />

            <Box sx={{ p: 3, height: 400 }}>
                {isLoading ? (
                    <Skeleton
                        variant="rectangular"
                        width="100%"
                        height="100%"
                        sx={{ borderRadius: 2 }}
                    />
                ) : !hasData ? (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: theme.palette.text.secondary,
                        }}
                    >
                        <Typography variant="h6">No route data available</Typography>
                        <Typography variant="body2">
                            Try adjusting the time period or token filters
                        </Typography>
                    </Box>
                ) : (
                    <ResponsiveSankey
                        data={styledSankeyData}
                        margin={{ top: 20, right: 160, bottom: 20, left: 50 }}
                        align="justify"
                        colors={node => (node as unknown as SankeyNode).nodeColor || '#888'}
                        nodeOpacity={1}
                        nodeHoverOpacity={1}
                        nodeHoverOthersOpacity={0.2}
                        nodeThickness={20}
                        nodeSpacing={28}
                        nodeBorderWidth={0}
                        nodeBorderRadius={4}
                        linkOpacity={highlightedItem ? 0.08 : 0.7}
                        linkHoverOpacity={0.9}
                        linkHoverOthersOpacity={0.1}
                        linkContract={3}
                        linkBlendMode="normal"
                        enableLinkGradient
                        labelPosition="outside"
                        labelOrientation="horizontal"
                        labelPadding={16}
                        label={node => getDisplayLabel(node.id as string)}
                        labelTextColor={theme.palette.text.primary}
                        nodeTooltip={({ node }) => (
                            <Box
                                sx={{
                                    background: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 1,
                                    px: 1.5,
                                    py: 1,
                                    boxShadow: theme.shadows[8],
                                }}
                            >
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {getDisplayLabel(node.id as string)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {valueType === 'usd'
                                        ? `$${fNumber(node.value)}`
                                        : `${fNumber(node.value)} transactions`}
                                </Typography>
                            </Box>
                        )}
                        linkTooltip={({ link }) => (
                            <Box
                                sx={{
                                    background: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 1,
                                    px: 1.5,
                                    py: 1,
                                    boxShadow: theme.shadows[8],
                                }}
                            >
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {getDisplayLabel(link.source.id as string)} →{' '}
                                    {getDisplayLabel(link.target.id as string)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {valueType === 'usd'
                                        ? `$${fNumber(link.value)}`
                                        : `${fNumber(link.value)} transactions`}
                                </Typography>
                            </Box>
                        )}
                    />
                )}
            </Box>

            {/* Legend with hover interaction */}
            {hasData && (
                <Box sx={{ px: 3, pb: 2 }}>
                    <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        justifyContent="center"
                        alignItems="center"
                    >
                        {/* Chains label */}
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            Chains:
                        </Typography>
                        {/* Chain legend */}
                        {Object.entries(CHAIN_COLORS).map(([chain, color]) => (
                            <Stack
                                key={chain}
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                onMouseEnter={() => setHighlightedItem(`chain:${chain}`)}
                                onMouseLeave={() => setHighlightedItem(null)}
                                sx={{
                                    cursor: 'pointer',
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 1,
                                    transition: 'all 0.2s ease',
                                    backgroundColor:
                                        highlightedItem === `chain:${chain}`
                                            ? alpha(color, 0.15)
                                            : 'transparent',
                                    '&:hover': {
                                        backgroundColor: alpha(color, 0.15),
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        boxShadow:
                                            highlightedItem === `chain:${chain}`
                                                ? `0 0 8px ${color}`
                                                : 'none',
                                        transition: 'box-shadow 0.2s ease',
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight:
                                            highlightedItem === `chain:${chain}` ? 600 : 400,
                                        color:
                                            highlightedItem === `chain:${chain}`
                                                ? theme.palette.text.primary
                                                : theme.palette.text.secondary,
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {chain}
                                </Typography>
                            </Stack>
                        ))}

                        {/* Divider */}
                        <Box
                            sx={{
                                width: '1px',
                                height: 16,
                                backgroundColor: theme.palette.divider,
                                mx: 2,
                            }}
                        />

                        {/* Tokens label */}
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            Tokens:
                        </Typography>
                        {/* Token legend */}
                        {tokensList
                            .filter(
                                token =>
                                    selectedTokens.includes('All') ||
                                    selectedTokens.includes(token.ticker),
                            )
                            .map(token => (
                                <Stack
                                    key={token.ticker}
                                    direction="row"
                                    alignItems="center"
                                    spacing={1}
                                    onMouseEnter={() => setHighlightedItem(`token:${token.ticker}`)}
                                    onMouseLeave={() => setHighlightedItem(null)}
                                    sx={{
                                        cursor: 'pointer',
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: 1,
                                        transition: 'all 0.2s ease',
                                        backgroundColor:
                                            highlightedItem === `token:${token.ticker}`
                                                ? alpha(token.color, 0.15)
                                                : 'transparent',
                                        '&:hover': {
                                            backgroundColor: alpha(token.color, 0.15),
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            backgroundColor: token.color,
                                            boxShadow:
                                                highlightedItem === `token:${token.ticker}`
                                                    ? `0 0 8px ${token.color}`
                                                    : 'none',
                                            transition: 'box-shadow 0.2s ease',
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight:
                                                highlightedItem === `token:${token.ticker}`
                                                    ? 600
                                                    : 400,
                                            color:
                                                highlightedItem === `token:${token.ticker}`
                                                    ? theme.palette.text.primary
                                                    : theme.palette.text.secondary,
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {token.ticker}
                                    </Typography>
                                </Stack>
                            ))}
                    </Stack>
                </Box>
            )}
        </Card>
    )
}
