import { AuthSplitLayout } from 'src/layouts/auth-split'

import { GuestGuard } from 'src/auth/guard'

// ----------------------------------------------------------------------

export const metadata = { robots: { index: false, follow: false } }

type Props = {
    children: React.ReactNode
}

export default function Layout({ children }: Props) {
    return (
        <GuestGuard>
            <AuthSplitLayout section={{ title: 'Hi, Welcome back' }}>{children}</AuthSplitLayout>
        </GuestGuard>
    )
}
