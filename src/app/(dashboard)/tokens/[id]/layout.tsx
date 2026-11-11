import type { Metadata } from 'next'
import { pageMetadata } from 'src/utils/seo'

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
    const id = encodeURIComponent(params.id)
    return pageMetadata({
        title: `Token #${params.id}`,
        description: `Bridge volume, inflows and outflows, top senders and latest transfers for token #${params.id} on the Sui bridge.`,
        path: `/tokens/${id}`,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
