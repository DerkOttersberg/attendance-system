// Application State
const State = {
    allAttendanceData: [],
    filteredAttendanceData: [],
    allUsers: []
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
        const users = await API.fetchUsers();
        State.allUsers = users;

        // Populate user filter dropdown
        UI.populateUserDropdown(users);

        content.innerHTML = UI.renderUsersTable(users);
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

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    
    // Auto-refresh every 30 seconds
    setInterval(loadAllData, CONFIG.AUTO_REFRESH_INTERVAL);
});

// Expose to global scope
window.loadAllData = loadAllData;