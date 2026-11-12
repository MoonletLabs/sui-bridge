'use client'

import { m, useReducedMotion } from 'framer-motion'

// ----------------------------------------------------------------------

/**
 * A template (unlike a layout) is re-created on every navigation between
 * dashboard sections, so each page fades in instead of snapping into place. The
 * header and navigation live in the layout and stay put.
 *
 * The fade is deliberately gentle: the previous page disappears the moment the
 * next one is ready, so a short fade reads as a snap. Starting from a slightly
 * visible page (not from 0) avoids a dip to an empty screen, and the long soft
 * ease-in-out hides the swap.
 */
export default function Template({ children }: { children: React.ReactNode }) {
    const reduceMotion = useReducedMotion()

    return (
        <m.div
            initial={reduceMotion ? false : { opacity: 0.15 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.45, 0, 0.25, 1] }}
        >
            {children}
        </m.div>
    )
}
