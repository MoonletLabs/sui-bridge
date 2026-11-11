import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Bridge Flows',
    description: 'Where value moves between Ethereum and Sui: bridge flows by token and chain.',
    path: '/flows',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
