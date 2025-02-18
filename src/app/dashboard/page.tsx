'use client'
import { type ChartOptions } from 'src/components/chart'
import { CardProps } from '@mui/material'
import { DashboardContent } from 'src/layouts/dashboard'
import CustomWidgets from 'src/components/widgets/custom-widgets'
import InflowOutflowCharts from 'src/components/chart/inflow-outflow-charts'
import TokenVolumePieChart from 'src/components/chart/pie-charts'
import StockOfAssetsChart from 'src/components/chart/total-stock-assets'

type Props = CardProps & {
    title?: string
    subheader?: string
    chart: {
        colors?: string[]
        series: {
            name: string
            categories?: string[]
            data: {
                name: string
                data: number[]
            }[]
        }[]
        options?: ChartOptions
    }
}

export default function Page() {
    return (
        <DashboardContent maxWidth="xl">
            <CustomWidgets />
            <InflowOutflowCharts />
            <StockOfAssetsChart />
            <TokenVolumePieChart />
        </DashboardContent>
    )
}
