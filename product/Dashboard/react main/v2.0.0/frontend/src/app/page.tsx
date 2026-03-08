"use client";

import type { FormEvent, MouseEvent, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { generateFloorplanPDF, generatePDFWithLayout } from "../services/export";
import { ensureLegacyFloorplanLoaded } from "../services/legacy-floorplan";
import type { AttendanceRecord, AuthUser, DepartmentRecord, ProductRecord, UserRecord } from "../types";

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

const TAB_STORAGE_KEY = "dashboard.activeTab";
const HOME_SECTION_STORAGE_KEY = "dashboard.homeSection";
const MISSED_CLOCK_OUT_MINUTES = 8 * 60;

const HOME_SECTIONS = [
  {
    id: "home",
    label: "Home",
    title: "Bits & Bytes",
    text: "Dummy tekst home."
  },
  {
    id: "zorg",
    label: "Zorg",
    title: "Zorg",
    text: "Dummy tekst zorg."
  },
  {
    id: "missie-visie",
    label: "Missie en visie",
    title: "Missie en visie",
    text: "Dummy tekst missie en visie."
  },
  {
    id: "faq",
    label: "FAQ",
    title: "FAQ",
    text: "Dummy tekst faq."
  },
  {
    id: "privacy",
    label: "Privacy verklaring",
    title: "Privacy verklaring",
    text: "Dummy tekst privacy verklaring."
  },
  {
    id: "contact",
    label: "Contact",
    title: "Contact",
    text: "Dummy tekst contact."
  },
  {
    id: "klachten",
    label: "Klachten",
    title: "Klachten",
    text: "Dummy tekst klachten."
  }
] as const;

type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];

