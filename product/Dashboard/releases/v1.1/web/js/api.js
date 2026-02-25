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

    async fetchFilteredAttendance(userId, startDate, endDate, department, signature) {
        const params = new URLSearchParams();
        if (userId) params.append('user_id', userId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (department) params.append('department', department);
        if (signature) params.append('signature', signature);

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
    ,
    async deleteUsers(ids) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to delete users');
        }

        return await response.json();
    }
    ,
    async fetchDepartments() {
        const response = await fetch(`${CONFIG.API_BASE}/api/departments`);
        if (!response.ok) throw new Error('Failed to fetch departments');
        return await response.json();
    },

    async createDepartment(name) {
        const response = await fetch(`${CONFIG.API_BASE}/api/departments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to create department');
        }

        return await response.json();
    },

    async deleteDepartment(id) {
        const response = await fetch(`${CONFIG.API_BASE}/api/departments/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to delete department');
        }

        return await response.json();
    },

    async updateUserDepartment(userId, department) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users/${userId}/department`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to update user department');
        }

        return await response.json();
    }
    ,
    async updateUserUid(userId, rfid_uid) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users/${userId}/uid`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rfid_uid })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to update user UID');
        }

        return await response.json();
    }
    ,
    async updateUser(userId, fields) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to update user');
        }

        return await response.json();
    }
};