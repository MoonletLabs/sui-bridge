/**
 * Which of the global filters (time period, token selection) each page
 * actually reads. The header only shows a filter on pages where it changes
 * something, so people never adjust a control that does nothing.
 *
 * Pages not listed here (Transactions, Health, Governance, Profile) have
 * their own filters or none.
 */
export type PageFilters = { period: boolean; tokens: boolean }

const NONE: PageFilters = { period: false, tokens: false }

export function getPageFilters(pathname: string | null): PageFilters {
    if (!pathname) return NONE
    if (pathname === '/') return { period: true, tokens: true }
    if (pathname.startsWith('/flows')) return { period: true, tokens: true }
    // Token pages are already per token: only the period applies
    if (pathname.startsWith('/tokens')) return { period: true, tokens: false }
    if (pathname.startsWith('/leaderboard')) return { period: true, tokens: false }
    return NONE
}
