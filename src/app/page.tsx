'use client'
import { Suspense, lazy } from 'react'
import { ChartSkeleton, VisibilityChart } from 'src/components/skeletons'
import { LatestTransactions } from 'src/components/transactions/latest-transactions'
import CustomWidgets from 'src/components/widgets/custom-widgets'
import { DashboardContent, DashboardLayout } from 'src/layouts/dashboard'

// Lazy load chart components for better performance
const InflowOutflowCharts = lazy(() => import('src/components/chart/inflow-outflow-charts'))
const TokenVolumePieChart = lazy(() => import('src/components/chart/pie-charts'))
const GasUsageChart = lazy(() => import('src/components/chart/gas-usage-chart'))
import BridgePerformanceChart from 'src/components/chart/bridge-performance-chart'
import CumulativeNetInflow from 'src/components/chart/cumulative-net-inflow'
import TopTokens from 'src/components/widgets/top-tokens'

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <DashboardLayout>
            <DashboardContent maxWidth="xl">
                <CustomWidgets />

                <CumulativeNetInflow />
                <BridgePerformanceChart />
                <TopTokens />

                {/* Latest Transactions - also use visibility system */}
                <VisibilityChart fallback={<ChartSkeleton title="Latest Transactions" />}>
                    <LatestTransactions />
                </VisibilityChart>

                {/* Bottom charts - render only when visible */}
                <VisibilityChart fallback={<ChartSkeleton title="Inflow/Outflow Charts" />}>
                    <InflowOutflowCharts />
                </VisibilityChart>

                <VisibilityChart fallback={<ChartSkeleton title="Gas Usage" />}>
                    <GasUsageChart />
                </VisibilityChart>

                {/* <VisibilityChart fallback={<ChartSkeleton title="Token Volume" />}> */}
                <TokenVolumePieChart />
                {/* </VisibilityChart> */}
            </DashboardContent>
        </DashboardLayout>
    )
}
