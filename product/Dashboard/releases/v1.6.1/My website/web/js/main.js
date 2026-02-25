// Application State
const State = {
    allAttendanceData: [],
    filteredAttendanceData: [],
    allUsers: [],
    departments: [],
    todayAttendanceData: [],
    pointsData: [],
    sorting: {
        today: { key: 'name', dir: 'asc' },
        all: { key: 'name', dir: 'asc' },
        users: { key: 'name', dir: 'asc' },
        points: { key: 'name', dir: 'asc' }
    },
    search: {
        today: '',
        all: '',
        users: '',
        points: ''
    }
};

// Data Loading Functions
async function loadStats() {
    try {
        const { todayData, usersData } = await API.fetchStats();
        document.getElementById('statsGrid').innerHTML = UI.renderStatsCards(todayData, usersData);
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('statsGrid').innerHTML = '<div class="error">Failed to load statistics</div>';
    }
}

async function loadTodayAttendance() {
    const content = document.getElementById('todayContent');
    content.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const data = await API.fetchTodayAttendance();
        State.todayAttendanceData = data;
        renderTodayAttendance();
    } catch (error) {
        console.error('Error loading today attendance:', error);
        content.innerHTML = '<div class="error">Failed to load attendance data</div>';
    }
}

async function loadAllAttendance() {
    const content = document.getElementById('allContent');
    content.innerHTML = '<div class="loading">Loading all attendance records...</div>';

    try {
        const data = await API.fetchAllAttendance();
        State.allAttendanceData = data;
        State.filteredAttendanceData = data;
        
        document.getElementById('filterResults').innerHTML = '';
        renderAllAttendance();
    } catch (error) {
        console.error('Error loading all attendance:', error);
        content.innerHTML = '<div class="error">Failed to load attendance data</div>';
    }
}

