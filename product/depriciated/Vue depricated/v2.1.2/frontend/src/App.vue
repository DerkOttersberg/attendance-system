<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { api } from './services/api'
import { generateFloorplanPDF, generatePDFWithLayout } from './services/export'
import { ensureLegacyFloorplanLoaded } from './services/legacy-floorplan'
import type { AttendanceRecord, DepartmentRecord, ProductRecord, UserRecord } from './types'

type AttendanceSortKey = 'name' | 'department' | 'clock_in' | 'clock_out' | 'duration' | 'date'
type UserSortKey = 'id' | 'name' | 'department'
type SortState = {
  today: { key: AttendanceSortKey; dir: 'asc' | 'desc' }
  all: { key: AttendanceSortKey; dir: 'asc' | 'desc' }
  users: { key: UserSortKey; dir: 'asc' | 'desc' }
}

const activeTab = ref<'today' | 'all' | 'users' | 'floorplan'>('today')
const filtersOpen = ref(true)

const state = reactive({
  today: [] as AttendanceRecord[],
  all: [] as AttendanceRecord[],
  filtered: [] as AttendanceRecord[],
  users: [] as UserRecord[],
  departments: [] as DepartmentRecord[],
  products: [] as ProductRecord[],
  search: {
    today: '',
    all: '',
    users: ''
  },
  sort: {
    today: { key: 'name' as AttendanceSortKey, dir: 'asc' },
    all: { key: 'date' as AttendanceSortKey, dir: 'desc' },
    users: { key: 'name' as UserSortKey, dir: 'asc' }
  } as SortState,
  filters: {
    userId: '',
    department: '',
    startDate: '',
    endDate: '',
    product: ''
  }
})

const selectedAttendanceIds = ref(new Set<number>())
const selectedUserIds = ref(new Set<number>())
const pointsDraft = reactive<Record<number, number>>({})

const userEdit = reactive({
  id: null as number | null,
  field: null as 'name' | 'rfid_uid' | null,
  value: ''
})

const signatureModal = reactive({
  open: false,
  svg: '',
  name: ''
})

const addUserModal = reactive({
  open: false,
  uid: '',
  name: '',
  email: '',
  error: ''
})

const departmentsModal = reactive({
  open: false,
  list: [] as DepartmentRecord[],
  name: '',
  error: ''
})

const productsModal = reactive({
  open: false,
  list: [] as ProductRecord[],
  name: '',
  error: ''
})

const manualModal = reactive({
  open: false,
  userId: '',
  date: '',
  clockIn: '',
  clockOut: '',
  message: '',
  isError: false
})

const manualPoints = reactive({
  visible: false,
  current: 0,
  earned: 0,
  total: 0
})

const signatureCanvas = ref<HTMLCanvasElement | null>(null)
let signatureContext: CanvasRenderingContext2D | null = null
let isDrawing = false

const stats = computed(() => {
  const clockedIn = state.today.filter((r) => r.status === 'clocked_in').length
  const clockedOut = state.today.filter((r) => r.status === 'clocked_out').length
  const totalUsers = state.users.filter((u) => u.active !== false).length

  return {
    totalUsers,
    clockedIn,
    clockedOut,
    totalToday: state.today.length
  }
})

const todayRows = computed<AttendanceRecord[]>(() => sortAttendanceRows(state.today, state.search.today, state.sort.today))
const allRows = computed<AttendanceRecord[]>(() => sortAttendanceRows(state.filtered, state.search.all, state.sort.all))
const usersRows = computed<UserRecord[]>(() => sortUserRows(state.users, state.search.users, state.sort.users))

