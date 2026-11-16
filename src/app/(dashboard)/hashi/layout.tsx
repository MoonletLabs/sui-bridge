import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Bitcoin Analytics',
    description:
        'Analytics for Hashi, the Sui native Bitcoin orchestrator: hBTC supply, BTC backing, deposits, withdrawals and committee concentration.',
    path: '/hashi',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
