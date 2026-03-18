'use client'
import { TransactionView } from 'src/components/transactions/transaction-view'
import { DashboardContent } from 'src/layouts/dashboard'
import { NotFoundView } from 'src/sections/error'
import { PageTitle } from 'src/components/page-title'

interface PageProps {
    params: {
        tx: string
    }
}

export default function Page({ params: { tx } }: PageProps) {
    if (!tx) {
        return <NotFoundView />
    }

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Transaction Details" />
            <TransactionView tx={tx} />
        </DashboardContent>
    )
}
