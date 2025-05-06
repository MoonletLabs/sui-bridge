'use client'
import BridgePerformanceChart from 'src/components/chart/bridge-performance-chart'
import CumulativeNetInflow from 'src/components/chart/cumulative-net-inflow'
import InflowOutflowCharts from 'src/components/chart/inflow-outflow-charts'
import TokenVolumePieChart from 'src/components/chart/pie-charts'
// import StockOfAssetsChart from 'src/components/chart/total-stock-assets'
import { LatestTransactions } from 'src/components/transactions/latest-transactions'
import CustomWidgets from 'src/components/widgets/custom-widgets'
import { DashboardContent, DashboardLayout } from 'src/layouts/dashboard'

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <DashboardLayout>
            <DashboardContent maxWidth="xl">
                <CustomWidgets />
                <CumulativeNetInflow />
                <BridgePerformanceChart />
                <LatestTransactions />
                <InflowOutflowCharts />
                {/* <StockOfAssetsChart /> */}
                <TokenVolumePieChart />
            </DashboardContent>
        </DashboardLayout>
    )
}
