import type {
  AttendanceRecord,
  AuthUser,
  DepartmentRecord,
  FloorplanPayload,
  ProductRecord,
  UserPointsResponse,
  UserRecord
} from '../types'

type LoginResponse =
  | { user: AuthUser }
  | { requires2fa: true; request_id: string }
  | { requires2faSetup: true; request_id: string; otpauth_url: string; qr_data_url: string }

const envApiBase = process.env.NEXT_PUBLIC_API_BASE
const shouldUseEnv = envApiBase && !envApiBase.includes('localhost')
const API_BASE = shouldUseEnv
  ? envApiBase
  : typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : envApiBase ?? 'http://localhost:5000'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, credentials: 'include' })
  if (!response.ok) {
    let message = 'Request failed'
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const payload = (await response.json()) as { detail?: string; message?: string }
        message = payload.detail ?? payload.message ?? message
      } catch {
        message = 'Request failed'
      }
    } else {
      const text = await response.text()
      message = text || message
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export const api = {
  async fetchStats() {
    const [todayData, usersData] = await Promise.all([
      request<AttendanceRecord[]>(`${API_BASE}/api/attendance/today`),
      request<UserRecord[]>(`${API_BASE}/api/users`)
    ])

    return { todayData, usersData }
  },

  async login(payload: { identifier: string; password: string }) {
    return request<LoginResponse>(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  },

  async verifyAdmin2fa(payload: { request_id: string; code: string }) {
    return request<{ user: AuthUser }>(`${API_BASE}/api/auth/admin-2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  },

  async logout() {
    return request(`${API_BASE}/api/auth/logout`, { method: 'POST' })
  },

  async me() {
    return request<{ user: AuthUser }>(`${API_BASE}/api/auth/me`)
  },

  async fetchTodayAttendance() {
    return request<AttendanceRecord[]>(`${API_BASE}/api/attendance/today`)
  },

  async fetchAllAttendance() {
    return request<AttendanceRecord[]>(`${API_BASE}/api/attendance/all`)
  },

  async fetchUsers() {
    return request<UserRecord[]>(`${API_BASE}/api/users`)
  },

  async setUserPoints(userId: number, points: number) {
    return request(`${API_BASE}/api/points/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    })
  },

  async fetchUserPoints(userId: number) {
    return request<UserPointsResponse>(`${API_BASE}/api/user-points/id/${userId}`)
  },

  async fetchMyPoints() {
    return request<UserPointsResponse>(`${API_BASE}/api/points/me`)
  },

  async fetchFloorplan() {
    return request<FloorplanPayload>(`${API_BASE}/api/floorplan`)
  },

  async saveFloorplan(data: unknown) {
    return request(`${API_BASE}/api/floorplan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  },

  async fetchFilteredAttendance(params: {
    user_id?: string
    department?: string
    start_date?: string
    end_date?: string
    product?: string
  }) {
    const query = new URLSearchParams()
    if (params.user_id) query.set('user_id', params.user_id)
    if (params.department) query.set('department', params.department)
    if (params.start_date) query.set('start_date', params.start_date)
    if (params.end_date) query.set('end_date', params.end_date)
    if (params.product) query.set('product', params.product)

    return request<AttendanceRecord[]>(`${API_BASE}/api/attendance/filter?${query.toString()}`)
  },

  async createUser(payload: { rfid_uid: string; name: string; email?: string | null; password?: string | null }) {
    return request(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  },

  async deleteUsers(ids: number[]) {
    return request(`${API_BASE}/api/users`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  },

  async fetchDepartments() {
    return request<DepartmentRecord[]>(`${API_BASE}/api/departments`)
  },

  async createDepartment(name: string) {
    return request(`${API_BASE}/api/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
  },

  async deleteDepartment(id: number) {
    return request(`${API_BASE}/api/departments/${id}`, { method: 'DELETE' })
  },

  async fetchProducts() {
    return request<ProductRecord[]>(`${API_BASE}/api/products`)
  },

  async createProduct(name: string) {
    return request(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
  },

  async deleteProduct(id: number) {
    return request(`${API_BASE}/api/products/${id}`, { method: 'DELETE' })
  },

  async updateUserDepartment(userId: number, department: string | null) {
    return request(`${API_BASE}/api/users/${userId}/department`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department })
    })
  },

  async updateUserProduct(userId: number, product: string | null) {
    return request(`${API_BASE}/api/users/${userId}/product`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product })
    })
  },

  async updateUserUid(userId: number, rfid_uid: string) {
    return request(`${API_BASE}/api/users/${userId}/uid`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid_uid })
    })
  },

  async updateUser(userId: number, fields: Record<string, unknown>) {
    return request(`${API_BASE}/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
  },

  async updateUserPassword(userId: number, password: string) {
    return request(`${API_BASE}/api/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
  },

  async createManualAttendance(payload: {
    user_id: number
    date: string
    clock_in: string
    clock_out?: string | null
    signature_data: string
  }) {
    return request(`${API_BASE}/api/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  },

  async deleteAttendanceRecords(ids: number[]) {
    return request(`${API_BASE}/api/attendance/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  }
}
