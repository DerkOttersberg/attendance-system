export type SortDir = 'asc' | 'desc'

export interface AttendanceRecord {
  id?: number
  date?: string
  name: string
  department?: string | null
  product?: string | null
  clock_in?: string | null
  clock_out?: string | null
  status?: string
  work_duration?: number | null
  signature_data?: string | null
}

export interface UserRecord {
  id: number
  rfid_uid: string
  name: string
  email?: string | null
  department?: string | null
  product?: string | null
  points?: number | null
  active?: boolean
}

export interface DepartmentRecord {
  id: number
  name: string
}

export interface ProductRecord {
  id: number
  name: string
}

export interface FloorplanPayload {
  data: unknown
  updated_at?: string | null
}

export interface PointsRecord {
  id: number
  name: string
  department?: string | null
  product?: string | null
  points?: number | null
}

export interface UserPointsResponse {
  user_id: number
  user_name: string
  points: number
}
