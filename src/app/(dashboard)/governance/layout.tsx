import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Bridge Governance',
    description:
        'Sui bridge transfer limits with 24h utilization, plus every committee action: limit changes, emergency pauses and token listings.',
    path: '/governance',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
