import { NextApiResponse } from 'next'

export const sendReply = async (res: NextApiResponse, data: any, code = 200) =>
    res.status(code || 200).json(data)

export const sendError = async (res: NextApiResponse, error?: any) =>
    res.status(error?.code || 500).json({
        code: error?.code, // || code
        message: error?.message || 'Something went wrong!',
    })
