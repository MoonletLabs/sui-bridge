'use client'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'

export default function Page() {
    return (
        <DashboardContent maxWidth="xl">
            <TransactionsTable />
        </DashboardContent>
    )
}
