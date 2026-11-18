import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Health',
    description:
        'Is Hashi healthy? Pause and reconfiguration state, delayed deposits and withdrawals, and how many request transactions fail.',
    path: '/hashi/health',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
