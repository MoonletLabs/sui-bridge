'use client'
import { CardProps } from '@mui/material'
import { type ChartOptions } from 'src/components/chart'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'

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
            <TransactionsTable />
        </DashboardContent>
    )
}
