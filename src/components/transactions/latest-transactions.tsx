import { TransactionsTable } from './transactions-table'

export function LatestTransactions() {
    return (
        <>
            <TransactionsTable
                limit={5}
                hidePagination={true}
                showTitleLink={true}
                minHeight={500}
            />
        </>
    )
}
