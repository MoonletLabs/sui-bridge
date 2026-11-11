/**
 * One tooltip layout for every chart.
 *
 * ApexCharts lets a chart supply its own tooltip HTML (`tooltip.custom`).
 * Every chart in the app builds that HTML here so they all look the same, and
 * the surrounding frame (background, border, radius, shadow) comes from
 * `components/chart/styles.css`, which also styles ApexCharts' built-in
 * tooltips - so charts without a custom tooltip match too.
 *
 * Colours are theme CSS variables, so this works in light and dark mode.
 */

export type TooltipRow = {
    label: string
    /** Series colour, shown as a dot */
    color: string
    /** Main value, already formatted */
    value: string
    /** Smaller, lighter text after the value (e.g. the USD amount next to a token amount) */
    secondary?: string
    /** Overrides the value colour, e.g. red for negatives */
    valueColor?: string
}

export type TooltipOptions = {
    title: string
    rows: TooltipRow[]
    /** Optional summary row shown below a divider */
    total?: { label: string; value: string; valueColor?: string }
}

export const NEGATIVE_COLOR = '#FF5630'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const DIVIDER = '1px solid rgba(var(--palette-grey-500Channel) / 0.16)'

export function renderTooltip({ title, rows, total }: TooltipOptions): string {
    const rowsHtml = rows
        .map(
            r => `
            <div style="display:flex;align-items:center;gap:8px;padding:4px 12px;">
                <span style="width:8px;height:8px;border-radius:50%;flex:none;background:${r.color};"></span>
                <span style="color:var(--palette-text-secondary);">${escapeHtml(r.label)}</span>
                <span style="margin-left:auto;padding-left:16px;font-weight:600;white-space:nowrap;${
                    r.valueColor ? `color:${r.valueColor};` : 'color:var(--palette-text-primary);'
                }">${r.value}${
                    r.secondary
                        ? `<span style="margin-left:6px;font-size:11px;font-weight:400;color:${
                              r.valueColor || 'var(--palette-text-disabled)'
                          };">${r.secondary}</span>`
                        : ''
                }</span>
            </div>`,
        )
        .join('')

    const totalHtml = total
        ? `<div style="display:flex;align-items:center;margin-top:4px;padding:8px 12px 4px;border-top:${DIVIDER};">
               <span style="font-weight:700;color:var(--palette-text-primary);">${escapeHtml(total.label)}</span>
               <span style="margin-left:auto;padding-left:16px;font-weight:700;color:${
                   total.valueColor || 'var(--palette-text-primary)'
               };">${total.value}</span>
           </div>`
        : ''

    return `
        <div style="min-width:160px;font-size:12px;padding-bottom:8px;">
            <div style="padding:8px 12px;margin-bottom:4px;font-weight:700;color:var(--palette-text-secondary);background:rgba(var(--palette-grey-500Channel) / 0.08);border-bottom:${DIVIDER};">${escapeHtml(title)}</div>
            ${rowsHtml}
            ${totalHtml}
        </div>`
}
