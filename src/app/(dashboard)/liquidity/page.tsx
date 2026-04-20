'use client'

import { Box, Grid, Typography } from '@mui/material'
import ReservesDonut from 'src/components/chart/reserves-donut'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import CurrentReservesTable from 'src/components/widgets/current-reserves-table'
import LiquidityKpiCards from 'src/components/widgets/liquidity-kpi-cards'
import { DashboardContent } from 'src/layouts/dashboard'

export default function LiquidityPage() {
    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Bridge Liquidity" />

            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:wallet-money-bold-duotone"
                        width={28}
                        sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="h4">Bridge Liquidity</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Current snapshot of assets locked on the bridge — per-token reserves,
                    composition and short-term change. For historical evolution see the Cumulative
                    Net Inflow chart on the Bridge Dashboard.
                </Typography>
            </Box>

            <LiquidityKpiCards />

            <Grid
                container
                spacing={3}
                alignItems="stretch"
                // CustomTable has a built-in `mt: 4` on its inner Card. Zero it
                // at the row level (descendant match) so Current Reserves sits
                // flush with Reserves Composition.
                sx={{ mt: 0, '& .MuiCard-root': { mt: 0 } }}
            >
                <Grid item xs={12} md={8} sx={{ display: 'flex' }}>
                    <Box sx={{ width: '100%' }}>
                        <CurrentReservesTable />
                    </Box>
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                    <Box sx={{ width: '100%' }}>
                        <ReservesDonut />
                    </Box>
                </Grid>
            </Grid>
        </DashboardContent>
    )
}
