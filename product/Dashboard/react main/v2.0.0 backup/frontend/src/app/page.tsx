"use client";

import type { MouseEvent, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { generateFloorplanPDF, generatePDFWithLayout } from "../services/export";
import { ensureLegacyFloorplanLoaded } from "../services/legacy-floorplan";
import type { AttendanceRecord, DepartmentRecord, ProductRecord, UserRecord } from "../types";

type AttendanceSortKey = "name" | "department" | "clock_in" | "clock_out" | "duration" | "date";
type UserSortKey = "id" | "name" | "department";

type SortState = {
  today: { key: AttendanceSortKey; dir: "asc" | "desc" };
  all: { key: AttendanceSortKey; dir: "asc" | "desc" };
  users: { key: UserSortKey; dir: "asc" | "desc" };
};

type ManualModalState = {
  open: boolean;
  userId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  message: string;
  isError: boolean;
};

type ManualPointsState = {
  visible: boolean;
  current: number;
  earned: number;
  total: number;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"today" | "all" | "users" | "floorplan">("today");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [state, setState] = useState({
    today: [] as AttendanceRecord[],
    all: [] as AttendanceRecord[],
    filtered: [] as AttendanceRecord[],
    users: [] as UserRecord[],
    departments: [] as DepartmentRecord[],
    products: [] as ProductRecord[],
    search: {
      today: "",
      all: "",
      users: "",
    },
    sort: {
      today: { key: "name" as AttendanceSortKey, dir: "asc" },
      all: { key: "date" as AttendanceSortKey, dir: "desc" },
      users: { key: "name" as UserSortKey, dir: "asc" },
    } as SortState,
    filters: {
      userId: "",
      department: "",
      startDate: "",
      endDate: "",
      product: "",
    },
  });

  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<Set<number>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [pointsDraft, setPointsDraft] = useState<Record<number, number>>({});

  const [userEdit, setUserEdit] = useState({
    id: null as number | null,
    field: null as "name" | "rfid_uid" | null,
    value: "",
  });

  const [signatureModal, setSignatureModal] = useState({ open: false, svg: "", name: "" });
  const [addUserModal, setAddUserModal] = useState({ open: false, uid: "", name: "", email: "", error: "" });
  const [departmentsModal, setDepartmentsModal] = useState({ open: false, list: [] as DepartmentRecord[], name: "", error: "" });
  const [productsModal, setProductsModal] = useState({ open: false, list: [] as ProductRecord[], name: "", error: "" });
  const [manualModal, setManualModal] = useState<ManualModalState>({
    open: false,
    userId: "",
    date: "",
    clockIn: "",
    clockOut: "",
    message: "",
    isError: false,
  });
  const [manualPoints, setManualPoints] = useState<ManualPointsState>({ visible: false, current: 0, earned: 0, total: 0 });

  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);

  const stats = useMemo(() => {
    const clockedIn = state.today.filter((r) => r.status === "clocked_in").length;
    const clockedOut = state.today.filter((r) => r.status === "clocked_out").length;
    const totalUsers = state.users.filter((u) => u.active !== false).length;

    return {
      totalUsers,
      clockedIn,
      clockedOut,
      totalToday: state.today.length,
    };
  }, [state.today, state.users]);

  const attendanceSelectedCount = selectedAttendanceIds.size;
  const usersSelectedCount = selectedUserIds.size;

  function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(minutes?: number | null) {
    if (!minutes && minutes !== 0) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function prepareSVG(svgString?: string | null) {
    if (!svgString) return "";
    return svgString.replace(/<svg/, '<svg viewBox="0 0 550 270" preserveAspectRatio="xMidYMid meet"');
  }

  function compareValues(a: unknown, b: unknown, dir: "asc" | "desc") {
    if (a === b) return 0;
    if (a === null || a === undefined) return dir === "asc" ? 1 : -1;
    if (b === null || b === undefined) return dir === "asc" ? -1 : 1;
    if (typeof a === "number" && typeof b === "number") return dir === "asc" ? a - b : b - a;
    const textA = String(a).toLowerCase();
    const textB = String(b).toLowerCase();
    if (textA < textB) return dir === "asc" ? -1 : 1;
    if (textA > textB) return dir === "asc" ? 1 : -1;
    return 0;
  }

  function applySearch<T>(items: T[], query: string, getText: (item: T) => string) {
    if (!query) return items;
    const normalized = query.toLowerCase();
    return items.filter((item) => getText(item).toLowerCase().includes(normalized));
  }

  function sortAttendanceRows(items: AttendanceRecord[], query: string, sort: SortState["today"]) {
    const data = applySearch([...items], query, (item) => item.name || "");
    data.sort((a, b) => {
      switch (sort.key) {
        case "duration":
          return compareValues(a.work_duration, b.work_duration, sort.dir);
        case "clock_in":
          return compareValues(new Date(String(a.clock_in || 0)).getTime(), new Date(String(b.clock_in || 0)).getTime(), sort.dir);
        case "clock_out":
          return compareValues(new Date(String(a.clock_out || 0)).getTime(), new Date(String(b.clock_out || 0)).getTime(), sort.dir);
        case "date":
          return compareValues(new Date(String(a.date || 0)).getTime(), new Date(String(b.date || 0)).getTime(), sort.dir);
        case "department":
          return compareValues(a.department, b.department, sort.dir);
        case "name":
        default:
          return compareValues(a.name, b.name, sort.dir);
      }
    });
    return data;
  }

  function sortUserRows(items: UserRecord[], query: string, sort: SortState["users"]) {
    const data = applySearch([...items], query, (item) => item.name || "");
    data.sort((a, b) => {
      switch (sort.key) {
        case "id":
          return compareValues(a.id, b.id, sort.dir);
        case "department":
          return compareValues(a.department, b.department, sort.dir);
        case "name":
        default:
          return compareValues(a.name, b.name, sort.dir);
      }
    });
    return data;
  }

  const todayRows = useMemo(() => sortAttendanceRows(state.today, state.search.today, state.sort.today), [state]);
  const allRows = useMemo(() => sortAttendanceRows(state.filtered, state.search.all, state.sort.all), [state]);
  const usersRows = useMemo(() => sortUserRows(state.users, state.search.users, state.sort.users), [state]);

  function updateSort<T extends keyof SortState>(table: T, key: SortState[T]["key"]) {
    setState((prev) => {
      const current = prev.sort[table];
      const nextDir: "asc" | "desc" = current.key === key && current.dir === "asc" ? "desc" : "asc";
      return {
        ...prev,
        sort: {
          ...prev.sort,
          [table]: { key, dir: nextDir },
        },
      } as typeof prev;
    });
  }

  function getPeriodText() {
    const { startDate, endDate } = state.filters;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).toLocaleDateString("nl-NL") : "Beginning";
      const end = endDate ? new Date(endDate).toLocaleDateString("nl-NL") : "Today";
      return `${start} / ${end}`;
    }
    return "All Time";
  }

  async function loadStats() {
    const { todayData, usersData } = await api.fetchStats();
    setState((prev) => ({ ...prev, today: todayData, users: usersData }));
  }

  async function loadTodayAttendance() {
    const data = await api.fetchTodayAttendance();
    setState((prev) => ({ ...prev, today: data }));
  }

  async function loadAllAttendance() {
    const data = await api.fetchAllAttendance();
    setState((prev) => ({ ...prev, all: data, filtered: [...data] }));
  }

  async function loadUsers() {
    const [users, departments, products] = await Promise.all([
      api.fetchUsers(),
      api.fetchDepartments(),
      api.fetchProducts(),
    ]);
    setState((prev) => ({ ...prev, users, departments, products }));
    const nextDraft: Record<number, number> = {};
    users.forEach((user) => {
      nextDraft[user.id] = user.points ?? 0;
    });
    setPointsDraft(nextDraft);
    if (typeof window !== "undefined") {
      (window as Window & { State?: Record<string, unknown> }).State = (window as Window & { State?: Record<string, unknown> }).State ?? {};
      (window as Window & { State?: Record<string, unknown> }).State!.allUsers = users;
    }
  }

  async function loadAllData() {
    await Promise.all([loadStats(), loadTodayAttendance(), loadUsers(), loadAllAttendance()]);
  }

  async function applyFilters() {
    const filtered = await api.fetchFilteredAttendance({
      user_id: state.filters.userId || undefined,
      department: state.filters.department || undefined,
      start_date: state.filters.startDate || undefined,
      end_date: state.filters.endDate || undefined,
      product: state.filters.product || undefined,
    });
    setState((prev) => ({ ...prev, filtered }));
    setSelectedAttendanceIds(new Set());
  }

  function clearFilters() {
    setState((prev) => ({
      ...prev,
      filters: {
        userId: "",
        department: "",
        startDate: "",
        endDate: "",
        product: "",
      },
      filtered: [...prev.all],
    }));
    setSelectedAttendanceIds(new Set());
  }

  function toggleAttendanceSelection(id: number) {
    setSelectedAttendanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllAttendanceSelection(checked: boolean) {
    const next = new Set<number>();
    if (checked) {
      state.filtered.forEach((record) => {
        if (record.id !== undefined) next.add(record.id);
      });
    }
    setSelectedAttendanceIds(next);
  }

  async function deleteSelectedAttendance() {
    if (selectedAttendanceIds.size === 0) return;
    if (!confirm(`Delete ${selectedAttendanceIds.size} attendance record(s)?`)) return;
    await api.deleteAttendanceRecords(Array.from(selectedAttendanceIds));
    await loadAllAttendance();
    setSelectedAttendanceIds(new Set());
  }

  async function exportSelectedAttendance() {
    if (selectedAttendanceIds.size === 0) return;
    const selected = state.filtered.filter((record) => record.id && selectedAttendanceIds.has(record.id));
    await generatePDFWithLayout(selected, getPeriodText(), "Selected_Records");
  }

  async function exportAllAttendance() {
    if (state.filtered.length === 0) return;
    await generatePDFWithLayout(state.filtered, getPeriodText());
  }

  function toggleUserSelection(id: number) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllUserSelection(checked: boolean) {
    const next = new Set<number>();
    if (checked) {
      state.users.forEach((user) => next.add(user.id));
    }
    setSelectedUserIds(next);
  }

  async function deleteSelectedUsers() {
    if (selectedUserIds.size === 0) return;
    if (!confirm(`Delete ${selectedUserIds.size} selected user(s)?`)) return;
    await api.deleteUsers(Array.from(selectedUserIds));
    setSelectedUserIds(new Set());
    await loadUsers();
  }

  function openSignatureModal(svg: string, name: string) {
    setSignatureModal({ open: true, svg, name });
  }

  function closeSignatureModal() {
    setSignatureModal({ open: false, svg: "", name: "" });
  }

  function openAddUserModal() {
    setAddUserModal({ open: true, uid: "", name: "", email: "", error: "" });
  }

  function closeAddUserModal() {
    setAddUserModal((prev) => ({ ...prev, open: false }));
  }

  async function submitAddUser() {
    if (!addUserModal.uid.trim()) {
      setAddUserModal((prev) => ({ ...prev, error: "RFID UID is required" }));
      return;
    }

    const name = addUserModal.name.trim() || "New User";
    try {
      await api.createUser({ rfid_uid: addUserModal.uid.trim(), name, email: addUserModal.email.trim() || null });
      await loadUsers();
      closeAddUserModal();
    } catch (err) {
      setAddUserModal((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to add user",
      }));
    }
  }

  async function openDepartmentsModal() {
    const list = await api.fetchDepartments();
    setDepartmentsModal({ open: true, list, name: "", error: "" });
  }

  function closeDepartmentsModal() {
    setDepartmentsModal((prev) => ({ ...prev, open: false }));
  }

  async function addDepartment() {
    if (!departmentsModal.name.trim()) return;
    await api.createDepartment(departmentsModal.name.trim());
    const list = await api.fetchDepartments();
    setDepartmentsModal((prev) => ({ ...prev, name: "", list }));
    await loadUsers();
  }

  async function deleteDepartment(id: number) {
    if (!confirm("Delete this department?")) return;
    await api.deleteDepartment(id);
    const list = await api.fetchDepartments();
    setDepartmentsModal((prev) => ({ ...prev, list }));
    await loadUsers();
  }

  async function openProductsModal() {
    const list = await api.fetchProducts();
    setProductsModal({ open: true, list, name: "", error: "" });
  }

  function closeProductsModal() {
    setProductsModal((prev) => ({ ...prev, open: false }));
  }

  async function addProduct() {
    if (!productsModal.name.trim()) return;
    await api.createProduct(productsModal.name.trim());
    const list = await api.fetchProducts();
    setProductsModal((prev) => ({ ...prev, name: "", list }));
    await loadUsers();
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;
    await api.deleteProduct(id);
    const list = await api.fetchProducts();
    setProductsModal((prev) => ({ ...prev, list }));
    await loadUsers();
  }

  async function updateUserDepartment(userId: number, department: string | null) {
    await api.updateUserDepartment(userId, department);
    await loadUsers();
  }

  async function updateUserProduct(userId: number, product: string | null) {
    await api.updateUserProduct(userId, product);
    await loadUsers();
  }

  async function updatePoints(userId: number) {
    const nextValue = pointsDraft[userId];
    if (nextValue === undefined || Number.isNaN(nextValue)) return;
    await api.setUserPoints(userId, Number(nextValue));
    await loadUsers();
  }

  function startUserEdit(user: UserRecord, field: "name" | "rfid_uid") {
    setUserEdit({ id: user.id, field, value: field === "name" ? user.name : user.rfid_uid });
  }

  function isEditingUser(user: UserRecord, field: "name" | "rfid_uid") {
    return userEdit.id === user.id && userEdit.field === field;
  }

  function cancelUserEdit() {
    setUserEdit({ id: null, field: null, value: "" });
  }

  async function commitUserEdit(user: UserRecord) {
    if (!userEdit.field) return;
    const nextValue = userEdit.value.trim();
    if (!nextValue) {
      cancelUserEdit();
      return;
    }

    try {
      if (userEdit.field === "name") {
        if (nextValue !== user.name) {
          await api.updateUser(user.id, { name: nextValue });
        }
      } else {
        const nextUid = nextValue.toUpperCase();
        if (nextUid !== user.rfid_uid) {
          await api.updateUserUid(user.id, nextUid);
        }
      }
      await loadUsers();
    } finally {
      cancelUserEdit();
    }
  }

  function openManualAttendanceModal() {
    const today = new Date().toISOString().split("T")[0] ?? "";
    setManualModal({
      open: true,
      userId: "",
      date: today,
      clockIn: "",
      clockOut: "",
      message: "",
      isError: false,
    });
    setManualPoints({ visible: false, current: 0, earned: 0, total: 0 });
  }

  function closeManualAttendanceModal() {
    setManualModal((prev) => ({ ...prev, open: false }));
    cleanupSignatureCanvas();
  }

  function initSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    signatureContextRef.current = context;
    context.strokeStyle = "#1e293b";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function handleStartDrawing(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(x, y);
  }

  function handleDrawing(event: MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing() {
    isDrawingRef.current = false;
    signatureContextRef.current?.closePath();
  }

  function handleTouchStart(event: TouchEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const touch = event.touches[0];
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!touch || !canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(x, y);
  }

  function handleTouchMove(event: TouchEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (!isDrawingRef.current) return;
    const touch = event.touches[0];
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!touch || !canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    context.lineTo(x, y);
    context.stroke();
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!canvas || !context) return;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function cleanupSignatureCanvas() {
    signatureContextRef.current = null;
    isDrawingRef.current = false;
  }

  function calculatePointsFromMinutes(minutes: number) {
    if (minutes < 0) return 0;
    return minutes < 240 ? 1 : 2;
  }

  function getManualDurationMinutes() {
    if (!manualModal.clockIn || !manualModal.clockOut || !manualModal.date) return null;
    const start = new Date(`${manualModal.date}T${manualModal.clockIn}:00`);
    const end = new Date(`${manualModal.date}T${manualModal.clockOut}:00`);
    const diff = (end.getTime() - start.getTime()) / 60000;
    if (!Number.isFinite(diff) || diff < 0) return null;
    return Math.round(diff);
  }

  async function updatePointsPreview() {
    if (!manualModal.open || !manualModal.userId) {
      setManualPoints((prev) => ({ ...prev, visible: false }));
      return;
    }

    try {
      const response = await api.fetchUserPoints(Number(manualModal.userId));
      const current = typeof response?.points === "number" ? response.points : 0;
      const minutes = getManualDurationMinutes();
      if (minutes === null) {
        setManualPoints({ visible: false, current, earned: 0, total: current });
        return;
      }
      const earned = calculatePointsFromMinutes(minutes);
      setManualPoints({ visible: true, current, earned, total: current + earned });
    } catch {
      setManualPoints((prev) => ({ ...prev, visible: false }));
    }
  }

  function canvasToSVG() {
    const canvas = signatureCanvasRef.current;
    const context = signatureContextRef.current;
    if (!canvas || !context) return null;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let hasDrawing = false;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a > 128 && !(r === 255 && g === 255 && b === 255)) {
        hasDrawing = true;
        break;
      }
    }

    if (!hasDrawing) return null;

    const dataUrl = canvas.toDataURL("image/png");
    return `<svg viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect width="${canvas.width}" height="${canvas.height}" fill="white"/>
    <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
  </svg>`;
  }

  async function submitManualAttendance() {
    if (!manualModal.userId || !manualModal.date || !manualModal.clockIn) {
      setManualModal((prev) => ({ ...prev, message: "Please fill in User, Date, and Clock In Time", isError: true }));
      return;
    }

    const signature = canvasToSVG();
    if (!signature) {
      setManualModal((prev) => ({ ...prev, message: "Please draw a signature", isError: true }));
      return;
    }

    setManualModal((prev) => ({ ...prev, message: "Saving...", isError: false }));

    const clockInDateTime = `${manualModal.date}T${manualModal.clockIn}:00`;
    const clockOutDateTime = manualModal.clockOut ? `${manualModal.date}T${manualModal.clockOut}:00` : null;

    await api.createManualAttendance({
      user_id: Number(manualModal.userId),
      date: manualModal.date,
      clock_in: clockInDateTime,
      clock_out: clockOutDateTime ?? undefined,
      signature_data: signature,
    });

    setManualModal((prev) => ({ ...prev, message: "Attendance saved", isError: false }));
    await loadAllAttendance();
    await loadTodayAttendance();
  }

  async function exportFloorplan() {
    try {
      await generateFloorplanPDF();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Floorplan export failed");
    }
  }

  useEffect(() => {
    if (activeTab === "floorplan") {
      ensureLegacyFloorplanLoaded(api).catch(() => undefined);
    }
  }, [activeTab]);

  useEffect(() => {
    if (manualModal.open) {
      initSignatureCanvas();
      updatePointsPreview();
    }
  }, [manualModal.open]);

  useEffect(() => {
    if (manualModal.open) {
      updatePointsPreview();
    }
  }, [manualModal.userId, manualModal.clockIn, manualModal.clockOut, manualModal.date]);

  useEffect(() => {
    loadAllData().catch(() => undefined);
  }, []);

  return (
    <>
      <div className="header">
        <div className="container header-content">
          <img src="/images/logo.png" alt="Logo" className="logo" />
          <div>
            <h1>RFID Attendance Dashboard</h1>
            <p>Real-time attendance tracking and signature management</p>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Users</h3>
            <div className="value">{stats.totalUsers}</div>
          </div>
          <div className="stat-card">
            <h3>Currently Clocked In</h3>
            <div className="value">{stats.clockedIn}</div>
          </div>
          <div className="stat-card">
            <h3>Clocked Out Today</h3>
            <div className="value">{stats.clockedOut}</div>
          </div>
          <div className="stat-card">
            <h3>Total Today</h3>
            <div className="value">{stats.totalToday}</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${activeTab === "today" ? "active" : ""}`} onClick={() => setActiveTab("today")}>
            Today&apos;s Attendance
          </button>
          <button className={`tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
            All Attendance
          </button>
          <button className={`tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
            Users
          </button>
          <button className={`tab ${activeTab === "floorplan" ? "active" : ""}`} onClick={() => setActiveTab("floorplan")}>
            Plattegrond
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <button className="refresh-btn" onClick={loadAllData}>Refresh Data</button>
        </div>

        <div id="today" className={`tab-content ${activeTab === "today" ? "active" : ""}`}>
          <div className="card">
            <div className="table-header-row">
              <h2>Today&apos;s Attendance</h2>
              <input
                value={state.search.today}
                onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, today: event.target.value } }))}
                className="table-search"
                type="text"
                placeholder="Search name..."
              />
            </div>
            {todayRows.length === 0 ? (
              <div className="no-data">No attendance records for today</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "name")}>Name</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "department")}>Department</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "clock_in")}>Clock In</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "clock_out")}>Clock Out</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "duration")}>Duration</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "name")}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map((record) => (
                    <tr key={`${record.name}-${record.clock_in ?? ""}`}>
                      <td>
                        <strong>{record.name}</strong>
                      </td>
                      <td>{record.department || "-"}</td>
                      <td>{formatDateTime(record.clock_in)}</td>
                      <td>{formatDateTime(record.clock_out)}</td>
                      <td>{formatDuration(record.work_duration ?? undefined)}</td>
                      <td>
                        <span className={`badge ${record.status?.replace("_", "-") ?? ""}`}>
                          {record.status?.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div id="all" className={`tab-content ${activeTab === "all" ? "active" : ""}`}>
          <div className="filters">
            <div className="filter-header" onClick={() => setFiltersOpen((prev) => !prev)}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Filter Attendance Records</h3>
              <span className="filter-toggle">{filtersOpen ? "-" : "+"}</span>
            </div>
            <div className={`filter-panel ${filtersOpen ? "" : "collapsed"}`}>
              <div className="filter-section">
                <div className="filter-section-title">User & Department</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>User</label>
                    <select
                      value={state.filters.userId}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, userId: event.target.value } }))}
                    >
                      <option value="">All Users</option>
                      {state.users.map((user) => (
                        <option key={user.id} value={String(user.id)}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Department</label>
                    <select
                      value={state.filters.department}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, department: event.target.value } }))}
                    >
                      <option value="">All Departments</option>
                      {state.departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-section-title">Date Range</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={state.filters.startDate}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, startDate: event.target.value } }))}
                    />
                  </div>
                  <div className="filter-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={state.filters.endDate}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, endDate: event.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-section-title">Product Type</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Product</label>
                    <select
                      value={state.filters.product}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, product: event.target.value } }))}
                    >
                      <option value="">All Products</option>
                      {state.products.map((product) => (
                        <option key={product.id} value={product.name}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="filter-actions-row">
                <button className="btn btn-primary" onClick={applyFilters}>Filter</button>
                <button className="btn btn-secondary" onClick={clearFilters}>Clear</button>
                <button className="btn btn-success" onClick={exportAllAttendance}>Export PDF</button>
                <button className="btn btn-info" onClick={openManualAttendanceModal}>Manual Entry</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-header-row">
              <h2>All Attendance Records</h2>
              <input
                value={state.search.all}
                onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, all: event.target.value } }))}
                className="table-search"
                type="text"
                placeholder="Search name..."
              />
            </div>
            {attendanceSelectedCount ? (
              <div className="results-summary">
                <div>
                  <strong>{attendanceSelectedCount}</strong> record(s) selected
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-success" onClick={exportSelectedAttendance}>Export Selected</button>
                  <button className="btn btn-danger" onClick={deleteSelectedAttendance}>Delete Selected</button>
                </div>
              </div>
            ) : null}
            {allRows.length === 0 ? (
              <div className="no-data">No attendance records found</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>
                      <input
                        type="checkbox"
                        onChange={(event) => toggleAllAttendanceSelection(event.currentTarget.checked)}
                      />
                    </th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "date")}>Date</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "name")}>Name</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "department")}>Department</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "clock_in")}>Clock In</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "clock_out")}>Clock Out</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "duration")}>Duration</th>
                    <th>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((record) => (
                    <tr key={record.id ?? `${record.name}-${record.clock_in ?? ""}`}>
                      <td style={{ width: "50px" }}>
                        <input
                          type="checkbox"
                          checked={record.id !== undefined && selectedAttendanceIds.has(record.id)}
                          onChange={() => record.id !== undefined && toggleAttendanceSelection(record.id)}
                        />
                      </td>
                      <td>{record.date ? new Date(record.date).toLocaleDateString() : "-"}</td>
                      <td>
                        <strong>{record.name}</strong>
                      </td>
                      <td>{record.department || "-"}</td>
                      <td>{formatDateTime(record.clock_in)}</td>
                      <td>{formatDateTime(record.clock_out)}</td>
                      <td>{formatDuration(record.work_duration ?? undefined)}</td>
                      <td>
                        {record.signature_data ? (
                          <div
                            className="signature-preview"
                            dangerouslySetInnerHTML={{ __html: prepareSVG(record.signature_data) }}
                            onClick={() => openSignatureModal(record.signature_data ?? "", record.name)}
                          ></div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div id="users" className={`tab-content ${activeTab === "users" ? "active" : ""}`}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h2 style={{ margin: 0 }}>Registered Users</h2>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  value={state.search.users}
                  onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, users: event.target.value } }))}
                  className="table-search"
                  type="text"
                  placeholder="Search name..."
                />
                <button className="btn btn-primary" onClick={openAddUserModal}>Add User</button>
                <button className="btn btn-danger" disabled={usersSelectedCount === 0} onClick={deleteSelectedUsers}>Delete Selected</button>
                <button className="btn btn-secondary" onClick={openDepartmentsModal}>Manage Departments</button>
                <button className="btn btn-secondary" onClick={openProductsModal}>Manage Products</button>
              </div>
            </div>
            {usersRows.length === 0 ? (
              <div className="no-data">No users found</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>
                      <input type="checkbox" onChange={(event) => toggleAllUserSelection(event.currentTarget.checked)} />
                    </th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "id")}>ID</th>
                    <th>RFID UID</th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "name")}>Name</th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "department")}>Department</th>
                    <th>Product</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {usersRows.map((user) => (
                    <tr key={user.id}>
                      <td style={{ width: "50px" }}>
                        <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => toggleUserSelection(user.id)} />
                      </td>
                      <td>{user.id}</td>
                      <td onDoubleClick={() => startUserEdit(user, "rfid_uid")}
                        >
                        {isEditingUser(user, "rfid_uid") ? (
                          <input
                            value={userEdit.value}
                            onChange={(event) => setUserEdit((prev) => ({ ...prev, value: event.target.value }))}
                            type="text"
                            autoFocus
                            onBlur={() => commitUserEdit(user)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitUserEdit(user);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelUserEdit();
                              }
                            }}
                            style={{ width: "160px" }}
                          />
                        ) : (
                          <code>{user.rfid_uid}</code>
                        )}
                      </td>
                      <td onDoubleClick={() => startUserEdit(user, "name")}>
                        {isEditingUser(user, "name") ? (
                          <input
                            value={userEdit.value}
                            onChange={(event) => setUserEdit((prev) => ({ ...prev, value: event.target.value }))}
                            type="text"
                            autoFocus
                            onBlur={() => commitUserEdit(user)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitUserEdit(user);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelUserEdit();
                              }
                            }}
                            style={{ width: "200px" }}
                          />
                        ) : (
                          <strong>{user.name}</strong>
                        )}
                      </td>
                      <td>
                        <select
                          value={user.department || ""}
                          onChange={(event) => updateUserDepartment(user.id, event.target.value || null)}
                        >
                          <option value="">-</option>
                          {state.departments.map((dept) => (
                            <option key={dept.id} value={dept.name}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={user.product || ""}
                          onChange={(event) => updateUserProduct(user.id, event.target.value || null)}
                        >
                          <option value="">-</option>
                          {state.products.map((product) => (
                            <option key={product.id} value={product.name}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={pointsDraft[user.id] ?? user.points ?? 0}
                          onChange={(event) =>
                            setPointsDraft((prev) => ({ ...prev, [user.id]: Number(event.target.value) }))
                          }
                          onBlur={() => updatePoints(user.id)}
                          style={{ width: "80px", padding: "0.25rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div id="floorplan" className={`tab-content ${activeTab === "floorplan" ? "active" : ""}`}>
          <div className="card">
            <div className="floorplan-toolbar">
              <div className="floorplan-day-tabs" role="tablist" aria-label="Floorplan days">
                <button className="floorplan-day-tab" data-day="monday" role="tab">Monday</button>
                <button className="floorplan-day-tab" data-day="tuesday" role="tab">Tuesday</button>
                <button className="floorplan-day-tab" data-day="wednesday" role="tab">Wednesday</button>
                <button className="floorplan-day-tab" data-day="thursday" role="tab">Thursday</button>
                <button className="floorplan-day-tab" data-day="friday" role="tab">Friday</button>
              </div>
              <div className="floorplan-toolbar-group">
                <label htmlFor="floorplanRoom">Room</label>
                <select id="floorplanRoom"></select>
              </div>
              <div className="floorplan-toolbar-actions">
                <button className="btn btn-primary" id="addDeskBtn">+ Add Desk</button>
              </div>
              <div className="floorplan-legend">
                <span className="legend-item"><span className="legend-dot legend-free"></span> Free</span>
                <span className="legend-item"><span className="legend-dot legend-partial"></span> One slot</span>
                <span className="legend-item"><span className="legend-dot legend-full"></span> Full</span>
              </div>
            </div>

            <div className="floorplan-layout">
              <div className="floorplan-canvas-wrap">
                <div id="floorplanCanvas" className="floorplan-canvas" aria-label="Floorplan editor"></div>
              </div>
              <div className="floorplan-sidebar">
                <h3>Desk Editor</h3>
                <div id="floorplanDetails" className="floorplan-details"></div>
                <div className="floorplan-room-manager">
                  <h4>Rooms</h4>
                  <div id="floorplanRooms" className="floorplan-rooms"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Desk Overview</h2>
            <div className="floorplan-overview-toolbar">
              <div className="floorplan-overview-tabs" role="tablist" aria-label="Overview mode">
                <button className="floorplan-overview-tab" data-overview="all" role="tab">All assignments</button>
                <button className="floorplan-overview-tab" data-overview="free" role="tab">Free slots</button>
              </div>
              <div className="floorplan-overview-day-tabs" role="tablist" aria-label="Overview day">
                <button className="floorplan-overview-day-tab" data-day="monday" role="tab">Mon</button>
                <button className="floorplan-overview-day-tab" data-day="tuesday" role="tab">Tue</button>
                <button className="floorplan-overview-day-tab" data-day="wednesday" role="tab">Wed</button>
                <button className="floorplan-overview-day-tab" data-day="thursday" role="tab">Thu</button>
                <button className="floorplan-overview-day-tab" data-day="friday" role="tab">Fri</button>
              </div>
              <input id="floorplanSearch" className="table-search" type="text" placeholder="Search name..." />
              <div className="floorplan-overview-actions">
                <button className="btn btn-secondary" onClick={exportFloorplan}>Export Floorplan</button>
              </div>
            </div>
            <div id="floorplanTable"></div>
          </div>
        </div>
      </div>

      {signatureModal.open ? (
        <div className="modal active" onClick={closeSignatureModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeSignatureModal}>x</button>
            <h2 style={{ marginBottom: "1rem" }}>{signatureModal.name}&apos;s Signature</h2>
            <div
              style={{ border: "2px solid #e2e8f0", borderRadius: "8px", padding: "1rem", background: "#f8fafc" }}
              dangerouslySetInnerHTML={{ __html: signatureModal.svg }}
            ></div>
          </div>
        </div>
      ) : null}

      {addUserModal.open ? (
        <div className="modal active" onClick={closeAddUserModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeAddUserModal}>x</button>
            <div style={{ padding: "1rem" }}>
              <h2 style={{ marginBottom: "0.5rem" }}>Add New User</h2>
              <p style={{ marginTop: 0, marginBottom: "1rem", color: "#475569" }}>
                Enter the RFID UID (required) and optional details.
              </p>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <label>RFID UID (paste or type)</label>
                <input
                  value={addUserModal.uid}
                  onChange={(event) => setAddUserModal((prev) => ({ ...prev, uid: event.target.value }))}
                  type="text"
                  placeholder="e.g. 04A2B3C4"
                />

                <label>Name (optional)</label>
                <input
                  value={addUserModal.name}
                  onChange={(event) => setAddUserModal((prev) => ({ ...prev, name: event.target.value }))}
                  type="text"
                  placeholder="Full name"
                />

                <label>Email (optional)</label>
                <input
                  value={addUserModal.email}
                  onChange={(event) => setAddUserModal((prev) => ({ ...prev, email: event.target.value }))}
                  type="email"
                  placeholder="user@example.com"
                />

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button className="btn btn-secondary" onClick={closeAddUserModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitAddUser}>Create User</button>
                </div>
              </div>

              {addUserModal.error ? (
                <div style={{ marginTop: "0.75rem", color: "#dc2626" }}>{addUserModal.error}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {departmentsModal.open ? (
        <div className="modal active" onClick={closeDepartmentsModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeDepartmentsModal}>x</button>
            <h2 style={{ marginBottom: "0.5rem" }}>Manage Departments</h2>
            <p style={{ marginTop: 0, marginBottom: "1rem", color: "#475569" }}>
              Add or remove departments. Removing clears the department from users.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                value={departmentsModal.name}
                onChange={(event) => setDepartmentsModal((prev) => ({ ...prev, name: event.target.value }))}
                type="text"
                placeholder="New department name"
                style={{ flex: 1, padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              />
              <button className="btn btn-primary" onClick={addDepartment}>Add</button>
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {departmentsModal.list.map((dept) => (
                  <li
                    key={dept.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem",
                      borderBottom: "1px solid #eef2ff",
                    }}
                  >
                    <span>{dept.name}</span>
                    <button className="btn btn-secondary" onClick={() => deleteDepartment(dept.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {productsModal.open ? (
        <div className="modal active" onClick={closeProductsModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeProductsModal}>x</button>
            <h2 style={{ marginBottom: "0.5rem" }}>Manage Products</h2>
            <p style={{ marginTop: 0, marginBottom: "1rem", color: "#475569" }}>
              Add or remove products. Removing clears the product from users.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                value={productsModal.name}
                onChange={(event) => setProductsModal((prev) => ({ ...prev, name: event.target.value }))}
                type="text"
                placeholder="New product name"
                style={{ flex: 1, padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              />
              <button className="btn btn-primary" onClick={addProduct}>Add</button>
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {productsModal.list.map((product) => (
                  <li
                    key={product.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem",
                      borderBottom: "1px solid #eef2ff",
                    }}
                  >
                    <span>{product.name}</span>
                    <button className="btn btn-secondary" onClick={() => deleteProduct(product.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {manualModal.open ? (
        <div className="modal active" onClick={closeManualAttendanceModal}>
          <div className="modal-content" style={{ maxWidth: "600px" }} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeManualAttendanceModal}>x</button>
            <div style={{ padding: "1.5rem" }}>
              <h2 style={{ marginBottom: "1rem" }}>Manual Attendance Entry</h2>
              <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div>
                  <label>User *</label>
                  <select
                    value={manualModal.userId}
                    onChange={(event) => setManualModal((prev) => ({ ...prev, userId: event.target.value }))}
                    required
                  >
                    <option value="">Select User...</option>
                    {state.users.map((user) => (
                      <option key={user.id} value={String(user.id)}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Date *</label>
                  <input
                    type="date"
                    value={manualModal.date}
                    onChange={(event) => setManualModal((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label>Clock In Time *</label>
                    <input
                      type="time"
                      value={manualModal.clockIn}
                      onChange={(event) => setManualModal((prev) => ({ ...prev, clockIn: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label>Clock Out Time</label>
                    <input
                      type="time"
                      value={manualModal.clockOut}
                      onChange={(event) => setManualModal((prev) => ({ ...prev, clockOut: event.target.value }))}
                    />
                  </div>
                </div>
                {manualPoints.visible ? (
                  <div
                    style={{
                      background: "#f0f9ff",
                      border: "2px solid #0ea5e9",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", textAlign: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Current Points</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0ea5e9" }}>{manualPoints.current}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>+ Points Earned</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>{manualPoints.earned}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Points</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#059669" }}>{manualPoints.total}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>Signature *</label>
                <div style={{ border: "2px solid #e2e8f0", borderRadius: "0.5rem", background: "white" }}>
                  <canvas
                    ref={signatureCanvasRef}
                    style={{ display: "block", cursor: "crosshair", width: "100%", height: "200px" }}
                    onMouseDown={handleStartDrawing}
                    onMouseMove={handleDrawing}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={stopDrawing}
                  ></canvas>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button className="btn btn-secondary" type="button" onClick={clearSignatureCanvas}>Clear Signature</button>
                </div>
              </div>
              {manualModal.message ? (
                <div
                  className={manualModal.isError ? "error" : "success"}
                  style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: "0.375rem" }}
                >
                  {manualModal.message}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={closeManualAttendanceModal}>Cancel</button>
                <button className="btn btn-primary" onClick={submitManualAttendance}>Save Attendance</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