const attendanceSelectedCount = computed(() => selectedAttendanceIds.value.size)
const usersSelectedCount = computed(() => selectedUserIds.value.size)

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(minutes?: number | null) {
  if (!minutes && minutes !== 0) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function prepareSVG(svgString?: string | null) {
  if (!svgString) return ''
  return svgString.replace(/<svg/, '<svg viewBox="0 0 550 270" preserveAspectRatio="xMidYMid meet"')
}

function compareValues(a: unknown, b: unknown, dir: 'asc' | 'desc') {
  if (a === b) return 0
  if (a === null || a === undefined) return dir === 'asc' ? 1 : -1
  if (b === null || b === undefined) return dir === 'asc' ? -1 : 1
  if (typeof a === 'number' && typeof b === 'number') return dir === 'asc' ? a - b : b - a
  const textA = String(a).toLowerCase()
  const textB = String(b).toLowerCase()
  if (textA < textB) return dir === 'asc' ? -1 : 1
  if (textA > textB) return dir === 'asc' ? 1 : -1
  return 0
}

function applySearch<T>(items: T[], query: string, getText: (item: T) => string) {
  if (!query) return items
  const normalized = query.toLowerCase()
  return items.filter((item) => getText(item).toLowerCase().includes(normalized))
}

function sortAttendanceRows(items: AttendanceRecord[], query: string, sort: SortState['today']) {
  let data = applySearch([...items], query, (item) => item.name || '')
  data.sort((a, b) => {
    switch (sort.key) {
      case 'duration':
        return compareValues(a.work_duration, b.work_duration, sort.dir)
      case 'clock_in':
        return compareValues(new Date(String(a.clock_in || 0)).getTime(), new Date(String(b.clock_in || 0)).getTime(), sort.dir)
      case 'clock_out':
        return compareValues(new Date(String(a.clock_out || 0)).getTime(), new Date(String(b.clock_out || 0)).getTime(), sort.dir)
      case 'date':
        return compareValues(new Date(String(a.date || 0)).getTime(), new Date(String(b.date || 0)).getTime(), sort.dir)
      case 'department':
        return compareValues(a.department, b.department, sort.dir)
      case 'name':
      default:
        return compareValues(a.name, b.name, sort.dir)
    }
  })
  return data
}

function sortUserRows(items: UserRecord[], query: string, sort: SortState['users']) {
  let data = applySearch([...items], query, (item) => item.name || '')
  data.sort((a, b) => {
    switch (sort.key) {
      case 'id':
        return compareValues(a.id, b.id, sort.dir)
      case 'department':
        return compareValues(a.department, b.department, sort.dir)
      case 'name':
      default:
        return compareValues(a.name, b.name, sort.dir)
    }
  })
  return data
}

function updateSort<T extends keyof SortState>(table: T, key: SortState[T]['key']) {
  const current = state.sort[table]
  const nextDir: 'asc' | 'desc' = current.key === key && current.dir === 'asc' ? 'desc' : 'asc'
  state.sort[table] = { key, dir: nextDir } as SortState[T]
}

function getPeriodText() {
  const { startDate, endDate } = state.filters
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).toLocaleDateString('nl-NL') : 'Beginning'
    const end = endDate ? new Date(endDate).toLocaleDateString('nl-NL') : 'Today'
    return `${start} / ${end}`
  }
  return 'All Time'
}

async function loadStats() {
  const { todayData, usersData } = await api.fetchStats()
  state.today = todayData
  state.users = usersData
}

async function loadTodayAttendance() {
  state.today = await api.fetchTodayAttendance()
}

async function loadAllAttendance() {
  state.all = await api.fetchAllAttendance()
  state.filtered = [...state.all]
}

async function loadUsers() {
  const [users, departments, products] = await Promise.all([
    api.fetchUsers(),
    api.fetchDepartments(),
    api.fetchProducts()
  ])
  state.users = users
  state.departments = departments
  state.products = products
  state.users.forEach((user) => {
    pointsDraft[user.id] = user.points ?? 0
  })

  window.State = window.State ?? {}
  window.State.allUsers = users
}

function startUserEdit(user: UserRecord, field: 'name' | 'rfid_uid') {
  userEdit.id = user.id
  userEdit.field = field
  userEdit.value = field === 'name' ? user.name : user.rfid_uid
}

function isEditingUser(user: UserRecord, field: 'name' | 'rfid_uid') {
  return userEdit.id === user.id && userEdit.field === field
}

function cancelUserEdit() {
  userEdit.id = null
  userEdit.field = null
  userEdit.value = ''
}

async function commitUserEdit(user: UserRecord) {
  if (!userEdit.field) return
  const nextValue = userEdit.value.trim()
  if (!nextValue) {
    cancelUserEdit()
    return
  }

  try {
    if (userEdit.field === 'name') {
      if (nextValue !== user.name) {
        await api.updateUser(user.id, { name: nextValue })
      }
    } else {
      const nextUid = nextValue.toUpperCase()
      if (nextUid !== user.rfid_uid) {
        await api.updateUserUid(user.id, nextUid)
      }
    }
    await loadUsers()
  } finally {
    cancelUserEdit()
  }
}

async function loadAllData() {
  await Promise.all([loadStats(), loadTodayAttendance(), loadUsers(), loadAllAttendance()])
}

async function applyFilters() {
  state.filtered = await api.fetchFilteredAttendance({
    user_id: state.filters.userId || undefined,
    department: state.filters.department || undefined,
    start_date: state.filters.startDate || undefined,
    end_date: state.filters.endDate || undefined,
    product: state.filters.product || undefined
  })
  selectedAttendanceIds.value = new Set()
}

function clearFilters() {
  state.filters.userId = ''
  state.filters.department = ''
  state.filters.startDate = ''
  state.filters.endDate = ''
  state.filters.product = ''
  state.filtered = [...state.all]
  selectedAttendanceIds.value = new Set()
}

