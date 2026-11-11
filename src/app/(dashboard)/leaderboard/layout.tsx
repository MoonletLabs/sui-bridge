import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Leaderboard',
    description: 'The top Sui bridge users ranked by volume and activity.',
    path: '/leaderboard',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
