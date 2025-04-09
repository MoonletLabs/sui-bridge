'use client'
import CumulativeNetInflow from 'src/components/chart/cumulative-net-inflow'
import InflowOutflowCharts from 'src/components/chart/inflow-outflow-charts'
import TokenVolumePieChart from 'src/components/chart/pie-charts'
import StockOfAssetsChart from 'src/components/chart/total-stock-assets'
import CustomWidgets from 'src/components/widgets/custom-widgets'
import { DashboardContent, DashboardLayout } from 'src/layouts/dashboard'

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <DashboardLayout>
            <DashboardContent maxWidth="xl">
                <CustomWidgets />
                <CumulativeNetInflow />
                <InflowOutflowCharts />
                <StockOfAssetsChart />
                <TokenVolumePieChart />
            </DashboardContent>
        </DashboardLayout>
    )
}
