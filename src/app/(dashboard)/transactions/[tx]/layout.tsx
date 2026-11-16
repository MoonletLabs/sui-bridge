import type { Metadata } from 'next'
import { pageMetadata } from 'src/utils/seo'

export function generateMetadata({ params }: { params: { tx: string } }): Metadata {
    return pageMetadata({
        title: 'Transaction Details',
        description: 'Status, timeline, amounts and addresses for a single Sui bridge transfer.',
        path: `/transactions/${encodeURIComponent(params.tx)}`,
        // One near-identical, client-rendered page per transfer: thousands of thin pages
        // that Google crawls but never indexes. The /transactions list is what should rank.
        noindex: true,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
