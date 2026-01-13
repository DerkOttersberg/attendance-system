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

    async Loginpunten() {
        const response = await fetch(`http://10.10.1.6/login/BitsGoes1!`, {
                method: "GET",
                credentials: "include"
            });
        if (response.status == 200) {
            console.log(response.cookies)
        }
    },

    async fetchAllAttendance() {
        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/all`);
        return await response.json();
    },

    async fetchUsers() {
        const response = await fetch(`${CONFIG.API_BASE}/api/users`);
        return await response.json();
    },

    async fetchFilteredAttendance(userId, department, startDate, endDate, product) {
        const params = new URLSearchParams();
        if (userId) params.append('user_id', userId);
        if (department) params.append('department', department);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (product) params.append('product', product);

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

    async fetchProducts() {
        const response = await fetch(`${CONFIG.API_BASE}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    },

    async createProduct(name) {
        const response = await fetch(`${CONFIG.API_BASE}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to create product');
        }

        return await response.json();
    },

    async deleteProduct(id) {
        const response = await fetch(`${CONFIG.API_BASE}/api/products/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to delete product');
        }

        return await response.json();
    },

    async updateUserDepartment(userId, department) {
        const url = `${CONFIG.API_BASE}/api/users/${userId}/department`;
        console.log('DEBUG: Updating department with URL:', url);
        console.log('DEBUG: CONFIG.API_BASE =', CONFIG.API_BASE);
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to update user department');
        }

        return await response.json();
    },

    async updateUserProduct(userId, product) {
        const response = await fetch(`${CONFIG.API_BASE}/api/users/${userId}/product`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to update user product');
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
    },

    async createManualAttendance(userId, date, clockIn, clockOut, signature) {
        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                date: date,
                clock_in: clockIn,
                clock_out: clockOut,
                signature_data: signature
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to create attendance record');
        }

        return await response.json();
    },

    async deleteAttendanceRecords(ids) {
        const response = await fetch(`${CONFIG.API_BASE}/api/attendance/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to delete attendance records');
        }

        return await response.json();
    }
};