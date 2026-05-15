'use client'

import { Box, Card, Stack, Typography } from '@mui/material'
import useSWR from 'swr'
import { PageTitle } from 'src/components/page-title'
import {
    TokenOverview,
    TokenVolumeChart,
    TokenTopHolders,
    TokenSizeHistogram,
} from 'src/components/token'
import { DashboardContent } from 'src/layouts/dashboard'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { NotFoundView } from 'src/sections/error'
import { endpoints, fetcher } from 'src/utils/axios'
import { getTokenMeta } from 'src/utils/token-meta'
import type { TokenOverviewResponse } from 'src/pages/api/token/[id]/overview'

interface PageProps {
    params: { id: string }
}

export default function TokenDetailPage({ params: { id } }: PageProps) {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()

    const numericId = Number(id)
    const meta = getTokenMeta(network, numericId)

    const url = Number.isFinite(numericId)
        ? `${endpoints.token.overview(numericId)}?network=${network}&period=${encodeURIComponent(
              timePeriod,
          )}`
        : null

    const { data, isLoading } = useSWR<TokenOverviewResponse>(url, fetcher, {
        revalidateOnFocus: false,
    })

    if (!Number.isFinite(numericId) || !meta) {
        return <NotFoundView />
    }

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title={`${meta.ticker} · Token`} />

            {/* Header */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: meta.color,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 20,
                        overflow: 'hidden',
                    }}
                >
                    {meta.icon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={meta.icon}
                            alt={meta.ticker}
                            width={36}
                            height={36}
                            style={{ objectFit: 'contain' }}
                        />
                    ) : (
                        meta.ticker.slice(0, 2).toUpperCase()
                    )}
                </Box>
                <Box>
                    <Typography variant="h4" sx={{ lineHeight: 1.1 }}>
                        {meta.ticker}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {meta.name} · Token #{meta.id} · {meta.decimals.toFixed(0)} decimals
                    </Typography>
                </Box>
            </Stack>

            {/* Stat tiles */}
            <TokenOverview data={data} isLoading={isLoading} />

            {/* Inflow / outflow chart */}
            <TokenVolumeChart tokenId={numericId} tokenColor={meta.color} />

            {/* Holders & size distribution side-by-side on desktop */}
            <TokenTopHolders tokenId={numericId} />
            <TokenSizeHistogram tokenId={numericId} tokenColor={meta.color} />

            {!isLoading && data && data.totals.total_tx_count === 0 && (
                <Card sx={{ mt: 3, p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        No bridge activity for {meta.ticker} in the selected period.
                    </Typography>
                </Card>
            )}
        </DashboardContent>
    )
}
