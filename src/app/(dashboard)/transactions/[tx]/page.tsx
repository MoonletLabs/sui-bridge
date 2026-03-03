'use client'
import { TransactionView } from 'src/components/transactions/transaction-view'
import { DashboardContent } from 'src/layouts/dashboard'
import { NotFoundView } from 'src/sections/error'

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
            <TransactionView tx={tx} />
        </DashboardContent>
    )
}
