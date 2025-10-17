// Simple CSV export utility for client-side downloads
// Safely stringifies nested objects and arrays

type Row = Record<string, any>

const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (/[",\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
}

export const toCsv = (rows: Row[]): string => {
    if (!rows || rows.length === 0) return ''
    const headerSet = new Set<string>()
    rows.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)))
    const headers = Array.from(headerSet)
    const lines = [headers.join(',')]
    rows.forEach(row => {
        const line = headers.map(h => escapeCsvValue(row[h]))
        lines.push(line.join(','))
    })
    return lines.join('\n')
}

export const downloadCsv = (baseName: string, rows: Row[]) => {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const ts = new Date().getTime()
    const filename = `${baseName}-${ts}.csv`
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export default downloadCsv
