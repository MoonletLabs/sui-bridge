/** "$7.29M", "-$3.7k", "$412" - compact USD with an explicit sign for negatives */
export function fUsdCompact(value: number, smallDecimals = 0): string {
    if (!Number.isFinite(value)) return '$0'
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
    return `${sign}$${abs.toFixed(smallDecimals)}`
}

/** Percentage change, or null when there is no previous value to compare to */
export function pctChange(current: number, previous: number): number | null {
    if (!previous) return null
    return ((current - previous) / previous) * 100
}
