// Application State
const State = {
    allAttendanceData: [],
    filteredAttendanceData: [],
    allUsers: [],
    departments: []
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
        content.innerHTML = UI.renderTodayTable(data);
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
        content.innerHTML = UI.renderAttendanceTable(data);
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

        content.innerHTML = UI.renderUsersTable(users, departments, products);

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

async function loadAllData() {
    await loadStats();
    await loadTodayAttendance();
    await loadUsers();
    await loadAllAttendance();
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
    loadAllData();
});

// Expose to global scope
window.loadAllData = loadAllData;
window.toggleFilterPanel = toggleFilterPanel;