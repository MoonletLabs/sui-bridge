import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Governance',
    description:
        'Hashi governance proposals, votes against quorum and how often each operator takes part.',
    path: '/hashi/governance',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
