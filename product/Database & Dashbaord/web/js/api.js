// API Service
const API = {
    async fetchStats() {
        const [todayResponse, usersResponse] = await Promise.all([
            fetch(`${CONFIG.API_BASE}/api/attendance/today`),
            fetch(`${CONFIG.API_BASE}/api/users`)
        ]);
        
        const todayData = await todayResponse.json();
        const usersData = await usersResponse.json();
        
        return { todayData, usersData };
    },

    async fetchTodayAttendance() {
        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/today`);
        return await response.json();
    },

    async fetchAllAttendance() {
        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/all`);
        return await response.json();
    },

    async fetchUsers() {
        const response = await fetch(`${CONFIG.API_BASE}/api/users`);
        return await response.json();
    },

    async fetchFilteredAttendance(userId, startDate, endDate) {
        const params = new URLSearchParams();
        if (userId) params.append('user_id', userId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/filter?${params}`);
        return await response.json();
    }
,
    async createUser(user) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });

        // Return parsed JSON or throw on non-2xx
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to create user');
        }

        return await response.json();
    }
};