function toggleAttendanceSelection(id: number) {
  const set = new Set(selectedAttendanceIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedAttendanceIds.value = set
}

function toggleAllAttendanceSelection(checked: boolean) {
  const set = new Set<number>()
  if (checked) {
    state.filtered.forEach((record) => {
      if (record.id !== undefined) set.add(record.id)
    })
  }
  selectedAttendanceIds.value = set
}

async function deleteSelectedAttendance() {
  if (selectedAttendanceIds.value.size === 0) return
  if (!confirm(`Delete ${selectedAttendanceIds.value.size} attendance record(s)?`)) return
  await api.deleteAttendanceRecords(Array.from(selectedAttendanceIds.value))
  await loadAllAttendance()
  selectedAttendanceIds.value = new Set()
}

async function exportSelectedAttendance() {
  if (selectedAttendanceIds.value.size === 0) return
  const selected = state.filtered.filter((record) => record.id && selectedAttendanceIds.value.has(record.id))
  await generatePDFWithLayout(selected, getPeriodText(), 'Selected_Records')
}

async function exportAllAttendance() {
  if (state.filtered.length === 0) return
  await generatePDFWithLayout(state.filtered, getPeriodText())
}

function toggleUserSelection(id: number) {
  const set = new Set(selectedUserIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedUserIds.value = set
}

function toggleAllUserSelection(checked: boolean) {
  const set = new Set<number>()
  if (checked) {
    state.users.forEach((user) => set.add(user.id))
  }
  selectedUserIds.value = set
}

async function deleteSelectedUsers() {
  if (selectedUserIds.value.size === 0) return
  if (!confirm(`Delete ${selectedUserIds.value.size} selected user(s)?`)) return
  await api.deleteUsers(Array.from(selectedUserIds.value))
  selectedUserIds.value = new Set()
  await loadUsers()
}

function openSignatureModal(svg: string, name: string) {
  signatureModal.open = true
  signatureModal.svg = svg
  signatureModal.name = name
}

function closeSignatureModal() {
  signatureModal.open = false
  signatureModal.svg = ''
  signatureModal.name = ''
}

function openAddUserModal() {
  addUserModal.open = true
  addUserModal.uid = ''
  addUserModal.name = ''
  addUserModal.email = ''
  addUserModal.error = ''
}

function closeAddUserModal() {
  addUserModal.open = false
}

async function submitAddUser() {
  if (!addUserModal.uid.trim()) {
    addUserModal.error = 'RFID UID is required'
    return
  }

  const name = addUserModal.name.trim() || 'New User'
  try {
    await api.createUser({ rfid_uid: addUserModal.uid.trim(), name, email: addUserModal.email.trim() || null })
    await loadUsers()
    closeAddUserModal()
  } catch (err) {
    addUserModal.error = err instanceof Error ? err.message : 'Failed to add user'
  }
}

async function openDepartmentsModal() {
  departmentsModal.open = true
  departmentsModal.error = ''
  departmentsModal.name = ''
  departmentsModal.list = await api.fetchDepartments()
}

function closeDepartmentsModal() {
  departmentsModal.open = false
}

async function addDepartment() {
  if (!departmentsModal.name.trim()) return
  await api.createDepartment(departmentsModal.name.trim())
  departmentsModal.name = ''
  departmentsModal.list = await api.fetchDepartments()
  await loadUsers()
}

async function deleteDepartment(id: number) {
  if (!confirm('Delete this department?')) return
  await api.deleteDepartment(id)
  departmentsModal.list = await api.fetchDepartments()
  await loadUsers()
}

async function openProductsModal() {
  productsModal.open = true
  productsModal.error = ''
  productsModal.name = ''
  productsModal.list = await api.fetchProducts()
}

function closeProductsModal() {
  productsModal.open = false
}

async function addProduct() {
  if (!productsModal.name.trim()) return
  await api.createProduct(productsModal.name.trim())
  productsModal.name = ''
  productsModal.list = await api.fetchProducts()
  await loadUsers()
}

async function deleteProduct(id: number) {
  if (!confirm('Delete this product?')) return
  await api.deleteProduct(id)
  productsModal.list = await api.fetchProducts()
  await loadUsers()
}

async function updateUserDepartment(userId: number, department: string | null) {
  await api.updateUserDepartment(userId, department)
  await loadUsers()
}

async function updateUserProduct(userId: number, product: string | null) {
  await api.updateUserProduct(userId, product)
  await loadUsers()
}

async function updatePoints(userId: number) {
  const nextValue = pointsDraft[userId]
  if (nextValue === undefined || Number.isNaN(nextValue)) return
  await api.setUserPoints(userId, Number(nextValue))
  await loadUsers()
}

function openManualAttendanceModal() {
  manualModal.open = true
  manualModal.userId = ''
  manualModal.date = new Date().toISOString().split('T')[0] ?? ''
  manualModal.clockIn = ''
  manualModal.clockOut = ''
  manualModal.message = ''
  manualModal.isError = false
  manualPoints.visible = false
  manualPoints.current = 0
  manualPoints.earned = 0
  manualPoints.total = 0

  nextTick(() => {
    initSignatureCanvas()
    updatePointsPreview()
  })
}

function closeManualAttendanceModal() {
  manualModal.open = false
  cleanupSignatureCanvas()
}

function initSignatureCanvas() {
  const canvas = signatureCanvas.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  signatureContext = canvas.getContext('2d')
  if (!signatureContext) return

  signatureContext.strokeStyle = '#1e293b'
  signatureContext.lineWidth = 2
  signatureContext.lineCap = 'round'
  signatureContext.lineJoin = 'round'

  signatureContext.fillStyle = 'white'
  signatureContext.fillRect(0, 0, canvas.width, canvas.height)
}

function handleStartDrawing(event: MouseEvent) {
  if (!signatureCanvas.value || !signatureContext) return
  const rect = signatureCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  isDrawing = true
  signatureContext.beginPath()
  signatureContext.moveTo(x, y)
}

function handleDrawing(event: MouseEvent) {
  if (!isDrawing || !signatureCanvas.value || !signatureContext) return
  const rect = signatureCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  signatureContext.lineTo(x, y)
  signatureContext.stroke()
}

function stopDrawing() {
  isDrawing = false
  if (signatureContext) signatureContext.closePath()
}

function handleTouchStart(event: TouchEvent) {
  event.preventDefault()
  const touch = event.touches[0]
  if (!touch || !signatureCanvas.value || !signatureContext) return
  const rect = signatureCanvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  isDrawing = true
  signatureContext.beginPath()
  signatureContext.moveTo(x, y)
}

function handleTouchMove(event: TouchEvent) {
  event.preventDefault()
  if (!isDrawing || !signatureCanvas.value || !signatureContext) return
  const touch = event.touches[0]
  if (!touch) return
  const rect = signatureCanvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  signatureContext.lineTo(x, y)
  signatureContext.stroke()
}

function clearSignatureCanvas() {
  if (!signatureCanvas.value || !signatureContext) return
  signatureContext.fillStyle = 'white'
  signatureContext.fillRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height)
}

function cleanupSignatureCanvas() {
  signatureContext = null
  isDrawing = false
}

function calculatePointsFromMinutes(minutes: number) {
  if (minutes < 0) return 0
  return minutes < 240 ? 1 : 2
}

function getManualDurationMinutes() {
  if (!manualModal.clockIn || !manualModal.clockOut || !manualModal.date) return null
  const start = new Date(`${manualModal.date}T${manualModal.clockIn}:00`)
  const end = new Date(`${manualModal.date}T${manualModal.clockOut}:00`)
  const diff = (end.getTime() - start.getTime()) / 60000
  if (!Number.isFinite(diff) || diff < 0) return null
  return Math.round(diff)
}

async function updatePointsPreview() {
  if (!manualModal.open || !manualModal.userId) {
    manualPoints.visible = false
    return
  }

  try {
    const response = await api.fetchUserPoints(Number(manualModal.userId))
    manualPoints.current = typeof response?.points === 'number' ? response.points : 0
  } catch {
    manualPoints.visible = false
    return
  }

  const minutes = getManualDurationMinutes()
  if (minutes === null) {
    manualPoints.visible = false
    return
  }

  manualPoints.earned = calculatePointsFromMinutes(minutes)
  manualPoints.total = manualPoints.current + manualPoints.earned
  manualPoints.visible = true
}

function canvasToSVG() {
  if (!signatureCanvas.value || !signatureContext) return null
  const canvas = signatureCanvas.value
  const imageData = signatureContext.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let hasDrawing = false
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const a = data[i + 3] ?? 0
    if (a > 128 && !(r === 255 && g === 255 && b === 255)) {
      hasDrawing = true
      break
    }
  }

  if (!hasDrawing) return null

  const dataUrl = canvas.toDataURL('image/png')
  return `<svg viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect width="${canvas.width}" height="${canvas.height}" fill="white"/>
    <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
  </svg>`
}