async function loadUsers() {
    const content = document.getElementById('usersContent');
    content.innerHTML = '<div class="loading">Loading users...</div>';

    try {
        // preserve selected IDs and scroll position so refresh is clean
        const previouslySelected = Array.from(document.querySelectorAll('.user-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;

        const [users, departments, products] = await Promise.all([API.fetchUsers(), API.fetchDepartments(), API.fetchProducts()]);
        State.allUsers = users;
        State.departments = departments;
        State.products = products;

        // Populate user and department filter dropdowns
        UI.populateUserDropdown(users);
        UI.populateDepartmentDropdown(departments);

        renderUsersTable();

        // reapply previous selections
        if (previouslySelected && previouslySelected.length > 0) {
            previouslySelected.forEach(id => {
                const cb = document.querySelector(`.user-checkbox[data-id="${id}"]`);
                if (cb) cb.checked = true;
            });
            // ensure delete button state and highlights update
            if (window.updateDeleteButtonState) window.updateDeleteButtonState();
        }

        // restore scroll
        window.scrollTo(0, scrollTop);
    } catch (error) {
        console.error('Error loading users:', error);
        content.innerHTML = '<div class="error">Failed to load users</div>';
    }
}

async function loadPoints() {
    const content = document.getElementById('pointsContent');
    if (!content) return;
    content.innerHTML = '<div class="loading">Loading points...</div>';

    try {
        const pointsUsers = await API.fetchPointsList();
        State.pointsData = pointsUsers;
        renderPointsTable();
    } catch (error) {
        console.error('Error loading points:', error);
        content.innerHTML = '<div class="error">Failed to load points</div>';
    }
}

async function loadAllData() {
    await loadStats();
    await loadTodayAttendance();
    await loadUsers();
    await loadPoints();
    await loadAllAttendance();
}

function bindTableSearch() {
    const todaySearch = document.getElementById('todaySearch');
    const allSearch = document.getElementById('allSearch');
    const usersSearch = document.getElementById('usersSearch');
    const pointsSearch = document.getElementById('pointsSearch');

    if (todaySearch) {
        todaySearch.addEventListener('input', () => {
            State.search.today = todaySearch.value.trim();
            renderTodayAttendance();
        });
    }

    if (allSearch) {
        allSearch.addEventListener('input', () => {
            State.search.all = allSearch.value.trim();
            renderAllAttendance();
        });
    }

    if (usersSearch) {
        usersSearch.addEventListener('input', () => {
            State.search.users = usersSearch.value.trim();
            renderUsersTable();
        });
    }

    if (pointsSearch) {
        pointsSearch.addEventListener('input', () => {
            State.search.points = pointsSearch.value.trim();
            renderPointsTable();
        });
    }
}

function handleTableSort(event) {
    const target = event.target.closest('th[data-sort][data-table]');
    if (!target) return;

    const table = target.getAttribute('data-table');
    const key = target.getAttribute('data-sort');
    if (!table || !key || !State.sorting[table]) return;

    const current = State.sorting[table];
    const nextDir = current.key === key && current.dir === 'asc' ? 'desc' : 'asc';
    State.sorting[table] = { key, dir: nextDir };

    if (table === 'today') renderTodayAttendance();
    if (table === 'all') renderAllAttendance();
    if (table === 'users') renderUsersTable();
    if (table === 'points') renderPointsTable();
}

function applySearch(items, query, getText) {
    if (!query) return items;
    const normalized = query.toLowerCase();
    return items.filter(item => getText(item).toLowerCase().includes(normalized));
}

function compareValues(a, b, dir) {
    if (a === b) return 0;
    if (a === null || a === undefined) return dir === 'asc' ? 1 : -1;
    if (b === null || b === undefined) return dir === 'asc' ? -1 : 1;
    if (typeof a === 'number' && typeof b === 'number') {
        return dir === 'asc' ? a - b : b - a;
    }
    const textA = String(a).toLowerCase();
    const textB = String(b).toLowerCase();
    if (textA < textB) return dir === 'asc' ? -1 : 1;
    if (textA > textB) return dir === 'asc' ? 1 : -1;
    return 0;
}

function renderTodayAttendance() {
    const content = document.getElementById('todayContent');
    if (!content) return;
    const sort = State.sorting.today;

    let data = [...State.todayAttendanceData];
    data = applySearch(data, State.search.today, item => item.name || '');

    data.sort((a, b) => {
        const key = sort.key;
        if (key === 'duration') return compareValues(a.work_duration, b.work_duration, sort.dir);
        if (key === 'clock_in') return compareValues(new Date(a.clock_in || 0).getTime(), new Date(b.clock_in || 0).getTime(), sort.dir);
        if (key === 'clock_out') return compareValues(new Date(a.clock_out || 0).getTime(), new Date(b.clock_out || 0).getTime(), sort.dir);
        return compareValues(a[key], b[key], sort.dir);
    });

    content.innerHTML = UI.renderTodayTable(data);
    updateSortIndicators('today', sort.key, sort.dir);
}

function renderAllAttendance() {
    const content = document.getElementById('allContent');
    if (!content) return;
    const sort = State.sorting.all;

    let data = [...State.filteredAttendanceData];
    data = applySearch(data, State.search.all, item => item.name || '');

    data.sort((a, b) => {
        const key = sort.key;
        if (key === 'date') return compareValues(new Date(a.date || 0).getTime(), new Date(b.date || 0).getTime(), sort.dir);
        if (key === 'duration') return compareValues(a.work_duration, b.work_duration, sort.dir);
        if (key === 'clock_in') return compareValues(new Date(a.clock_in || 0).getTime(), new Date(b.clock_in || 0).getTime(), sort.dir);
        if (key === 'clock_out') return compareValues(new Date(a.clock_out || 0).getTime(), new Date(b.clock_out || 0).getTime(), sort.dir);
        return compareValues(a[key], b[key], sort.dir);
    });

    content.innerHTML = UI.renderAttendanceTable(data);
    updateSortIndicators('all', sort.key, sort.dir);
}

function renderUsersTable() {
    const content = document.getElementById('usersContent');
    if (!content) return;
    const sort = State.sorting.users;

    let data = [...State.allUsers];
    data = applySearch(data, State.search.users, item => item.name || '');

    data.sort((a, b) => {
        const key = sort.key;
        return compareValues(a[key], b[key], sort.dir);
    });

    content.innerHTML = UI.renderUsersTable(data, State.departments, State.products || []);
    updateSortIndicators('users', sort.key, sort.dir);
}

function renderPointsTable() {
    const content = document.getElementById('pointsContent');
    if (!content) return;
    const sort = State.sorting.points;

    let data = [...State.pointsData];
    data = applySearch(data, State.search.points, item => item.name || '');

    data.sort((a, b) => {
        const key = sort.key;
        return compareValues(a[key], b[key], sort.dir);
    });

    content.innerHTML = UI.renderPointsTable(data);
    updateSortIndicators('points', sort.key, sort.dir);
}

function updateSortIndicators(table, key, dir) {
    const tableEl = document.querySelector(`th[data-table="${table}"][data-sort]`);
    if (!tableEl) return;
    document.querySelectorAll(`th[data-table="${table}"]`).forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const matches = th.getAttribute('data-sort') === key;
        if (matches) th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
    });
}

// Toggle filter panel visibility
function toggleFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    const filterToggle = document.querySelector('.filter-toggle');
    
    if (filterPanel.classList.contains('collapsed')) {
        filterPanel.classList.remove('collapsed');
        filterToggle.textContent = '−';
    } else {
        filterPanel.classList.add('collapsed');
        filterToggle.textContent = '+';
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    bindTableSearch();
    document.addEventListener('click', handleTableSort);
    loadAllData();
});

// Expose to global scope
window.loadAllData = loadAllData;
window.toggleFilterPanel = toggleFilterPanel;
window.loadPoints = loadPoints;
window.renderAllAttendance = renderAllAttendance;
window.renderUsersTable = renderUsersTable;
window.renderPointsTable = renderPointsTable;
window.renderTodayAttendance = renderTodayAttendance;
