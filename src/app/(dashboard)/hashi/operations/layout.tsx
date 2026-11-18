import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Operations',
    description:
        'How Hashi pays out withdrawals: Bitcoin batches, miner fees, signing activity and the committee epochs.',
    path: '/hashi/operations',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
