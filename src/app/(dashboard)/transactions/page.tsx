'use client'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'
import { PageTitle } from 'src/components/page-title'

export default function Page() {
    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Bridge Transactions" />
            <TransactionsTable />
        </DashboardContent>
    )
}