async function submitManualAttendance() {
  if (!manualModal.userId || !manualModal.date || !manualModal.clockIn) {
    manualModal.message = 'Please fill in User, Date, and Clock In Time'
    manualModal.isError = true
    return
  }

  const signature = canvasToSVG()
  if (!signature) {
    manualModal.message = 'Please draw a signature'
    manualModal.isError = true
    return
  }

  manualModal.message = 'Saving...'
  manualModal.isError = false

  const clockInDateTime = `${manualModal.date}T${manualModal.clockIn}:00`
  const clockOutDateTime = manualModal.clockOut ? `${manualModal.date}T${manualModal.clockOut}:00` : null

  await api.createManualAttendance({
    user_id: Number(manualModal.userId),
    date: manualModal.date,
    clock_in: clockInDateTime,
    clock_out: clockOutDateTime ?? undefined,
    signature_data: signature
  })

  manualModal.message = 'Attendance saved'
  manualModal.isError = false
  await loadAllAttendance()
  await loadTodayAttendance()
}

async function exportFloorplan() {
  try {
    await generateFloorplanPDF()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Floorplan export failed')
  }
}

watch(activeTab, async (nextTab) => {
  if (nextTab === 'floorplan') {
    await ensureLegacyFloorplanLoaded(api)
  }
})

