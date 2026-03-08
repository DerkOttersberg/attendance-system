import 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: number
        role: 'admin' | 'user'
        name: string
        email?: string | null
      }
    }
  }
}

export {}
