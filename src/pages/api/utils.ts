import { NextApiResponse } from 'next'

export const sendReply = async (res: NextApiResponse, data: any, code = 200) =>
    res.status(code || 200).json(data)

/**
 * Only integer codes in the HTTP status range are valid statuses. Driver errors
 * (e.g. Postgres `22P02`) carry string codes - passing those to `res.status`
 * throws ERR_HTTP_INVALID_STATUS_CODE and leaves the request hanging forever.
 */
export const toHttpStatus = (code: unknown): number => {
    const n = typeof code === 'number' ? code : NaN
    return Number.isInteger(n) && n >= 400 && n <= 599 ? n : 500
}

export const sendError = async (res: NextApiResponse, error?: any) => {
    const status = toHttpStatus(error?.code)
    // Don't leak driver/internal messages on server errors
    const message =
        status === 500 && typeof error?.code === 'string'
            ? 'Something went wrong!'
            : error?.message || 'Something went wrong!'
    return res.status(status).json({ code: status, message })
}

/** Parse a non-negative integer query param, falling back to `def` and clamping to `max`. */
export const parseIntParam = (
    value: string | string[] | undefined,
    def: number,
    max = Number.MAX_SAFE_INTEGER,
): number => {
    const n = Number(Array.isArray(value) ? value[0] : value)
    if (!Number.isFinite(n) || n < 0) return def
    return Math.min(Math.floor(n), max)
}
