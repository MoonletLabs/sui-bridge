import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Tokens',
    description:
        'Per-token bridge volume, trends and transfer sizes for every asset on the Sui bridge.',
    path: '/tokens',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
