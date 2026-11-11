import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Address Profile',
    description: 'Bridge activity and transfer history for a single address.',
    path: '/profile',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
