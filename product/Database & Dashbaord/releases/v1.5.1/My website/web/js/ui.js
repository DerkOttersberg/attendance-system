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
                        <th style="width: 50px;"><input type="checkbox" id="attendanceSelectAll" onchange="toggleSelectAllAttendance(this)"></th>
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
                        <tr class="attendance-row clickable-row" data-id="${record.id}" onclick="toggleRowSelection(event, ${record.id})">
                            <td style="width: 50px;" onclick="event.stopPropagation();"><input type="checkbox" class="attendance-checkbox" data-id="${record.id}" onclick="event.stopPropagation(); updateAttendanceSelectionUI()"></td>
                            <td>${new Date(record.date).toLocaleDateString()}</td>
                            <td><strong>${record.name}</strong></td>
                            <td>${record.department || '-'}</td>
                            <td>${this.formatDateTime(record.clock_in)}</td>
                            <td>${this.formatDateTime(record.clock_out)}</td>
                            <td>${this.formatDuration(record.work_duration)}</td>
                            <td onclick="event.stopPropagation();">
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

    renderUsersTable(users, departments = [], products = []) {
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
                        <th>Product</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr class="clickable-row" onclick="toggleUserRowSelection(event, ${user.id})">
                            <td><input type="checkbox" class="user-checkbox" data-id="${user.id}" onclick="event.stopPropagation(); updateDeleteButtonState();" /></td>
                            <td>${user.id}</td>
                            <td ondblclick="makeUidEditable(event, ${user.id})"><code data-uid="${user.id}">${user.rfid_uid}</code></td>
                            <td ondblclick="makeFieldEditable(event, ${user.id}, 'name')"><code data-field="name" data-user="${user.id}"><strong>${user.name}</strong></code></td>
                            <td ondblclick="makeFieldEditable(event, ${user.id}, 'email')"><code data-field="email" data-user="${user.id}">${user.email || ''}</code></td>
                            <td>
                                <select onclick="event.stopPropagation();" onchange="updateUserDepartment(${user.id}, this.value)" data-user="${user.id}">
                                    <option value="">-</option>
                                    ${departments.map(d => `<option value="${d.name}" ${user.department === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                                </select>
                            </td>
                            <td>
                                <select onclick="event.stopPropagation();" onchange="updateUserProduct(${user.id}, this.value)" data-user="${user.id}">
                                    <option value="">-</option>
                                    ${products.map(p => `<option value="${p.name}" ${user.product === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </td>
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
    },

    populateDepartmentDropdown(departments) {
        const deptSelect = document.getElementById('filterDepartment');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">All Departments</option>' + 
                departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }
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

function toggleUserRowSelection(event, userId) {
    // Only toggle if clicking on the row itself, not on checkbox or other interactive elements
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'CODE' || event.target.tagName === 'SELECT') {
        return;
    }
    
    const checkbox = document.querySelector(`.user-checkbox[data-id="${userId}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateDeleteButtonState();
    }
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
    // if click happened inside an interactive element, don't toggle
    if (event.target.closest && event.target.closest('input,button,a,svg,path,select,option,label')) {
        return;
    }

    const checkbox = document.querySelector(`.user-checkbox[data-id="${id}"]`);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    updateDeleteButtonState();
}


// Update user's department inline
async function updateUserDepartment(userId, department) {
    try {
        // show a small loading state on the select
        const select = document.querySelector(`select[data-user="${userId}"]`);
        if (select) select.disabled = true;

        await API.updateUserDepartment(userId, department || null);

        // Refresh users list to keep data consistent
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to update department:', err);
        alert('Failed to update department. See console for details.');
    } finally {
        const select = document.querySelector(`select[data-user="${userId}"]`);
        if (select) select.disabled = false;
    }
}

async function updateUserProduct(userId, product) {
    try {
        // show a small loading state on the select
        const select = document.querySelector(`select[data-user="${userId}"]`);
        if (select) select.disabled = true;

        await API.updateUserProduct(userId, product || null);

        // Refresh users list to keep data consistent
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to update product:', err);
        alert('Failed to update product. See console for details.');
    } finally {
        const select = document.querySelector(`select[data-user="${userId}"]`);
        if (select) select.disabled = false;
    }
}


// Departments modal
function showDepartmentsModal() {
    const modal = document.getElementById('departmentsModal');
    if (!modal) return;
    renderDepartmentsModal();
    modal.classList.add('active');
}

function closeDepartmentsModal(event) {
    if (!event || event.target.id === 'departmentsModal') {
        document.getElementById('departmentsModal').classList.remove('active');
    }
}

async function renderDepartmentsModal() {
    const container = document.getElementById('departmentsModalContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading departments...</div>';
    try {
        const depts = await API.fetchDepartments();
        container.innerHTML = `
            <h2 style="margin-bottom:0.5rem;">Manage Departments</h2>
            <p style="margin-top:0;margin-bottom:1rem;color:#475569;">Add or remove departments. Removing clears the department from users.</p>
            <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
                <input id="newDepartmentName" type="text" placeholder="New department name" style="flex:1;padding:0.5rem;border:1px solid #e2e8f0;border-radius:6px;" />
                <button class="btn btn-primary" onclick="submitAddDepartment()">Add</button>
            </div>
            <div style="max-height:300px;overflow:auto;">
                <ul style="list-style:none;padding:0;margin:0;">
                    ${depts.map(d => `<li style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid #eef2ff;"><span>${d.name}</span><button class=\"btn btn-secondary\" onclick=\"deleteDepartment(${d.id})\">Delete</button></li>`).join('')}
                </ul>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load departments:', err);
        container.innerHTML = '<div class="error">Failed to load departments</div>';
    }
}

async function submitAddDepartment() {
    const input = document.getElementById('newDepartmentName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert('Enter a department name');
    try {
        await API.createDepartment(name);
        input.value = '';
        await renderDepartmentsModal();
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to add department:', err);
        alert('Failed to add department');
    }
}

async function deleteDepartment(id) {
    if (!confirm('Delete this department? This will clear the department from any users that used it.')) return;
    try {
        await API.deleteDepartment(id);
        await renderDepartmentsModal();
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to delete department:', err);
        alert('Failed to delete department');
    }
}


// Inline edit UID
function makeUidEditable(event, userId) {
    // prevent row click toggling
    event.stopPropagation();
    const td = event.currentTarget || event.target.closest('td');
    if (!td) return;
    const codeEl = td.querySelector(`code[data-uid="${userId}"]`);
    if (!codeEl) return;

    const original = codeEl.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.onclick = function(e) { e.stopPropagation(); };

    input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            const newVal = input.value.trim();
            if (newVal === '') { alert('UID cannot be empty'); return; }
            try {
                input.disabled = true;
                await API.updateUserUid(userId, newVal);
                if (window.loadAllData) await window.loadAllData();
            } catch (err) {
                console.error('Failed to update UID:', err);
                alert('Failed to update UID: ' + (err.message || err));
                // restore original
                td.removeChild(input);
                td.appendChild(codeEl);
                codeEl.textContent = original;
            }
        } else if (e.key === 'Escape') {
            td.removeChild(input);
            td.appendChild(codeEl);
        }
    });

    input.addEventListener('blur', function() {
        if (td.contains(input)) {
            td.removeChild(input);
            td.appendChild(codeEl);
        }
    });

    td.removeChild(codeEl);
    td.appendChild(input);
    input.focus();
    input.select();
}


