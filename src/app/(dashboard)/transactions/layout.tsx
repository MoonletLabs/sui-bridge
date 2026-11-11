import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Bridge Transactions',
    description:
        'Every Sui bridge transfer, searchable and filterable by token, direction, status and address.',
    path: '/transactions',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
