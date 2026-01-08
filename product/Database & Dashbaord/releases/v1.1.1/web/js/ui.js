// UI Helper Functions
const UI = {
    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatDuration(minutes) {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    },

    prepareSVG(svgString) {
        return svgString.replace(/<svg/, `<svg viewBox="${CONFIG.SVG_VIEWBOX}" preserveAspectRatio="xMidYMid meet"`);
    },

    renderStatsCards(todayData, usersData) {
        const clockedIn = todayData.filter(r => r.status === 'clocked_in').length;
        const clockedOut = todayData.filter(r => r.status === 'clocked_out').length;
        const totalUsers = usersData.filter(u => u.active).length;

        return `
            <div class="stat-card">
                <h3>Total Users</h3>
                <div class="value">${totalUsers}</div>
            </div>
            <div class="stat-card">
                <h3>Currently Clocked In</h3>
                <div class="value">${clockedIn}</div>
            </div>
            <div class="stat-card">
                <h3>Clocked Out Today</h3>
                <div class="value">${clockedOut}</div>
            </div>
            <div class="stat-card">
                <h3>Total Today</h3>
                <div class="value">${todayData.length}</div>
            </div>
        `;
    },

    renderTodayTable(data) {
        if (data.length === 0) {
            return '<div class="no-data">No attendance records for today</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(record => `
                        <tr>
                            <td><strong>${record.name}</strong></td>
                            <td>${record.department || '-'}</td>
                            <td>${this.formatDateTime(record.clock_in)}</td>
                            <td>${this.formatDateTime(record.clock_out)}</td>
                            <td>${this.formatDuration(record.work_duration)}</td>
                            <td><span class="badge ${record.status.replace('_', '-')}">${record.status.replace('_', ' ').toUpperCase()}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderAttendanceTable(data) {
        if (data.length === 0) {
            return '<div class="no-data">No attendance records found</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Duration</th>
                        <th>Signature</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(record => `
                        <tr>
                            <td>${new Date(record.date).toLocaleDateString()}</td>
                            <td><strong>${record.name}</strong></td>
                            <td>${record.department || '-'}</td>
                            <td>${this.formatDateTime(record.clock_in)}</td>
                            <td>${this.formatDateTime(record.clock_out)}</td>
                            <td>${this.formatDuration(record.work_duration)}</td>
                            <td>
                                ${record.signature_data ? 
                                    `<div class="signature-preview" onclick='showSignature(\`${record.signature_data.replace(/`/g, '\\`')}\`, "${record.name}")'>
                                        ${this.prepareSVG(record.signature_data)}
                                    </div>` 
                                    : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderUsersTable(users) {
        if (users.length === 0) {
            return '<div class="no-data">No users found</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th><input type="checkbox" onclick="toggleSelectAll(this)" title="Select all" /></th>
                        <th>ID</th>
                        <th>RFID UID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr onclick="toggleRowSelection(event, ${user.id})" style="cursor:pointer">
                            <td><input type="checkbox" class="user-checkbox" data-id="${user.id}" onclick="event.stopPropagation(); updateDeleteButtonState();" /></td>
                            <td>${user.id}</td>
                            <td><code>${user.rfid_uid}</code></td>
                            <td><strong>${user.name}</strong></td>
                            <td>${user.email || '-'}</td>
                            <td>${user.department || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    populateUserDropdown(users) {
        const userSelect = document.getElementById('filterUser');
        userSelect.innerHTML = '<option value="">All Users</option>' + 
            users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }
};

// Selection helpers for users table
function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateDeleteButtonState();
}

function updateDeleteButtonState() {
    const checkboxes = Array.from(document.querySelectorAll('.user-checkbox'));
    const anyChecked = checkboxes.filter(cb => cb.checked).length > 0;
    const btn = document.getElementById('deleteSelectedBtn');
    if (btn) btn.disabled = !anyChecked;

    // manage row highlight for each checkbox
    checkboxes.forEach(cb => {
        const tr = cb.closest('tr');
        if (!tr) return;
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    });
}

async function deleteSelectedUsers() {
    const checked = Array.from(document.querySelectorAll('.user-checkbox:checked'));
    if (checked.length === 0) return;

    if (!confirm(`Delete ${checked.length} selected user(s)? This will permanently remove them.`)) return;

    const ids = checked.map(cb => parseInt(cb.getAttribute('data-id'))).filter(Boolean);

    try {
        await API.deleteUsers(ids);
        // Refresh data
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to delete users:', err);
        alert('Failed to delete users. See console for details.');
    }
}

// Modal Functions
function showSignature(signature, userName) {
    const modal = document.getElementById('signatureModal');
    const content = document.getElementById('signatureModalContent');
    
    content.innerHTML = `
        <h2 style="margin-bottom: 1rem;">${userName}'s Signature</h2>
        <div style="border: 2px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc;">
            ${signature}
        </div>
    `;
    
    modal.classList.add('active');
}

function closeModal(event) {
    if (!event || event.target.id === 'signatureModal') {
        document.getElementById('signatureModal').classList.remove('active');
    }
}

// Add User modal handlers
function showAddUserModal() {
    document.getElementById('addUserMessage').style.display = 'none';
    document.getElementById('newUserUid').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('addUserModal').classList.add('active');
}

function closeAddUserModal(event) {
    if (!event || event.target.id === 'addUserModal') {
        document.getElementById('addUserModal').classList.remove('active');
    }
}

async function submitAddUser() {
    const uid = document.getElementById('newUserUid').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const msgEl = document.getElementById('addUserMessage');

    if (!uid) {
        msgEl.textContent = 'RFID UID is required';
        msgEl.style.display = 'block';
        return;
    }

    msgEl.style.display = 'none';
    try {
        await API.createUser({ rfid_uid: uid, name: name || null, email: email || null });
        // refresh the users list (reload all data for simplicity)
        if (window.loadAllData) await window.loadAllData();
        closeAddUserModal();
    } catch (err) {
        console.error('Error creating user:', err);
        msgEl.textContent = err.message || 'Failed to create user';
        msgEl.style.display = 'block';
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Toggle selection when clicking the row (but allow checkbox clicks to work normally)
function toggleRowSelection(event, id) {
    // If the click happened on an interactive element, don't toggle row
    const tag = event.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'button' || tag === 'a' || tag === 'svg' || tag === 'path') {
        return;
    }

    const checkbox = document.querySelector(`.user-checkbox[data-id="${id}"]`);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    updateDeleteButtonState();
}