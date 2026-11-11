import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Bridge Health',
    description:
        'Reliability of the Sui bridge: transfer latency, unclaimed transfers, and why bridge transactions fail.',
    path: '/health',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
