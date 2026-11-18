import { pageMetadata } from 'src/utils/seo'

export const metadata = pageMetadata({
    title: 'Hashi Committee',
    description:
        "The operators that hold Hashi's Bitcoin: voting weight, concentration and how it changes by epoch.",
    path: '/hashi/committee',
})

export default function Layout({ children }: { children: React.ReactNode }) {
    return children
}
