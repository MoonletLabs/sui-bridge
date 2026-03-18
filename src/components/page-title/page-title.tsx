'use client'

import { useEffect } from 'react'

// ----------------------------------------------------------------------

type PageTitleProps = {
    title: string
}

export function PageTitle({ title }: PageTitleProps) {
    useEffect(() => {
        document.title = `${title} | Sui Analytics`
    }, [title])

    return null
}
