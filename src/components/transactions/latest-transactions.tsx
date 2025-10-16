import { useTransactionsAutoRefresh } from 'src/hooks/use-transactions-auto-refresh'
import { TransactionsTable } from './transactions-table'

export function LatestTransactions() {
    // Custom hook for auto-refresh every 15 seconds
    const { forceRefresh } = useTransactionsAutoRefresh(30000)

    return (
        <>
            <TransactionsTable
                limit={5}
                autoRefresh={forceRefresh}
                hidePagination={true}
                showTitleLink={true}
                minHeight={500}
            />
        </>
    )
}