// Generic field editor for name/email
function makeFieldEditable(event, userId, field) {
    event.stopPropagation();
    const td = event.currentTarget || event.target.closest('td');
    if (!td) return;
    const codeEl = td.querySelector(`code[data-field="${field}"][data-user="${userId}"]`);
    if (!codeEl) return;

    const original = codeEl.textContent || '';

    const input = document.createElement('input');
    input.type = (field === 'email') ? 'email' : 'text';
    input.value = original;
    input.className = 'inline-edit-input';
    input.onclick = function(e) { e.stopPropagation(); };

    input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            const newVal = input.value.trim();
            if (field === 'name' && newVal === '') { alert('Name cannot be empty'); return; }
            try {
                input.disabled = true;
                const payload = {};
                payload[field] = newVal;
                await API.updateUser(userId, payload);
                if (window.loadAllData) await window.loadAllData();
            } catch (err) {
                console.error('Failed to update field:', err);
                alert('Failed to update: ' + (err.message || err));
                td.removeChild(input);
                td.appendChild(codeEl);
                codeEl.textContent = original;
            }
        } else if (e.key === 'Escape') {
            td.removeChild(input);
            td.appendChild(codeEl);
        }
    });

    input.addEventListener('blur', function() {
        if (td.contains(input)) {
            td.removeChild(input);
            td.appendChild(codeEl);
        }
    });

    td.removeChild(codeEl);
    td.appendChild(input);
    input.focus();
    input.select();
}