export default function Home() {
  // ...existing code...
  // ...all useState hooks...
  // 2FA modal rendering
  const twoFaModal = loginOpen && (loginStep === "2fa" || loginStep === "2fa-setup") ? (
    <div className="auth-modal">
      <div className="auth-modal-card">
        <h2>Admin 2FA</h2>
        {loginStep === "2fa-setup" ? (
          <>
            <p>Scan de QR code met Google Authenticator of een andere TOTP-app om 2FA in te stellen.</p>
            {login2faQr ? <img src={login2faQr} alt="QR code" style={{ width: "200px", margin: "1rem auto" }} /> : null}
            <form onSubmit={handleAdmin2fa}>
              <label>
                2FA code
                <input
                  type="text"
                  value={login2faCode}
                  onChange={e => setLogin2faCode(e.target.value)}
                  placeholder="123456"
                  required
                />
              </label>
              {login2faError ? <div className="auth-error">{login2faError}</div> : null}
              <div className="auth-actions">
                <button type="button" className="ghost-btn" onClick={resetLoginFlow}>Annuleren</button>
                <button type="submit" className="primary-btn">2FA instellen</button>
              </div>
            </form>
          </>
        ) : (
          <form onSubmit={handleAdmin2fa}>
            <label>
              2FA code
              <input
                type="text"
                value={login2faCode}
                onChange={e => setLogin2faCode(e.target.value)}
                placeholder="123456"
                required
              />
            </label>
            {login2faError ? <div className="auth-error">{login2faError}</div> : null}
            <div className="auth-actions">
              <button type="button" className="ghost-btn" onClick={resetLoginFlow}>Annuleren</button>
              <button type="submit" className="primary-btn">Inloggen met 2FA</button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;
  const [activeTab, setActiveTab] = useState<"home" | "inventarisatie" | "points" | "today" | "all" | "users" | "floorplan">("home");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<"credentials" | "2fa" | "2fa-setup">("credentials");
  const [login2faCode, setLogin2faCode] = useState("");
  const [login2faRequestId, setLogin2faRequestId] = useState<string | null>(null);
  const [login2faQr, setLogin2faQr] = useState<string | null>(null);
  const [login2faError, setLogin2faError] = useState("");
  const [homeSection, setHomeSection] = useState<HomeSectionId>(HOME_SECTIONS[0].id);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [homeMenuLocked, setHomeMenuLocked] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [adminMenuLocked, setAdminMenuLocked] = useState(false);
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "", error: "" });
  const [userPoints, setUserPoints] = useState<number | null>(null);
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
  const [debouncedSearch, setDebouncedSearch] = useState(state.search);

  const [userEdit, setUserEdit] = useState({
    id: null as number | null,
    field: null as "name" | "rfid_uid" | null,
    value: "",
  });
  const [passwordEdit, setPasswordEdit] = useState({
    id: null as number | null,
    value: "",
    error: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [signatureModal, setSignatureModal] = useState({ open: false, svg: "", name: "" });
  const [addUserModal, setAddUserModal] = useState({ open: false, uid: "", name: "", password: "", error: "" });
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
  const isAdmin = authUser?.role === "admin";
  const isUser = authUser?.role === "user";

  function getInitials(name?: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase()).join("");
  }

  function resetLoginFlow() {
    setLoginStep("credentials");
    setLogin2faCode("");
    setLogin2faRequestId(null);
    setLogin2faQr(null);
    setLogin2faError("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginForm((prev) => ({ ...prev, error: "" }));
    setLogin2faError("");
    try {
      const response = await api.login({ identifier: loginForm.identifier, password: loginForm.password });
      if ("user" in response) {
        setAuthUser(response.user);
        setLoginOpen(false);
        setProfileOpen(false);
        setLoginForm({ identifier: "", password: "", error: "" });
        resetLoginFlow();
        return;
      }

      if ("requires2faSetup" in response) {
        setLoginStep("2fa-setup");
        setLogin2faRequestId(response.request_id);
        setLogin2faQr(response.qr_data_url);
        setLogin2faCode("");
        setLoginOpen(true);
        return;
      }

      if ("requires2fa" in response) {
        setLoginStep("2fa");
        setLogin2faRequestId(response.request_id);
        setLogin2faQr(null);
        setLogin2faCode("");
        setLoginOpen(true);
        return;
      }

      // Fallback: show error if response is not handled
      setLoginForm((prev) => ({
        ...prev,
        error: "Onbekende login response. Probeer opnieuw."
      }));
    } catch (err) {
      setLoginForm((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Inloggen mislukt"
      }));
    }
  }

  async function handleAdmin2fa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login2faRequestId) return;
    setLogin2faError("");
    try {
      const { user } = await api.verifyAdmin2fa({ request_id: login2faRequestId, code: login2faCode });
      setAuthUser(user);
      setLoginOpen(false);
      setProfileOpen(false);
      setLoginForm({ identifier: "", password: "", error: "" });
      resetLoginFlow();
    } catch (err) {
      setLogin2faError(err instanceof Error ? err.message : "2FA verificatie mislukt");
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors to avoid trapping the UI.
    }
    setAuthUser(null);
    setProfileOpen(false);
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    return date.toLocaleString("nl-NL", {
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
    return `${hours}u ${mins}m`;
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

  const todayRows = useMemo(
    () => sortAttendanceRows(state.today, debouncedSearch.today, state.sort.today),
    [state.today, debouncedSearch.today, state.sort.today]
  );
  const allRows = useMemo(
    () => sortAttendanceRows(state.filtered, debouncedSearch.all, state.sort.all),
    [state.filtered, debouncedSearch.all, state.sort.all]
  );
  const usersRows = useMemo(
    () => sortUserRows(state.users, debouncedSearch.users, state.sort.users),
    [state.users, debouncedSearch.users, state.sort.users]
  );

  const missedClockOutCount = useMemo(() => {
    const now = Date.now();
    return todayRows.filter((record) => {
      if (record.status !== "clocked_in" || !record.clock_in) return false;
      const started = new Date(record.clock_in).getTime();
      if (!Number.isFinite(started)) return false;
      const minutes = (now - started) / 60000;
      return minutes >= MISSED_CLOCK_OUT_MINUTES;
    }).length;
  }, [todayRows]);

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
      const start = startDate ? new Date(startDate).toLocaleDateString("nl-NL") : "Begin";
      const end = endDate ? new Date(endDate).toLocaleDateString("nl-NL") : "Vandaag";
      return `${start} / ${end}`;
    }
    return "Altijd";
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
    setDataLoading(true);
    try {
      await Promise.all([loadStats(), loadTodayAttendance(), loadUsers(), loadAllAttendance()]);
    } finally {
      setDataLoading(false);
    }
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
    if (!confirm(`${selectedAttendanceIds.size} aanwezigheidsrecord(s) verwijderen?`)) return;
    await api.deleteAttendanceRecords(Array.from(selectedAttendanceIds));
    await loadAllAttendance();
    setSelectedAttendanceIds(new Set());
  }

  async function exportSelectedAttendance() {
    if (selectedAttendanceIds.size === 0) return;
    const selected = state.filtered.filter((record) => record.id && selectedAttendanceIds.has(record.id));
    await generatePDFWithLayout(selected, getPeriodText(), "Geselecteerde_records");
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
    if (!confirm(`${selectedUserIds.size} geselecteerde gebruiker(s) verwijderen?`)) return;
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
    setAddUserModal({ open: true, uid: "", name: "", password: "", error: "" });
    setShowAddUserPassword(false);
  }

  function closeAddUserModal() {
    setAddUserModal((prev) => ({ ...prev, open: false }));
  }

  async function submitAddUser() {
    if (!addUserModal.uid.trim()) {
      setAddUserModal((prev) => ({ ...prev, error: "RFID UID is verplicht" }));
      return;
    }

    const name = addUserModal.name.trim() || "Nieuwe gebruiker";
    const password = addUserModal.password.trim();
    if (password && password.length < 8) {
      setAddUserModal((prev) => ({ ...prev, error: "Wachtwoord moet minimaal 8 tekens zijn" }));
      return;
    }
    try {
      await api.createUser({
        rfid_uid: addUserModal.uid.trim(),
        name,
        password: password || null
      });
      await loadUsers();
      closeAddUserModal();
    } catch (err) {
      setAddUserModal((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Gebruiker toevoegen mislukt",
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
    try {
      await api.createDepartment(departmentsModal.name.trim());
      const list = await api.fetchDepartments();
      setDepartmentsModal((prev) => ({ ...prev, name: "", list, error: "" }));
      await loadUsers();
    } catch (err) {
      setDepartmentsModal((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Organisatie toevoegen mislukt",
      }));
    }
  }

  async function deleteDepartment(id: number) {
    if (!confirm("Deze organisatie verwijderen?")) return;
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
    if (!confirm("Dit product verwijderen?")) return;
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

  function startPasswordEdit(user: UserRecord) {
    setPasswordEdit({ id: user.id, value: "", error: "" });
  }

  function isEditingPassword(user: UserRecord) {
    return passwordEdit.id === user.id;
  }

  function cancelPasswordEdit() {
    setPasswordEdit({ id: null, value: "", error: "" });
  }

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
  }

  async function commitPasswordEdit(user: UserRecord) {
    const nextValue = passwordEdit.value.trim();
    if (!nextValue) {
      cancelPasswordEdit();
      return;
    }

    try {
      await api.updateUserPassword(user.id, nextValue);
      await loadUsers();
      cancelPasswordEdit();
      showToast("Wachtwoord opgeslagen", "success");
    } catch (err) {
      setPasswordEdit((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Wachtwoord bijwerken mislukt",
      }));
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
      setManualModal((prev) => ({ ...prev, message: "Vul gebruiker, datum en inkloktijd in", isError: true }));
      return;
    }

    const signature = canvasToSVG();
    if (!signature) {
      setManualModal((prev) => ({ ...prev, message: "Zet een handtekening", isError: true }));
      return;
    }

    setManualModal((prev) => ({ ...prev, message: "Opslaan...", isError: false }));

    const clockInDateTime = `${manualModal.date}T${manualModal.clockIn}:00`;
    const clockOutDateTime = manualModal.clockOut ? `${manualModal.date}T${manualModal.clockOut}:00` : null;

    await api.createManualAttendance({
      user_id: Number(manualModal.userId),
      date: manualModal.date,
      clock_in: clockInDateTime,
      clock_out: clockOutDateTime ?? undefined,
      signature_data: signature,
    });

    setManualModal((prev) => ({ ...prev, message: "Aanwezigheid opgeslagen", isError: false }));
    await loadAllAttendance();
    await loadTodayAttendance();
  }

  async function exportFloorplan() {
    try {
      const response = await api.fetchFloorplan();
      const layout = response?.data ?? null;
      const assignments = window.FloorplanAPI?.getExportLegend?.() ?? [];
      await generateFloorplanPDF(layout, assignments);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Plattegrond exporteren mislukt");
    }
  }

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setAuthUser(user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedSection = window.localStorage.getItem(HOME_SECTION_STORAGE_KEY);
    if (savedSection && HOME_SECTIONS.some((section) => section.id === savedSection)) {
      setHomeSection(savedSection as HomeSectionId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_SECTION_STORAGE_KEY, homeSection);
  }, [homeSection]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "floorplan") {
      ensureLegacyFloorplanLoaded(api)
        .then(() => {
          window.LegacyFloorplanMount?.();
        })
        .catch(() => undefined);
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (manualModal.open) {
      initSignatureCanvas();
      updatePointsPreview();
    }
  }, [manualModal.open, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (manualModal.open) {
      updatePointsPreview();
    }
  }, [manualModal.userId, manualModal.clockIn, manualModal.clockOut, manualModal.date, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAllData().catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(state.search);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [state.search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authUser) return;
    const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (!savedTab) return;
    const isAllowed = isUser
      ? ["home", "inventarisatie", "points"].includes(savedTab)
      : ["home", "inventarisatie", "today", "all", "users", "floorplan"].includes(savedTab);
    if (isAllowed) {
      setActiveTab(savedTab as typeof activeTab);
    }
  }, [authUser, isUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authUser) return;
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab, authUser]);

  useEffect(() => {
    if (!isUser) return;
    api
      .fetchMyPoints()
      .then((data) => setUserPoints(data.points))
      .catch(() => setUserPoints(0));
  }, [isUser]);

  useEffect(() => {
    if (!authUser && activeTab !== "home") {
      setActiveTab("home");
    }
  }, [authUser, activeTab]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const loginModal = loginOpen ? (
    // ...existing code...
    <div className="auth-modal">
      <div className="auth-modal-card">
        <h2>Inloggen</h2>
        
        <form onSubmit={handleLogin}>
          <label>
            Naam
            <input
              type="text"
              value={loginForm.identifier}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, identifier: event.target.value }))}
              placeholder="bijv. jan jansen"
              required
            />
          </label>
          <label>
            Wachtwoord
            <div className="input-with-toggle">
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowLoginPassword((prev) => !prev)}
                aria-label={showLoginPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
              >
                {showLoginPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.88 5.09A9.77 9.77 0 0112 5c5.05 0 9.27 3.11 10.5 7.5a11.57 11.57 0 01-3.04 4.81M6.17 6.17A11.53 11.53 0 001.5 12.5C2.73 16.89 6.95 20 12 20c1.28 0 2.52-.2 3.7-.56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M1.5 12.5C2.73 8.11 6.95 5 12 5s9.27 3.11 10.5 7.5C21.27 16.89 17.05 20 12 20s-9.27-3.11-10.5-7.5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {loginForm.error ? <div className="auth-error">{loginForm.error}</div> : null}
          <div className="auth-help">Wachtwoord vergeten? Neem contact op met de administrator of IT‑personeel.</div>
          <div className="auth-actions">
            <button type="button" className="ghost-btn" onClick={() => setLoginOpen(false)}>
              Annuleren
            </button>
            <button type="submit" className="primary-btn">
              Inloggen
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const headerActions = authUser ? (
    <>
      <button className="profile-button" onClick={() => setProfileOpen((prev) => !prev)}>
        <span className="profile-avatar">{getInitials(authUser.name)}</span>
        <span className="profile-name">{authUser.name}</span>
      </button>
      {profileOpen ? (
        <div className="profile-menu">
          <div className="profile-meta">
            <strong>{authUser.name}</strong>
            <span>{isAdmin ? "Administrator" : "Gebruiker"}</span>
          </div>
          <button onClick={handleLogout}>Uitloggen</button>
        </div>
      ) : null}
    </>
  ) : (
    <button className="profile-button" onClick={() => setLoginOpen(true)}>
      Inloggen
    </button>
  );

  const header = (
    <div className="header">
      <div className="container header-content">
        <div className="header-brand">
          <img src="/images/logo.png" alt="Logo" className="logo" />
          <div>
            <h1>Bits en Bytes</h1>
            <p>ICT-zorg en begeleiding op maat.</p>
          </div>
        </div>
        <div className="header-actions">{headerActions}</div>
      </div>
    </div>
  );

  const toastNode = toast ? (
    <div className={`toast ${toast.type}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  ) : null;

  const activeHomeSection = HOME_SECTIONS.find((section) => section.id === homeSection) ?? HOME_SECTIONS[0];
  const adminTabs = ["today", "all", "users", "floorplan"] as const;

  const homeTab = (
    <div
      className={`tab-dropdown ${homeMenuOpen ? "open" : ""}`}
      onMouseEnter={() => {
        if (homeMenuLocked) return;
        setHomeMenuOpen(true);
      }}
      onMouseLeave={() => {
        setHomeMenuOpen(false);
        setHomeMenuLocked(false);
      }}
    >
      <button
        className={`tab ${activeTab === "home" ? "active" : ""}`}
        onClick={() => setActiveTab("home")}
      >
        <span>Home</span>
        <span className="tab-dropdown-icon" aria-hidden="true">▾</span>
      </button>
      <div className="tab-dropdown-panel">
        {HOME_SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`tab-dropdown-item ${homeSection === section.id ? "active" : ""}`}
            onClick={() => {
              setHomeSection(section.id);
              setActiveTab("home");
              setHomeMenuOpen(false);
              setHomeMenuLocked(true);
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );

  const adminTab = (
    <div
      className={`tab-dropdown ${adminMenuOpen ? "open" : ""}`}
      onMouseEnter={() => {
        if (adminMenuLocked) return;
        setAdminMenuOpen(true);
      }}
      onMouseLeave={() => {
        setAdminMenuOpen(false);
        setAdminMenuLocked(false);
      }}
    >
      <button
        className={`tab ${adminTabs.includes(activeTab) ? "active" : ""}`}
        onClick={() => setActiveTab("today")}
      >
        <span>Administratie</span>
        <span className="tab-dropdown-icon" aria-hidden="true">▾</span>
      </button>
      <div className="tab-dropdown-panel">
        <button
          className={`tab-dropdown-item ${activeTab === "today" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("today");
            setAdminMenuOpen(false);
            setAdminMenuLocked(true);
          }}
        >
          Aanwezigheid vandaag
        </button>
        <button
          className={`tab-dropdown-item ${activeTab === "all" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("all");
            setAdminMenuOpen(false);
            setAdminMenuLocked(true);
          }}
        >
          Alle aanwezigheid
        </button>
        <button
          className={`tab-dropdown-item ${activeTab === "users" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("users");
            setAdminMenuOpen(false);
            setAdminMenuLocked(true);
          }}
        >
          Gebruikers
        </button>
        <button
          className={`tab-dropdown-item ${activeTab === "floorplan" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("floorplan");
            setAdminMenuOpen(false);
            setAdminMenuLocked(true);
          }}
        >
          Plattegrond
        </button>
      </div>
    </div>
  );

  const homeContent = (
    <div className="card">
      <div className="home-copy">
        <h2>{activeHomeSection.title}</h2>
        <p>{activeHomeSection.text}</p>
      </div>
    </div>
  );

  const userPointsContent = (
    <div className="card">
      <h2>Jouw punten</h2>
      <p>Hier is je huidige puntenstand.</p>
      <div className="stats-grid" style={{ marginTop: "1.5rem" }}>
        <div className="stat-card">
          <h3>Totaal punten</h3>
          <div className="value">{userPoints ?? 0}</div>
        </div>
        <div className="stat-card">
          <h3>Status</h3>
          <div className="value" style={{ fontSize: "1.1rem" }}>Actief</div>
        </div>
      </div>
    </div>
  );

  const inventarisatieContent = (
    <div className="card">
      <h2>Inventarisatie</h2>
      <p>Dummy inventarisatie.</p>
    </div>
  );

  if (authLoading) {
    return (
      <>
        {header}
        {toastNode}
        <div className="container">
          <div className="blank-state">Laden...</div>
        </div>
        {loginModal}
      </>
    );
  }

  if (!authUser) {
    return (
      <>
        {header}
        {toastNode}
        <div className="container">
          <div className="tabs main-tabs">
            {homeTab}
          </div>

          <div id="home" className={`tab-content ${activeTab === "home" ? "active" : ""}`}>
            {homeContent}
          </div>
        </div>
        {loginModal}
        {twoFaModal}
      </>
    );
  }

  if (isUser) {
    return (
      <>
        {header}
        {toastNode}
        <div className="container">
          <div className="tabs main-tabs">
            {homeTab}
            <button className={`tab ${activeTab === "inventarisatie" ? "active" : ""}`} onClick={() => setActiveTab("inventarisatie")}>
              Inventarisatie
            </button>
            <button className={`tab ${activeTab === "points" ? "active" : ""}`} onClick={() => setActiveTab("points")}>
              Mijn punten
            </button>
          </div>

          <div id="home" className={`tab-content ${activeTab === "home" ? "active" : ""}`}>
            {homeContent}
          </div>
          <div id="inventarisatie" className={`tab-content ${activeTab === "inventarisatie" ? "active" : ""}`}>
            {inventarisatieContent}
          </div>
          <div id="points" className={`tab-content ${activeTab === "points" ? "active" : ""}`}>
            {userPointsContent}
          </div>
        </div>
        {loginModal}
      </>
    );
  }

  return (
    <>
      {header}
      {toastNode}

      <div className="container">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Totaal gebruikers</h3>
            <div className="value">{stats.totalUsers}</div>
          </div>
          <div className="stat-card">
            <h3>Nu ingeklokt</h3>
            <div className="value">{stats.clockedIn}</div>
          </div>
          <div className="stat-card">
            <h3>Vandaag uitgeklokt</h3>
            <div className="value">{stats.clockedOut}</div>
          </div>
          <div className="stat-card">
            <h3>Totaal vandaag</h3>
            <div className="value">{stats.totalToday}</div>
          </div>
        </div>

        <div className="tabs main-tabs">
          {homeTab}
          {adminTab}
          <button className={`tab ${activeTab === "inventarisatie" ? "active" : ""}`} onClick={() => setActiveTab("inventarisatie")}>
            Inventarisatie
          </button>
        </div>

        <div id="home" className={`tab-content ${activeTab === "home" ? "active" : ""}`}>
          {homeContent}
        </div>

        <div id="inventarisatie" className={`tab-content ${activeTab === "inventarisatie" ? "active" : ""}`}>
          {inventarisatieContent}
        </div>

        <div id="today" className={`tab-content ${activeTab === "today" ? "active" : ""}`}>
          <div className="card">
            <div className="table-header-row">
              <h2>Aanwezigheid vandaag</h2>
              <input
                value={state.search.today}
                onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, today: event.target.value } }))}
                className="table-search"
                type="text"
                placeholder="Zoek naam..."
              />
            </div>
            {missedClockOutCount > 0 ? (
              <div className="warning-banner">
                {missedClockOutCount} gebruiker(s) hebben mogelijk vergeten uit te klokken.
              </div>
            ) : null}
            {dataLoading ? (
              <div className="table-skeleton">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="skeleton-row columns-6">
                    {Array.from({ length: 6 }).map((__, colIdx) => (
                      <div key={colIdx} className="skeleton-cell"></div>
                    ))}
                  </div>
                ))}
              </div>
            ) : todayRows.length === 0 ? (
              <div className="no-data">Geen aanwezigheidsrecords voor vandaag</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "name")}>Naam</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "department")}>Organisatie</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "clock_in")}>Inklokken</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "clock_out")}>Uitklokken</th>
                    <th className="sortable" data-table="today" onClick={() => updateSort("today", "duration")}>Duur</th>
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
                        {record.status === "clocked_in" && record.clock_in ? (() => {
                          const started = new Date(record.clock_in).getTime();
                          if (!Number.isFinite(started)) return null;
                          const minutes = (Date.now() - started) / 60000;
                          if (minutes < MISSED_CLOCK_OUT_MINUTES) return null;
                          return <span className="badge warn">MOGELIJK GEMIST</span>;
                        })() : null}
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
              <h3 style={{ margin: 0, color: "#1e293b" }}>Aanwezigheid filteren</h3>
              <span className="filter-toggle">{filtersOpen ? "-" : "+"}</span>
            </div>
            <div className={`filter-panel ${filtersOpen ? "" : "collapsed"}`}>
              <div className="filter-section">
                <div className="filter-section-title">Gebruiker en organisatie</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Gebruiker</label>
                    <select
                      value={state.filters.userId}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, userId: event.target.value } }))}
                    >
                      <option value="">Alle gebruikers</option>
                      {state.users.map((user) => (
                        <option key={user.id} value={String(user.id)}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Organisatie</label>
                    <select
                      value={state.filters.department}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, department: event.target.value } }))}
                    >
                      <option value="">Alle organisaties</option>
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
                <div className="filter-section-title">Datumbereik</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Startdatum</label>
                    <input
                      type="date"
                      value={state.filters.startDate}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, startDate: event.target.value } }))}
                    />
                  </div>
                  <div className="filter-group">
                    <label>Einddatum</label>
                    <input
                      type="date"
                      value={state.filters.endDate}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, endDate: event.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-section-title">Producttype</div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Product</label>
                    <select
                      value={state.filters.product}
                      onChange={(event) => setState((prev) => ({ ...prev, filters: { ...prev.filters, product: event.target.value } }))}
                    >
                      <option value="">Alle producten</option>
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
                <button className="btn btn-primary" onClick={applyFilters}>Filteren</button>
                <button className="btn btn-secondary" onClick={clearFilters}>Wissen</button>
                <button className="btn btn-success" onClick={exportAllAttendance}>Exporteren PDF</button>
                <button className="btn btn-info" onClick={openManualAttendanceModal}>Handmatige invoer</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-header-row">
              <h2>Alle aanwezigheidsrecords</h2>
              <input
                value={state.search.all}
                onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, all: event.target.value } }))}
                className="table-search"
                type="text"
                placeholder="Zoek naam..."
              />
            </div>
            {attendanceSelectedCount ? (
              <div className="results-summary">
                <div>
                  <strong>{attendanceSelectedCount}</strong> geselecteerd
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-success" onClick={exportSelectedAttendance}>Selectie exporteren</button>
                  <button className="btn btn-danger" onClick={deleteSelectedAttendance}>Selectie verwijderen</button>
                </div>
              </div>
            ) : null}
            {dataLoading ? (
              <div className="table-skeleton">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="skeleton-row columns-8">
                    {Array.from({ length: 8 }).map((__, colIdx) => (
                      <div key={colIdx} className="skeleton-cell"></div>
                    ))}
                  </div>
                ))}
              </div>
            ) : allRows.length === 0 ? (
              <div className="no-data">Geen aanwezigheidsrecords gevonden</div>
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
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "date")}>Datum</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "name")}>Naam</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "department")}>Organisatie</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "clock_in")}>Inklokken</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "clock_out")}>Uitklokken</th>
                    <th className="sortable" data-table="all" onClick={() => updateSort("all", "duration")}>Duur</th>
                    <th>Handtekening</th>
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
              <h2 style={{ margin: 0 }}>Geregistreerde gebruikers</h2>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  value={state.search.users}
                  onChange={(event) => setState((prev) => ({ ...prev, search: { ...prev.search, users: event.target.value } }))}
                  className="table-search"
                  type="text"
                  placeholder="Zoek naam..."
                />
                <button className="btn btn-primary" onClick={openAddUserModal}>Gebruiker toevoegen</button>
                <button className="btn btn-danger" disabled={usersSelectedCount === 0} onClick={deleteSelectedUsers}>Selectie verwijderen</button>
                <button className="btn btn-secondary" onClick={openDepartmentsModal}>Organisaties beheren</button>
                <button className="btn btn-secondary" onClick={openProductsModal}>Producten beheren</button>
              </div>
            </div>
            {dataLoading ? (
              <div className="table-skeleton">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="skeleton-row columns-8">
                    {Array.from({ length: 8 }).map((__, colIdx) => (
                      <div key={colIdx} className="skeleton-cell"></div>
                    ))}
                  </div>
                ))}
              </div>
            ) : usersRows.length === 0 ? (
              <div className="no-data">Geen gebruikers gevonden</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>
                      <input type="checkbox" onChange={(event) => toggleAllUserSelection(event.currentTarget.checked)} />
                    </th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "id")}>ID</th>
                    <th>RFID UID</th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "name")}>Naam</th>
                    <th className="sortable" data-table="users" onClick={() => updateSort("users", "department")}>Organisatie</th>
                    <th>Product</th>
                    <th>Wachtwoord</th>
                    <th>Punten</th>
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
                      <td onDoubleClick={() => startPasswordEdit(user)}>
                        {isEditingPassword(user) ? (
                          <div>
                            <input
                              type="text"
                              value={passwordEdit.value}
                              onChange={(event) =>
                                setPasswordEdit((prev) => ({ ...prev, value: event.target.value, error: "" }))
                              }
                              autoFocus
                              onBlur={() => commitPasswordEdit(user)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitPasswordEdit(user);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelPasswordEdit();
                                }
                              }}
                                placeholder="Nieuw wachtwoord"
                              style={{ width: "160px" }}
                            />
                            {passwordEdit.error ? (
                              <div className="inline-error">{passwordEdit.error}</div>
                            ) : null}
                          </div>
                        ) : (
                            <span className="password-placeholder">Wachtwoord instellen</span>
                        )}
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
              <div className="floorplan-day-tabs" role="tablist" aria-label="Plattegrond dagen">
                <button className="floorplan-day-tab" data-day="monday" role="tab">Maandag</button>
                <button className="floorplan-day-tab" data-day="tuesday" role="tab">Dinsdag</button>
                <button className="floorplan-day-tab" data-day="wednesday" role="tab">Woensdag</button>
                <button className="floorplan-day-tab" data-day="thursday" role="tab">Donderdag</button>
                <button className="floorplan-day-tab" data-day="friday" role="tab">Vrijdag</button>
              </div>
              <div className="floorplan-toolbar-group">
                <label htmlFor="floorplanRoom">Ruimte</label>
                <select id="floorplanRoom"></select>
              </div>
              <div className="floorplan-toolbar-actions">
                <button className="btn btn-primary" id="addDeskBtn">+ Werkplek toevoegen</button>
              </div>
              <div className="floorplan-legend">
                <span className="legend-item"><span className="legend-dot legend-free"></span> Vrij</span>
                <span className="legend-item"><span className="legend-dot legend-partial"></span> Een plek</span>
                <span className="legend-item"><span className="legend-dot legend-full"></span> Vol</span>
              </div>
            </div>

            <div className="floorplan-layout">
              <div className="floorplan-canvas-wrap">
                <div id="floorplanCanvas" className="floorplan-canvas" aria-label="Plattegrond bewerker"></div>
              </div>
              <div className="floorplan-sidebar">
                <h3>Werkplek bewerken</h3>
                <div id="floorplanDetails" className="floorplan-details"></div>
                <div className="floorplan-room-manager">
                  <h4>Ruimtes</h4>
                  <div id="floorplanRooms" className="floorplan-rooms"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Werkplek overzicht</h2>
            <div className="floorplan-overview-toolbar">
              <div className="floorplan-overview-tabs" role="tablist" aria-label="Overzicht modus">
                <button className="floorplan-overview-tab" data-overview="all" role="tab">Alle toewijzingen</button>
                <button className="floorplan-overview-tab" data-overview="free" role="tab">Vrije plekken</button>
              </div>
              <div className="floorplan-overview-day-tabs" role="tablist" aria-label="Overzicht dag">
                <button className="floorplan-overview-day-tab" data-day="monday" role="tab">Ma</button>
                <button className="floorplan-overview-day-tab" data-day="tuesday" role="tab">Di</button>
                <button className="floorplan-overview-day-tab" data-day="wednesday" role="tab">Wo</button>
                <button className="floorplan-overview-day-tab" data-day="thursday" role="tab">Do</button>
                <button className="floorplan-overview-day-tab" data-day="friday" role="tab">Vr</button>
              </div>
              <input id="floorplanSearch" className="table-search" type="text" placeholder="Zoek naam..." />
              <div className="floorplan-overview-actions">
                <button className="btn btn-secondary" onClick={exportFloorplan}>Plattegrond exporteren</button>
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
            <h2 style={{ marginBottom: "1rem" }}>Handtekening van {signatureModal.name}</h2>
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
            <div className="modal-body">
              <h2 style={{ marginBottom: "0.5rem" }}>Nieuwe gebruiker toevoegen</h2>
              <p className="modal-muted">
                Voer de RFID UID in (verplicht) en optionele gegevens.
              </p>
              <div className="modal-form">
                <label>RFID UID (plakken of typen)</label>
                <input
                  value={addUserModal.uid}
                  onChange={(event) => setAddUserModal((prev) => ({ ...prev, uid: event.target.value }))}
                  type="text"
                  placeholder="bijv. 04A2B3C4"
                />

                <label>Naam (optioneel)</label>
                <input
                  value={addUserModal.name}
                  onChange={(event) => setAddUserModal((prev) => ({ ...prev, name: event.target.value }))}
                  type="text"
                  placeholder="Volledige naam"
                />

                <label>Wachtwoord (optioneel)</label>
                <div className="input-with-toggle">
                  <input
                    value={addUserModal.password}
                    onChange={(event) => setAddUserModal((prev) => ({ ...prev, password: event.target.value }))}
                    type={showAddUserPassword ? "text" : "password"}
                    placeholder="Minimaal 8 tekens"
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowAddUserPassword((prev) => !prev)}
                    aria-label={showAddUserPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                  >
                    {showAddUserPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.88 5.09A9.77 9.77 0 0112 5c5.05 0 9.27 3.11 10.5 7.5a11.57 11.57 0 01-3.04 4.81M6.17 6.17A11.53 11.53 0 001.5 12.5C2.73 16.89 6.95 20 12 20c1.28 0 2.52-.2 3.7-.56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M1.5 12.5C2.73 8.11 6.95 5 12 5s9.27 3.11 10.5 7.5C21.27 16.89 17.05 20 12 20s-9.27-3.11-10.5-7.5z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={closeAddUserModal}>Annuleren</button>
                  <button className="btn btn-primary" onClick={submitAddUser}>Gebruiker aanmaken</button>
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
            <h2 style={{ marginBottom: "0.5rem" }}>Organisaties beheren</h2>
            <p className="modal-muted">
              Organisaties toevoegen of verwijderen. Verwijderen wist de organisatie van gebruikers.
            </p>
            <div className="modal-inline">
              <input
                value={departmentsModal.name}
                onChange={(event) => setDepartmentsModal((prev) => ({ ...prev, name: event.target.value }))}
                type="text"
                placeholder="Nieuwe organisatienaam"
                className="modal-input"
              />
              <button className="btn btn-primary" onClick={addDepartment}>Toevoegen</button>
            </div>
            {departmentsModal.error ? (
              <div style={{ marginBottom: "0.75rem", color: "#dc2626" }}>{departmentsModal.error}</div>
            ) : null}
            <div className="modal-list">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {departmentsModal.list.map((dept) => (
                  <li
                    key={dept.id}
                    className="modal-list-item"
                  >
                    <span>{dept.name}</span>
                    <button className="btn btn-secondary" onClick={() => deleteDepartment(dept.id)}>Verwijderen</button>
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
            <h2 style={{ marginBottom: "0.5rem" }}>Producten beheren</h2>
            <p className="modal-muted">
              Producten toevoegen of verwijderen. Verwijderen wist het product van gebruikers.
            </p>
            <div className="modal-inline">
              <input
                value={productsModal.name}
                onChange={(event) => setProductsModal((prev) => ({ ...prev, name: event.target.value }))}
                type="text"
                placeholder="Nieuwe productnaam"
                className="modal-input"
              />
              <button className="btn btn-primary" onClick={addProduct}>Toevoegen</button>
            </div>
            <div className="modal-list">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {productsModal.list.map((product) => (
                  <li
                    key={product.id}
                    className="modal-list-item"
                  >
                    <span>{product.name}</span>
                    <button className="btn btn-secondary" onClick={() => deleteProduct(product.id)}>Verwijderen</button>
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
              <h2 style={{ marginBottom: "1rem" }}>Handmatige aanwezigheidsinvoer</h2>
              <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div>
                  <label>Gebruiker *</label>
                  <select
                    value={manualModal.userId}
                    onChange={(event) => setManualModal((prev) => ({ ...prev, userId: event.target.value }))}
                    required
                  >
                    <option value="">Selecteer gebruiker...</option>
                    {state.users.map((user) => (
                      <option key={user.id} value={String(user.id)}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Datum *</label>
                  <input
                    type="date"
                    value={manualModal.date}
                    onChange={(event) => setManualModal((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label>Inkloktijd *</label>
                    <input
                      type="time"
                      value={manualModal.clockIn}
                      onChange={(event) => setManualModal((prev) => ({ ...prev, clockIn: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label>Uitkloktijd</label>
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
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Huidige punten</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0ea5e9" }}>{manualPoints.current}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>+ Verdiende punten</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>{manualPoints.earned}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Totaal punten</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#059669" }}>{manualPoints.total}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>Handtekening *</label>
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
                  <button className="btn btn-secondary" type="button" onClick={clearSignatureCanvas}>Handtekening wissen</button>
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
                <button className="btn btn-secondary" onClick={closeManualAttendanceModal}>Annuleren</button>
                <button className="btn btn-primary" onClick={submitManualAttendance}>Aanwezigheid opslaan</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
