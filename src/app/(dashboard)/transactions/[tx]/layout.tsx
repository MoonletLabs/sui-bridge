import type { Metadata } from 'next'
import { pageMetadata } from 'src/utils/seo'

export function generateMetadata({ params }: { params: { tx: string } }): Metadata {
    return pageMetadata({
        title: 'Transaction Details',
        description: 'Status, timeline, amounts and addresses for a single Sui bridge transfer.',
        path: `/transactions/${encodeURIComponent(params.tx)}`,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