watch(
  () => [manualModal.userId, manualModal.clockIn, manualModal.clockOut, manualModal.date],
  () => {
    if (manualModal.open) {
      updatePointsPreview()
    }
  }
)

onMounted(async () => {
  await loadAllData()
  if (activeTab.value === 'floorplan') {
    await ensureLegacyFloorplanLoaded(api)
  }
})
</script>

<template>
  <div class="header">
    <div class="container header-content">
      <img src="/images/logo.png" alt="Logo" class="logo" />
      <div>
        <h1>RFID Attendance Dashboard</h1>
        <p>Real-time attendance tracking and signature management</p>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Users</h3>
        <div class="value">{{ stats.totalUsers }}</div>
      </div>
      <div class="stat-card">
        <h3>Currently Clocked In</h3>
        <div class="value">{{ stats.clockedIn }}</div>
      </div>
      <div class="stat-card">
        <h3>Clocked Out Today</h3>
        <div class="value">{{ stats.clockedOut }}</div>
      </div>
      <div class="stat-card">
        <h3>Total Today</h3>
        <div class="value">{{ stats.totalToday }}</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'today' }" @click="activeTab = 'today'">Today's Attendance</button>
      <button class="tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">All Attendance</button>
      <button class="tab" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Users</button>
      <button class="tab" :class="{ active: activeTab === 'floorplan' }" @click="activeTab = 'floorplan'">Plattegrond</button>
    </div>

    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;">
      <button class="refresh-btn" @click="loadAllData">Refresh Data</button>
    </div>

    <div id="today" class="tab-content" :class="{ active: activeTab === 'today' }">
      <div class="card">
        <div class="table-header-row">
          <h2>Today's Attendance</h2>
          <input v-model="state.search.today" class="table-search" type="text" placeholder="Search name..." />
        </div>
        <div v-if="todayRows.length === 0" class="no-data">No attendance records for today</div>
        <table v-else>
          <thead>
            <tr>
              <th class="sortable" data-table="today" @click="updateSort('today', 'name')">Name</th>
              <th class="sortable" data-table="today" @click="updateSort('today', 'department')">Department</th>
              <th class="sortable" data-table="today" @click="updateSort('today', 'clock_in')">Clock In</th>
              <th class="sortable" data-table="today" @click="updateSort('today', 'clock_out')">Clock Out</th>
              <th class="sortable" data-table="today" @click="updateSort('today', 'duration')">Duration</th>
              <th class="sortable" data-table="today" @click="updateSort('today', 'name')">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in todayRows" :key="`${record.name}-${record.clock_in}`">
              <td><strong>{{ record.name }}</strong></td>
              <td>{{ record.department || '-' }}</td>
              <td>{{ formatDateTime(record.clock_in) }}</td>
              <td>{{ formatDateTime(record.clock_out) }}</td>
              <td>{{ formatDuration(record.work_duration ?? undefined) }}</td>
              <td><span class="badge" :class="record.status?.replace('_', '-')">{{ record.status?.replace('_', ' ').toUpperCase() }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="all" class="tab-content" :class="{ active: activeTab === 'all' }">
      <div class="filters">
        <div class="filter-header" @click="filtersOpen = !filtersOpen">
          <h3 style="margin: 0; color: #1e293b;">Filter Attendance Records</h3>
          <span class="filter-toggle">{{ filtersOpen ? '-' : '+' }}</span>
        </div>
        <div class="filter-panel" :class="{ collapsed: !filtersOpen }">
          <div class="filter-section">
            <div class="filter-section-title">User & Department</div>
            <div class="filter-row">
              <div class="filter-group">
                <label>User</label>
                <select v-model="state.filters.userId">
                  <option value="">All Users</option>
                  <option v-for="user in state.users" :key="user.id" :value="String(user.id)">{{ user.name }}</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Department</label>
                <select v-model="state.filters.department">
                  <option value="">All Departments</option>
                  <option v-for="dept in state.departments" :key="dept.id" :value="dept.name">{{ dept.name }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-section-title">Date Range</div>
            <div class="filter-row">
              <div class="filter-group">
                <label>Start Date</label>
                <input type="date" v-model="state.filters.startDate" />
              </div>
              <div class="filter-group">
                <label>End Date</label>
                <input type="date" v-model="state.filters.endDate" />
              </div>
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-section-title">Product Type</div>
            <div class="filter-row">
              <div class="filter-group">
                <label>Product</label>
                <select v-model="state.filters.product">
                  <option value="">All Products</option>
                  <option v-for="product in state.products" :key="product.id" :value="product.name">{{ product.name }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="filter-actions-row">
            <button class="btn btn-primary" @click="applyFilters">Filter</button>
            <button class="btn btn-secondary" @click="clearFilters">Clear</button>
            <button class="btn btn-success" @click="exportAllAttendance">Export PDF</button>
            <button class="btn btn-info" @click="openManualAttendanceModal">Manual Entry</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-header-row">
          <h2>All Attendance Records</h2>
          <input v-model="state.search.all" class="table-search" type="text" placeholder="Search name..." />
        </div>
        <div v-if="attendanceSelectedCount" class="results-summary">
          <div>
            <strong>{{ attendanceSelectedCount }}</strong> record(s) selected
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-success" @click="exportSelectedAttendance">Export Selected</button>
            <button class="btn btn-danger" @click="deleteSelectedAttendance">Delete Selected</button>
          </div>
        </div>
        <div v-if="allRows.length === 0" class="no-data">No attendance records found</div>
        <table v-else>
          <thead>
            <tr>
              <th style="width: 50px;"><input type="checkbox" @change="toggleAllAttendanceSelection(($event.target as HTMLInputElement).checked)" /></th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'date')">Date</th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'name')">Name</th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'department')">Department</th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'clock_in')">Clock In</th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'clock_out')">Clock Out</th>
              <th class="sortable" data-table="all" @click="updateSort('all', 'duration')">Duration</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in allRows" :key="record.id ?? `${record.name}-${record.clock_in}`">
              <td style="width: 50px;">
                <input
                  type="checkbox"
                  :checked="record.id !== undefined && selectedAttendanceIds.has(record.id)"
                  @change="record.id !== undefined && toggleAttendanceSelection(record.id)"
                />
              </td>
              <td>{{ record.date ? new Date(record.date).toLocaleDateString() : '-' }}</td>
              <td><strong>{{ record.name }}</strong></td>
              <td>{{ record.department || '-' }}</td>
              <td>{{ formatDateTime(record.clock_in) }}</td>
              <td>{{ formatDateTime(record.clock_out) }}</td>
              <td>{{ formatDuration(record.work_duration ?? undefined) }}</td>
              <td>
                <div
                  v-if="record.signature_data"
                  class="signature-preview"
                  v-html="prepareSVG(record.signature_data)"
                  @click="openSignatureModal(record.signature_data, record.name)"
                ></div>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="users" class="tab-content" :class="{ active: activeTab === 'users' }">
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
          <h2 style="margin:0;">Registered Users</h2>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <input v-model="state.search.users" class="table-search" type="text" placeholder="Search name..." />
            <button class="btn btn-primary" @click="openAddUserModal">Add User</button>
            <button class="btn btn-danger" :disabled="usersSelectedCount === 0" @click="deleteSelectedUsers">Delete Selected</button>
            <button class="btn btn-secondary" @click="openDepartmentsModal">Manage Departments</button>
            <button class="btn btn-secondary" @click="openProductsModal">Manage Products</button>
          </div>
        </div>
        <div v-if="usersRows.length === 0" class="no-data">No users found</div>
        <table v-else>
          <thead>
            <tr>
              <th style="width: 50px;"><input type="checkbox" @change="toggleAllUserSelection(($event.target as HTMLInputElement).checked)" /></th>
              <th class="sortable" data-table="users" @click="updateSort('users', 'id')">ID</th>
              <th>RFID UID</th>
              <th class="sortable" data-table="users" @click="updateSort('users', 'name')">Name</th>
              <th class="sortable" data-table="users" @click="updateSort('users', 'department')">Department</th>
              <th>Product</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in usersRows" :key="user.id">
              <td style="width: 50px;">
                <input type="checkbox" :checked="selectedUserIds.has(user.id)" @change="toggleUserSelection(user.id)" />
              </td>
              <td>{{ user.id }}</td>
              <td @dblclick="startUserEdit(user, 'rfid_uid')">
                <template v-if="isEditingUser(user, 'rfid_uid')">
                  <input
                    v-model="userEdit.value"
                    type="text"
                    autofocus
                    @blur="commitUserEdit(user)"
                    @keydown.enter.prevent="commitUserEdit(user)"
                    @keydown.esc.prevent="cancelUserEdit"
                    style="width:160px;"
                  />
                </template>
                <template v-else>
                  <code>{{ user.rfid_uid }}</code>
                </template>
              </td>
              <td @dblclick="startUserEdit(user, 'name')">
                <template v-if="isEditingUser(user, 'name')">
                  <input
                    v-model="userEdit.value"
                    type="text"
                    autofocus
                    @blur="commitUserEdit(user)"
                    @keydown.enter.prevent="commitUserEdit(user)"
                    @keydown.esc.prevent="cancelUserEdit"
                    style="width:200px;"
                  />
                </template>
                <template v-else>
                  <strong>{{ user.name }}</strong>
                </template>
              </td>
              <td>
                <select :value="user.department || ''" @change="updateUserDepartment(user.id, ($event.target as HTMLSelectElement).value || null)">
                  <option value="">-</option>
                  <option v-for="dept in state.departments" :key="dept.id" :value="dept.name">{{ dept.name }}</option>
                </select>
              </td>
              <td>
                <select :value="user.product || ''" @change="updateUserProduct(user.id, ($event.target as HTMLSelectElement).value || null)">
                  <option value="">-</option>
                  <option v-for="product in state.products" :key="product.id" :value="product.name">{{ product.name }}</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  :value="pointsDraft[user.id] ?? user.points ?? 0"
                  @input="pointsDraft[user.id] = Number(($event.target as HTMLInputElement).value)"
                  @blur="updatePoints(user.id)"
                  style="width:80px;padding:0.25rem;border:1px solid #e2e8f0;border-radius:6px;"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="floorplan" class="tab-content" :class="{ active: activeTab === 'floorplan' }">
      <div class="card">
        <div class="floorplan-toolbar">
          <div class="floorplan-day-tabs" role="tablist" aria-label="Floorplan days">
            <button class="floorplan-day-tab" data-day="monday" role="tab">Monday</button>
            <button class="floorplan-day-tab" data-day="tuesday" role="tab">Tuesday</button>
            <button class="floorplan-day-tab" data-day="wednesday" role="tab">Wednesday</button>
            <button class="floorplan-day-tab" data-day="thursday" role="tab">Thursday</button>
            <button class="floorplan-day-tab" data-day="friday" role="tab">Friday</button>
          </div>
          <div class="floorplan-toolbar-group">
            <label for="floorplanRoom">Room</label>
            <select id="floorplanRoom"></select>
          </div>
          <div class="floorplan-toolbar-actions">
            <button class="btn btn-primary" id="addDeskBtn">+ Add Desk</button>
          </div>
          <div class="floorplan-legend">
            <span class="legend-item"><span class="legend-dot legend-free"></span> Free</span>
            <span class="legend-item"><span class="legend-dot legend-partial"></span> One slot</span>
            <span class="legend-item"><span class="legend-dot legend-full"></span> Full</span>
          </div>
        </div>

        <div class="floorplan-layout">
          <div class="floorplan-canvas-wrap">
            <div id="floorplanCanvas" class="floorplan-canvas" aria-label="Floorplan editor"></div>
          </div>
          <div class="floorplan-sidebar">
            <h3>Desk Editor</h3>
            <div id="floorplanDetails" class="floorplan-details"></div>
            <div class="floorplan-room-manager">
              <h4>Rooms</h4>
              <div id="floorplanRooms" class="floorplan-rooms"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Desk Overview</h2>
        <div class="floorplan-overview-toolbar">
          <div class="floorplan-overview-tabs" role="tablist" aria-label="Overview mode">
            <button class="floorplan-overview-tab" data-overview="all" role="tab">All assignments</button>
            <button class="floorplan-overview-tab" data-overview="free" role="tab">Free slots</button>
          </div>
          <div class="floorplan-overview-day-tabs" role="tablist" aria-label="Overview day">
            <button class="floorplan-overview-day-tab" data-day="monday" role="tab">Mon</button>
            <button class="floorplan-overview-day-tab" data-day="tuesday" role="tab">Tue</button>
            <button class="floorplan-overview-day-tab" data-day="wednesday" role="tab">Wed</button>
            <button class="floorplan-overview-day-tab" data-day="thursday" role="tab">Thu</button>
            <button class="floorplan-overview-day-tab" data-day="friday" role="tab">Fri</button>
          </div>
          <input id="floorplanSearch" class="table-search" type="text" placeholder="Search name..." />
          <div class="floorplan-overview-actions">
            <button class="btn btn-secondary" @click="exportFloorplan">Export Floorplan</button>
          </div>
        </div>
        <div id="floorplanTable"></div>
      </div>
    </div>

  </div>

  <div v-if="signatureModal.open" class="modal active" @click="closeSignatureModal">
    <div class="modal-content" @click.stop>
      <button class="modal-close" @click="closeSignatureModal">x</button>
      <h2 style="margin-bottom: 1rem;">{{ signatureModal.name }}'s Signature</h2>
      <div style="border: 2px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc;" v-html="signatureModal.svg"></div>
    </div>
  </div>

  <div v-if="addUserModal.open" class="modal active" @click="closeAddUserModal">
    <div class="modal-content" @click.stop>
      <button class="modal-close" @click="closeAddUserModal">x</button>
      <div style="padding:1rem;">
        <h2 style="margin-bottom:0.5rem;">Add New User</h2>
        <p style="margin-top:0;margin-bottom:1rem;color:#475569;">Enter the RFID UID (required) and optional details.</p>
        <div style="display:grid;gap:0.5rem;">
          <label>RFID UID (paste or type)</label>
          <input v-model="addUserModal.uid" type="text" placeholder="e.g. 04A2B3C4" />

          <label>Name (optional)</label>
          <input v-model="addUserModal.name" type="text" placeholder="Full name" />

          <label>Email (optional)</label>
          <input v-model="addUserModal.email" type="email" placeholder="user@example.com" />

          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.5rem;">
            <button class="btn btn-secondary" @click="closeAddUserModal">Cancel</button>
            <button class="btn btn-primary" @click="submitAddUser">Create User</button>
          </div>
        </div>

        <div v-if="addUserModal.error" style="margin-top:0.75rem;color:#dc2626;">{{ addUserModal.error }}</div>
      </div>
    </div>
  </div>

  <div v-if="departmentsModal.open" class="modal active" @click="closeDepartmentsModal">
    <div class="modal-content" @click.stop>
      <button class="modal-close" @click="closeDepartmentsModal">x</button>
      <h2 style="margin-bottom:0.5rem;">Manage Departments</h2>
      <p style="margin-top:0;margin-bottom:1rem;color:#475569;">Add or remove departments. Removing clears the department from users.</p>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <input v-model="departmentsModal.name" type="text" placeholder="New department name" style="flex:1;padding:0.5rem;border:1px solid #e2e8f0;border-radius:6px;" />
        <button class="btn btn-primary" @click="addDepartment">Add</button>
      </div>
      <div style="max-height:300px;overflow:auto;">
        <ul style="list-style:none;padding:0;margin:0;">
          <li v-for="dept in departmentsModal.list" :key="dept.id" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid #eef2ff;">
            <span>{{ dept.name }}</span>
            <button class="btn btn-secondary" @click="deleteDepartment(dept.id)">Delete</button>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div v-if="productsModal.open" class="modal active" @click="closeProductsModal">
    <div class="modal-content" @click.stop>
      <button class="modal-close" @click="closeProductsModal">x</button>
      <h2 style="margin-bottom:0.5rem;">Manage Products</h2>
      <p style="margin-top:0;margin-bottom:1rem;color:#475569;">Add or remove products. Removing clears the product from users.</p>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <input v-model="productsModal.name" type="text" placeholder="New product name" style="flex:1;padding:0.5rem;border:1px solid #e2e8f0;border-radius:6px;" />
        <button class="btn btn-primary" @click="addProduct">Add</button>
      </div>
      <div style="max-height:300px;overflow:auto;">
        <ul style="list-style:none;padding:0;margin:0;">
          <li v-for="product in productsModal.list" :key="product.id" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid #eef2ff;">
            <span>{{ product.name }}</span>
            <button class="btn btn-secondary" @click="deleteProduct(product.id)">Delete</button>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div v-if="manualModal.open" class="modal active" @click="closeManualAttendanceModal">
    <div class="modal-content" style="max-width: 600px;" @click.stop>
      <button class="modal-close" @click="closeManualAttendanceModal">x</button>
      <div style="padding: 1.5rem;">
        <h2 style="margin-bottom: 1rem;">Manual Attendance Entry</h2>
        <div style="display: grid; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div>
            <label>User *</label>
            <select v-model="manualModal.userId" required>
              <option value="">Select User...</option>
              <option v-for="user in state.users" :key="user.id" :value="String(user.id)">{{ user.name }}</option>
            </select>
          </div>
          <div>
            <label>Date *</label>
            <input type="date" v-model="manualModal.date" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div>
              <label>Clock In Time *</label>
              <input type="time" v-model="manualModal.clockIn" required />
            </div>
            <div>
              <label>Clock Out Time</label>
              <input type="time" v-model="manualModal.clockOut" />
            </div>
          </div>
          <div
            v-if="manualPoints.visible"
            style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 0.5rem; padding: 1rem; margin-top: 0.75rem;"
          >
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; text-align: center;">
              <div>
                <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.25rem;">Current Points</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #0ea5e9;">{{ manualPoints.current }}</div>
              </div>
              <div>
                <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.25rem;">+ Points Earned</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">{{ manualPoints.earned }}</div>
              </div>
              <div>
                <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.25rem;">Total Points</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #059669;">{{ manualPoints.total }}</div>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem;">Signature *</label>
          <div style="border: 2px solid #e2e8f0; border-radius: 0.5rem; background: white;">
            <canvas
              ref="signatureCanvas"
              style="display: block; cursor: crosshair; width: 100%; height: 200px;"
              @mousedown="handleStartDrawing"
              @mousemove="handleDrawing"
              @mouseup="stopDrawing"
              @mouseout="stopDrawing"
              @touchstart="handleTouchStart"
              @touchmove="handleTouchMove"
              @touchend="stopDrawing"
            ></canvas>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button class="btn btn-secondary" type="button" @click="clearSignatureCanvas">Clear Signature</button>
          </div>
        </div>
        <div v-if="manualModal.message" :class="manualModal.isError ? 'error' : 'success'" style="margin-bottom: 1rem; padding: 0.75rem; border-radius: 0.375rem;">
          {{ manualModal.message }}
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary" @click="closeManualAttendanceModal">Cancel</button>
          <button class="btn btn-primary" @click="submitManualAttendance">Save Attendance</button>
        </div>
      </div>
    </div>
  </div>
</template>
