import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Deposits and Withdrawals',
    description:
        'Daily Hashi deposit and withdrawal volume, how long they take, and the latest requests.',
    path: '/hashi/activity',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
