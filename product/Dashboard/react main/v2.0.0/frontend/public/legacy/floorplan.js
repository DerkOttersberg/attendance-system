(() => {
    const STORAGE_KEY = 'floorplan_state_v1';
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const GRID_SIZE = 20;
    const DESK_SIZE = { w: 80, h: 50 };
    const ROOM_MIN = { w: 160, h: 120 };
    const ROOMS = [
        { id: 'server', label: 'Serverruimte (6 werkplekken)', x: 20, y: 20, w: 220, h: 140 },
        { id: 'large', label: 'Grote ruimte (16 werkplekken)', x: 280, y: 20, w: 520, h: 240 },
        { id: 'small', label: 'Zijkamer (8 werkplekken)', x: 20, y: 200, w: 220, h: 220 }
    ];

    const API = window.API || {};
    const DESK_BORDER = 2;

    let state = {
        day: 'monday',
        days: {},
        rooms: [],
        desks: [],
        selectedDeskId: null,
        users: []
    };

    let usersById = {};
    let elements = {};
    let dragState = null;
    let roomDragState = null;
    let saveTimer = null;
    let overviewMode = 'all';
    let overviewDay = 'monday';
    let overviewSearch = '';
    let overviewSort = { key: 'desk', dir: 'asc' };
    let roomNameDraft = '';
    const DAY_LABELS = {
        monday: 'Maandag',
        tuesday: 'Dinsdag',
        wednesday: 'Woensdag',
        thursday: 'Donderdag',
        friday: 'Vrijdag'
    };

    const STATUS_LABELS = {
        free: 'Vrij',
        partial: 'Een plek',
        full: 'Vol'
    };

    function mountOrRefresh() {
        elements = {
            canvas: document.getElementById('floorplanCanvas'),
            dayTabs: Array.from(document.querySelectorAll('.floorplan-day-tab')),
            roomSelect: document.getElementById('floorplanRoom'),
            details: document.getElementById('floorplanDetails'),
            table: document.getElementById('floorplanTable'),
            overviewTabs: Array.from(document.querySelectorAll('.floorplan-overview-tab')),
            overviewDayTabs: Array.from(document.querySelectorAll('.floorplan-overview-day-tab')),
            overviewSearch: document.getElementById('floorplanSearch'),
            roomsPanel: document.getElementById('floorplanRooms'),
            addDeskBtn: document.getElementById('addDeskBtn'),
            resetDayBtn: document.getElementById('resetDayBtn')
        };

        if (!elements.canvas) return;

        const alreadyBound = elements.canvas.dataset.floorplanBound === '1';
        const needsStateReload = !state.rooms || state.rooms.length === 0;
        const needsDeskReload = !state.desks || state.desks.length === 0;
        if (!alreadyBound || (needsStateReload && needsDeskReload)) {
            loadState();
            ensureDayState(state.day);
            overviewDay = state.day;
            populateRoomSelect();
            bindEvents();
            elements.canvas.dataset.floorplanBound = '1';
        }

        updateDayTabs();
        updateOverviewTabs();
        loadUsers();
        renderAll();
        if (elements.canvas.childElementCount === 0) {
            window.requestAnimationFrame(() => renderAll());
        }
        syncFromServer();
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                state = {
                    ...state,
                    ...parsed,
                    day: parsed.day || 'monday',
                    rooms: parsed.rooms || [],
                    desks: parsed.desks || []
                };
            }
        } catch (err) {
            console.warn('Failed to load floorplan state', err);
        }

        if (!state.rooms || state.rooms.length === 0) {
            state.rooms = getDefaultRooms();
        }

        migrateLegacyDayLayouts();

        DAYS.forEach(day => ensureDayState(day));
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                day: state.day,
                days: state.days,
                rooms: state.rooms,
                desks: state.desks
            }));
        } catch (err) {
            console.warn('Failed to save floorplan state', err);
        }

        scheduleServerSave();
    }

    function ensureDayState(day) {
        if (!state.days[day]) {
            state.days[day] = { assignments: {} };
        }
    }

    function populateRoomSelect() {
        if (!elements.roomSelect) return;
        elements.roomSelect.innerHTML = state.rooms.map(room => `
            <option value="${room.id}">${room.label}</option>
        `).join('');
    }

    function renderRoomsManager() {
        if (!elements.roomsPanel) return;

        const rows = state.rooms.map(room => {
            return `
                <div class="floorplan-room-row" data-room-row="${room.id}">
                    <input type="text" value="${escapeHtml(room.label)}" data-room-input="${room.id}" />
                    <div class="floorplan-room-actions">
                        <button class="btn btn-secondary" data-room-remove="${room.id}">Verwijderen</button>
                    </div>
                </div>
            `;
        }).join('');

        elements.roomsPanel.innerHTML = `
            ${rows}
            <div class="floorplan-room-add">
                <input type="text" placeholder="Nieuwe ruimte" value="${escapeHtml(roomNameDraft)}" id="roomNameInput" />
                <button class="btn btn-primary" id="addRoomBtn">Toevoegen</button>
            </div>
        `;

        const nameInput = document.getElementById('roomNameInput');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                roomNameDraft = nameInput.value;
            });
        }

        const addBtn = document.getElementById('addRoomBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const newName = (nameInput ? nameInput.value : '').trim();
                if (!newName) return;
                addRoom(newName);
            });
        }

        elements.roomsPanel.querySelectorAll('[data-room-input]').forEach(input => {
            input.addEventListener('change', event => {
                const roomId = event.target.getAttribute('data-room-input');
                if (!roomId) return;
                const newLabel = event.target.value.trim() || 'Ruimte';
                renameRoom(roomId, newLabel);
            });
        });

        elements.roomsPanel.querySelectorAll('[data-room-remove]').forEach(button => {
            button.addEventListener('click', () => {
                const roomId = button.getAttribute('data-room-remove');
                if (!roomId) return;
                removeRoom(roomId);
            });
        });
    }

    function addRoom(label) {
        const id = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const position = getNextRoomPosition();

        state.rooms.push({
            id,
            label,
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h
        });

        roomNameDraft = '';
        populateRoomSelect();
        saveState();
        renderAll();
    }

    function renameRoom(roomId, newLabel) {
        const room = getRoomById(roomId);
        if (!room) return;
        room.label = newLabel;
        populateRoomSelect();
        saveState();
        renderAll();
    }

    function removeRoom(roomId) {
        if (state.rooms.length <= 1) {
            alert('Je hebt minstens een ruimte nodig.');
            return;
        }

        const room = getRoomById(roomId);
        if (!room) return;

        if (!confirm(`Ruimte "${room.label}" verwijderen? Werkplekken binnenin worden verplaatst naar een andere ruimte.`)) return;

        const remainingRooms = state.rooms.filter(r => r.id !== roomId);
        const fallbackRoom = remainingRooms[0];

        state.desks.forEach(desk => {
            if (desk.room === roomId) {
                desk.room = fallbackRoom.id;
                clampDesksToRoom(fallbackRoom.id);
            }
        });

        state.rooms = remainingRooms;
        populateRoomSelect();
        saveState();
        renderAll();
    }

    function getNextRoomPosition() {
        const base = { x: 20, y: 20, w: 240, h: 180 };
        if (!elements.canvas) return base;

        const index = state.rooms.length;
        const offset = 40 * (index % 5);
        const maxX = Math.max(0, elements.canvas.clientWidth - base.w);
        const maxY = Math.max(0, elements.canvas.clientHeight - base.h);

        return {
            x: clamp(snapToGrid(base.x + offset), 0, maxX),
            y: clamp(snapToGrid(base.y + offset), 0, maxY),
            w: base.w,
            h: base.h
        };
    }

    function bindEvents() {
        if (elements.dayTabs && elements.dayTabs.length > 0) {
            elements.dayTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const day = tab.getAttribute('data-day');
                    if (!day || day === state.day) return;
                    setDay(day);
                });
            });
        }

        if (elements.overviewTabs && elements.overviewTabs.length > 0) {
            elements.overviewTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const mode = tab.getAttribute('data-overview');
                    if (!mode || mode === overviewMode) return;
                    overviewMode = mode;
                    updateOverviewTabs();
                    renderTable();
                });
            });
        }

        if (elements.overviewDayTabs && elements.overviewDayTabs.length > 0) {
            elements.overviewDayTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const day = tab.getAttribute('data-day');
                    if (!day || day === overviewDay) return;
                    overviewDay = day;
                    updateOverviewTabs();
                    renderTable();
                });
            });
        }

        if (elements.overviewSearch) {
            elements.overviewSearch.addEventListener('input', () => {
                overviewSearch = elements.overviewSearch.value.trim().toLowerCase();
                renderTable();
            });
        }

        if (elements.addDeskBtn) {
            elements.addDeskBtn.addEventListener('click', () => {
                const defaultRoom = state.rooms && state.rooms.length > 0 ? state.rooms[0].id : ROOMS[0].id;
                addDesk(elements.roomSelect ? elements.roomSelect.value : defaultRoom);
            });
        }

        if (elements.canvas) {
            elements.canvas.addEventListener('click', event => {
                if (event.target === elements.canvas) {
                    state.selectedDeskId = null;
                    renderDetails();
                    highlightSelectedDesk();
                }
            });
        }

        window.addEventListener('keydown', onDeskKeydown);
    }

    async function loadUsers() {
        try {
            if (window.State && Array.isArray(window.State.allUsers) && window.State.allUsers.length > 0) {
                state.users = window.State.allUsers;
            } else if (API.fetchUsers) {
                state.users = await API.fetchUsers();
            }
        } catch (err) {
            console.warn('Failed to load users for floorplan', err);
            state.users = [];
        }

        usersById = state.users.reduce((acc, user) => {
            acc[String(user.id)] = user;
            return acc;
        }, {});

        const assignmentsChanged = cleanupAssignmentsForMissingUsers();
        if (assignmentsChanged) {
            saveState();
            renderAll();
        } else {
            renderDetails();
            renderTable();
        }
    }

    function cleanupAssignmentsForMissingUsers() {
        let changed = false;

        DAYS.forEach(day => {
            ensureDayState(day);
            const dayState = state.days[day];
            const assignments = dayState.assignments || {};

            Object.values(assignments).forEach(slots => {
                if (!slots) return;
                if (slots.morning && !usersById[String(slots.morning)]) {
                    slots.morning = null;
                    changed = true;
                }
                if (slots.afternoon && !usersById[String(slots.afternoon)]) {
                    slots.afternoon = null;
                    changed = true;
                }
            });
        });

        return changed;
    }

    function addDesk(roomId) {
        const room = state.rooms.find(r => r.id === roomId) || state.rooms[0];
        const deskId = `desk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const deskCount = state.desks.length + 1;
        const position = findNextDeskPosition(room, state.desks);

        const newDesk = {
            id: deskId,
            name: `Werkplek ${deskCount}`,
            room: room.id,
            x: position.x,
            y: position.y,
            w: DESK_SIZE.w,
            h: DESK_SIZE.h,
            rotation: 0
        };

        state.desks.push(newDesk);
        state.selectedDeskId = deskId;
        saveState();
        renderAll();
    }

    function findNextDeskPosition(room, desks) {
        const padding = 10;
        const cols = Math.max(1, Math.floor((room.w - padding) / (DESK_SIZE.w + padding)));
        const inRoomDesks = desks.filter(d => d.room === room.id);
        const index = inRoomDesks.length;
        const col = index % cols;
        const row = Math.floor(index / cols);

        const x = room.x + padding + col * (DESK_SIZE.w + padding);
        const y = room.y + padding + row * (DESK_SIZE.h + padding);

        return {
            x: snapToGrid(x),
            y: snapToGrid(y)
        };
    }

    function updateDayTabs() {
        if (!elements.dayTabs) return;
        elements.dayTabs.forEach(tab => {
            const day = tab.getAttribute('data-day');
            tab.classList.toggle('active', day === state.day);
        });
    }

    function updateOverviewTabs() {
        if (elements.overviewTabs) {
            elements.overviewTabs.forEach(tab => {
                const mode = tab.getAttribute('data-overview');
                tab.classList.toggle('active', mode === overviewMode);
            });
        }

        if (elements.overviewDayTabs) {
            elements.overviewDayTabs.forEach(tab => {
                const day = tab.getAttribute('data-day');
                tab.classList.toggle('active', day === overviewDay);
            });
        }
    }

    function renderAll() {
        renderRooms();
        renderDesks();
        renderDetails();
        renderTable();
        renderRoomsManager();
    }

    function renderRooms() {
        if (!elements.canvas) return;

        const roomEls = elements.canvas.querySelectorAll('.floorplan-room');
        roomEls.forEach(roomEl => roomEl.remove());

        state.rooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'floorplan-room';
            roomEl.dataset.roomId = room.id;
            roomEl.style.left = `${room.x}px`;
            roomEl.style.top = `${room.y}px`;
            roomEl.style.width = `${room.w}px`;
            roomEl.style.height = `${room.h}px`;

            const label = document.createElement('div');
            label.className = 'floorplan-room-label';
            label.textContent = room.label;
            roomEl.appendChild(label);

            const handle = document.createElement('div');
            handle.className = 'floorplan-room-handle';
            roomEl.appendChild(handle);

            roomEl.addEventListener('mousedown', event => startRoomDrag(event, room.id));
            handle.addEventListener('mousedown', event => startRoomResize(event, room.id));

            elements.canvas.appendChild(roomEl);
        });
    }

    function renderDesks() {
        if (!elements.canvas) return;

        const deskEls = elements.canvas.querySelectorAll('.desk');
        deskEls.forEach(deskEl => deskEl.remove());

        state.desks.forEach(desk => {
            const deskEl = document.createElement('div');
            deskEl.className = 'desk';
            deskEl.dataset.deskId = desk.id;
            deskEl.style.left = `${desk.x}px`;
            deskEl.style.top = `${desk.y}px`;
            deskEl.style.width = `${desk.w}px`;
            deskEl.style.height = `${desk.h}px`;
            const rotation = typeof desk.rotation === 'number' ? desk.rotation : 0;
            deskEl.style.transform = `rotate(${rotation}deg)`;

            const deskBody = document.createElement('div');
            deskBody.className = 'desk-body';
            deskBody.style.width = `${desk.w}px`;
            deskBody.style.height = `${desk.h}px`;

            const deskLabel = document.createElement('div');
            deskLabel.className = 'desk-label';
            deskLabel.textContent = desk.name || 'Werkplek';
            deskLabel.style.transform = `rotate(${-rotation}deg)`;
            deskLabel.style.transformOrigin = 'center';

            deskBody.appendChild(deskLabel);
            deskEl.appendChild(deskBody);

            deskEl.addEventListener('mousedown', event => startDeskDrag(event, desk.id));
            deskEl.addEventListener('click', event => selectDesk(event, desk.id));

            elements.canvas.appendChild(deskEl);

            updateDeskStatusClass(deskEl, desk.id);
        });

        highlightSelectedDesk();
    }

    function updateDeskStatusClass(deskEl, deskId) {
        const status = getDeskStatus(deskId, state.day);
        deskEl.classList.remove('desk-status-free', 'desk-status-partial', 'desk-status-full');
        if (status === 'free') deskEl.classList.add('desk-status-free');
        if (status === 'partial') deskEl.classList.add('desk-status-partial');
        if (status === 'full') deskEl.classList.add('desk-status-full');
    }

    function renderDetails() {
        if (!elements.details) return;

        const desk = getSelectedDesk();
        if (!desk) {
            elements.details.innerHTML = '<div class="floorplan-empty">Selecteer een werkplek om toewijzingen te bewerken.</div>';
            return;
        }

        const dayAssignments = getDayAssignments(state.day);
        const assignments = dayAssignments[desk.id] || { morning: null, afternoon: null };

        elements.details.innerHTML = `
            <label>Werkpleknaam</label>
            <input id="deskNameInput" value="${escapeHtml(desk.name)}" />

            <label>Ruimte</label>
            <select id="deskRoomSelect">
                ${state.rooms.map(room => `<option value="${room.id}" ${room.id === desk.room ? 'selected' : ''}>${room.label}</option>`).join('')}
            </select>

            <label>Toewijzingen</label>
            <div class="slot-row">
                <span>Ochtend</span>
                <select id="deskMorningSelect">
                    ${renderUserOptions(assignments.morning)}
                </select>
            </div>
            <div class="slot-row">
                <span>Middag</span>
                <select id="deskAfternoonSelect">
                    ${renderUserOptions(assignments.afternoon)}
                </select>
            </div>
            <div class="slot-actions">
                <button class="btn btn-secondary" id="rotateDeskBtn">Draai 90°</button>
                <button class="btn btn-secondary" id="clearDeskBtn">Toewijzingen wissen</button>
                <button class="btn btn-danger" id="deleteDeskBtn">Werkplek verwijderen</button>
            </div>
        `;

        const nameInput = document.getElementById('deskNameInput');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                desk.name = nameInput.value.trim() || 'Werkplek';
                saveState();
                renderDesks();
                renderTable();
            });
        }

        const roomSelect = document.getElementById('deskRoomSelect');
        if (roomSelect) {
            roomSelect.addEventListener('change', () => {
                desk.room = roomSelect.value;
                clampDesksToRoom(desk.room);
                saveState();
                renderAll();
            });
        }

        const morningSelect = document.getElementById('deskMorningSelect');
        if (morningSelect) {
            morningSelect.addEventListener('change', () => {
                assignments.morning = morningSelect.value ? parseInt(morningSelect.value, 10) : null;
                setDayAssignments(state.day, desk.id, assignments);
            });
        }

        const afternoonSelect = document.getElementById('deskAfternoonSelect');
        if (afternoonSelect) {
            afternoonSelect.addEventListener('change', () => {
                assignments.afternoon = afternoonSelect.value ? parseInt(afternoonSelect.value, 10) : null;
                setDayAssignments(state.day, desk.id, assignments);
            });
        }

        const clearBtn = document.getElementById('clearDeskBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                setDayAssignments(state.day, desk.id, { morning: null, afternoon: null });
                renderDetails();
                renderDesks();
                renderTable();
            });
        }

        const rotateBtn = document.getElementById('rotateDeskBtn');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => {
                const currentRotation = typeof desk.rotation === 'number' ? desk.rotation : 0;
                desk.rotation = (currentRotation + 90) % 360;
                clampDeskToRoom(desk);
                saveState();
                renderDesks();
            });
        }

        const deleteBtn = document.getElementById('deleteDeskBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (!confirm('Deze werkplek verwijderen?')) return;
                deleteDesk(desk.id);
            });
        }
    }

    function renderTable() {
        if (!elements.table) return;

        const rows = [];
        const dayKey = overviewDay || state.day;
        const assignments = getDayAssignments(dayKey);

        state.desks.forEach(desk => {
            const slots = assignments[desk.id] || { morning: null, afternoon: null };
            const room = getRoomById(desk.room);
            rows.push({
                id: desk.id,
                desk: desk.name || 'Werkplek',
                room: room ? room.label : 'Ruimte',
                morning: slots.morning,
                afternoon: slots.afternoon
            });
        });

        let filteredRows = rows;
        if (overviewMode === 'free') {
            filteredRows = rows.filter(row => !row.morning || !row.afternoon);
        }

        if (overviewSearch) {
            filteredRows = filteredRows.filter(row => {
                const text = `${row.desk} ${row.room} ${getUserName(row.morning)} ${getUserName(row.afternoon)}`.toLowerCase();
                return text.includes(overviewSearch);
            });
        }

        filteredRows.sort((a, b) => {
            const key = overviewSort.key;
            const dir = overviewSort.dir;
            return compareValues(a[key], b[key], dir);
        });

        if (filteredRows.length === 0) {
            elements.table.innerHTML = '<div class="no-data">Geen werkplekken beschikbaar.</div>';
            return;
        }

        elements.table.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th class="sortable" data-sort="desk">Werkplek</th>
                        <th class="sortable" data-sort="room">Ruimte</th>
                        <th>Ochtend</th>
                        <th>Middag</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRows.map(row => {
                        const status = getDeskStatus(row.id, dayKey);
                        return `
                            <tr>
                                <td>${escapeHtml(row.desk)}</td>
                                <td>${escapeHtml(row.room)}</td>
                                <td>${escapeHtml(getUserName(row.morning))}</td>
                                <td>${escapeHtml(getUserName(row.afternoon))}</td>
                                <td>
                                    <span class="floorplan-table-status">
                                        <span class="legend-dot legend-${status}"></span>
                                        ${getStatusLabel(status)}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        elements.table.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                if (!key) return;
                const nextDir = overviewSort.key === key && overviewSort.dir === 'asc' ? 'desc' : 'asc';
                overviewSort = { key, dir: nextDir };
                renderTable();
            });
        });
    }

    function renderUserOptions(selectedId) {
        return `
            <option value="">Vrij</option>
            ${state.users.map(user => {
                return `<option value="${user.id}" ${selectedId === user.id ? 'selected' : ''}>${escapeHtml(user.name)}</option>`;
            }).join('')}
        `;
    }

    function setDay(day) {
        state.day = day;
        ensureDayState(day);
        updateDayTabs();
        saveState();
        renderAll();
    }

    function getDayAssignments(day) {
        ensureDayState(day);
        return state.days[day].assignments || {};
    }

    function setDayAssignments(day, deskId, assignments) {
        ensureDayState(day);
        state.days[day].assignments[deskId] = assignments;
        saveState();
        renderDesks();
        renderTable();
    }

    function getDeskStatus(deskId, day) {
        const assignments = getDayAssignments(day)[deskId] || { morning: null, afternoon: null };
        if (!assignments.morning && !assignments.afternoon) return 'free';
        if (assignments.morning && assignments.afternoon) return 'full';
        return 'partial';
    }

    function getUserName(userId) {
        if (!userId) return '-';
        const user = usersById[String(userId)];
        return user ? user.name : '-';
    }

    function getRoomLabel(roomId) {
        const room = getRoomById(roomId);
        return room ? room.label : 'Ruimte';
    }

    function getStatusLabel(status) {
        return STATUS_LABELS[status] || status;
    }

    function getRoomById(roomId) {
        return state.rooms.find(room => room.id === roomId);
    }

    function getSelectedDesk() {
        if (!state.selectedDeskId) return null;
        return state.desks.find(desk => desk.id === state.selectedDeskId) || null;
    }

    function isEditableTarget(target) {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    function onDeskKeydown(event) {
        if (isEditableTarget(event.target)) return;
        if (!state.selectedDeskId) return;
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;

        event.preventDefault();
        const desk = getSelectedDesk();
        if (!desk) return;
        if (!confirm('Deze werkplek verwijderen?')) return;
        deleteDesk(desk.id);
    }

    function selectDesk(event, deskId) {
        event.stopPropagation();
        state.selectedDeskId = deskId;
        renderDetails();
        highlightSelectedDesk();
    }

    function highlightSelectedDesk() {
        if (!elements.canvas) return;
        elements.canvas.querySelectorAll('.desk').forEach(deskEl => {
            const isSelected = deskEl.dataset.deskId === state.selectedDeskId;
            deskEl.classList.toggle('selected', isSelected);
        });
    }

    function deleteDesk(deskId) {
        state.desks = state.desks.filter(desk => desk.id !== deskId);
        delete state.days[state.day].assignments[deskId];
        state.selectedDeskId = null;
        saveState();
        renderAll();
    }

    function startDeskDrag(event, deskId) {
        const desk = state.desks.find(d => d.id === deskId);
        if (!desk) return;

        dragState = {
            id: deskId,
            startX: event.clientX,
            startY: event.clientY,
            originalX: desk.x,
            originalY: desk.y
        };

        document.addEventListener('mousemove', onDeskDrag);
        document.addEventListener('mouseup', stopDeskDrag);
    }

    function onDeskDrag(event) {
        if (!dragState) return;
        const desk = state.desks.find(d => d.id === dragState.id);
        if (!desk) return;

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;

        desk.x = snapToGrid(dragState.originalX + dx);
        desk.y = snapToGrid(dragState.originalY + dy);

        clampDeskToRoom(desk);
        renderDesks();
    }

    function stopDeskDrag() {
        if (!dragState) return;
        dragState = null;
        saveState();
        document.removeEventListener('mousemove', onDeskDrag);
        document.removeEventListener('mouseup', stopDeskDrag);
    }

    function startRoomDrag(event, roomId) {
        if (event.target.classList.contains('floorplan-room-handle')) return;

        const room = getRoomById(roomId);
        if (!room) return;

        roomDragState = {
            id: roomId,
            mode: 'move',
            startX: event.clientX,
            startY: event.clientY,
            originalX: room.x,
            originalY: room.y,
            originalW: room.w,
            originalH: room.h,
            desks: state.desks
                .filter(desk => desk.room === roomId)
                .map(desk => ({ id: desk.id, x: desk.x, y: desk.y }))
        };

        document.addEventListener('mousemove', onRoomDrag);
        document.addEventListener('mouseup', stopRoomDrag);
    }

    function startRoomResize(event, roomId) {
        event.stopPropagation();
        const room = getRoomById(roomId);
        if (!room) return;

        roomDragState = {
            id: roomId,
            mode: 'resize',
            startX: event.clientX,
            startY: event.clientY,
            originalX: room.x,
            originalY: room.y,
            originalW: room.w,
            originalH: room.h
        };

        document.addEventListener('mousemove', onRoomDrag);
        document.addEventListener('mouseup', stopRoomDrag);
    }

    function onRoomDrag(event) {
        if (!roomDragState || !elements.canvas) return;
        const room = getRoomById(roomDragState.id);
        if (!room) return;

        const dx = event.clientX - roomDragState.startX;
        const dy = event.clientY - roomDragState.startY;

        if (roomDragState.mode === 'move') {
            room.x = snapToGrid(roomDragState.originalX + dx);
            room.y = snapToGrid(roomDragState.originalY + dy);
            clampRoom(room);

            if (roomDragState.desks) {
                roomDragState.desks.forEach(item => {
                    const desk = state.desks.find(d => d.id === item.id);
                    if (!desk) return;
                    desk.x = snapToGrid(item.x + dx);
                    desk.y = snapToGrid(item.y + dy);
                    clampDeskToRoom(desk);
                });
            }
        } else {
            room.w = snapToGrid(Math.max(ROOM_MIN.w, roomDragState.originalW + dx));
            room.h = snapToGrid(Math.max(ROOM_MIN.h, roomDragState.originalH + dy));
            clampRoom(room);
            clampDesksToRoom(room.id);
        }

        renderRooms();
        renderDesks();
    }

    function stopRoomDrag() {
        if (!roomDragState) return;
        roomDragState = null;
        saveState();
        document.removeEventListener('mousemove', onRoomDrag);
        document.removeEventListener('mouseup', stopRoomDrag);
    }

    function clampDeskToRoom(desk) {
        const room = getRoomById(desk.room);
        if (!room) return;
        const rotation = typeof desk.rotation === 'number' ? desk.rotation : 0;
        const normalized = ((rotation % 360) + 360) % 360;
        const rotated = normalized === 90 || normalized === 270;
        const deskWidth = rotated ? desk.h : desk.w;
        const deskHeight = rotated ? desk.w : desk.h;
        const minCenterX = room.x + DESK_BORDER + deskWidth / 2;
        const minCenterY = room.y + DESK_BORDER + deskHeight / 2;
        const maxCenterX = room.x + room.w - DESK_BORDER - deskWidth / 2;
        const maxCenterY = room.y + room.h - DESK_BORDER - deskHeight / 2;
        const centerX = clamp(desk.x + desk.w / 2, minCenterX, maxCenterX);
        const centerY = clamp(desk.y + desk.h / 2, minCenterY, maxCenterY);
        desk.x = centerX - desk.w / 2;
        desk.y = centerY - desk.h / 2;
    }

    function clampDesksToRoom(roomId) {
        const room = getRoomById(roomId);
        if (!room) return;
        state.desks.forEach(desk => {
            if (desk.room === roomId) {
                clampDeskToRoom(desk);
            }
        });
    }

    function clampRoom(room) {
        if (!elements.canvas) return;
        const maxX = elements.canvas.clientWidth - room.w;
        const maxY = elements.canvas.clientHeight - room.h;
        room.x = clamp(room.x, 0, Math.max(0, maxX));
        room.y = clamp(room.y, 0, Math.max(0, maxY));
    }

    function snapToGrid(value) {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    function getDefaultRooms() {
        return ROOMS.map(room => ({ ...room }));
    }

    function migrateLegacyDayLayouts() {
        if (!state.days || !state.rooms || !state.desks) return;
        if (state.days.default) {
            state.days.monday = state.days.default;
            delete state.days.default;
        }
    }

    function isEmptyFloorplan(payload) {
        return (!payload || !payload.desks || payload.desks.length === 0);
    }

    function getExportLegend() {
        const legend = [];
        const dayKey = overviewDay || state.day;
        const assignments = getDayAssignments(dayKey);

        state.desks.forEach(desk => {
            const slots = assignments[desk.id] || {};
            if (slots.morning) {
                legend.push({
                    user: getUserName(slots.morning),
                    desk: desk.name || 'Werkplek',
                    room: getRoomLabel(desk.room),
                    slot: 'Ochtend'
                });
            }
            if (slots.afternoon) {
                legend.push({
                    user: getUserName(slots.afternoon),
                    desk: desk.name || 'Werkplek',
                    room: getRoomLabel(desk.room),
                    slot: 'Middag'
                });
            }
        });

        legend.sort((a, b) => a.user.localeCompare(b.user));
        return legend;
    }

    function getExportDay() {
        return overviewDay || state.day;
    }

    function getDayLabel(day) {
        return DAY_LABELS[day] || day;
    }

    window.FloorplanAPI = {
        getCanvas: () => elements.canvas,
        getExportDay,
        getDayLabel,
        getExportLegend
    };

    function compareValues(a, b, dir) {
        if (a === b) return 0;
        if (a === null || a === undefined) return dir === 'asc' ? 1 : -1;
        if (b === null || b === undefined) return dir === 'asc' ? -1 : 1;
        const textA = String(a).toLowerCase();
        const textB = String(b).toLowerCase();
        if (textA < textB) return dir === 'asc' ? -1 : 1;
        if (textA > textB) return dir === 'asc' ? 1 : -1;
        return 0;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function scheduleServerSave() {
        if (!API.saveFloorplan) return;
        if (saveTimer) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(async () => {
            try {
                await API.saveFloorplan(serializeState());
            } catch (err) {
                console.warn('Failed to save floorplan to server', err);
            }
        }, 800);
    }

    async function syncFromServer() {
        if (!API.fetchFloorplan) return;
        try {
            const response = await API.fetchFloorplan();
            if (response && response.data) {
                applyServerState(response.data);
                saveState();
                renderAll();
                return;
            }

            if (!isEmptyFloorplan(state)) {
                await API.saveFloorplan(serializeState());
            }
        } catch (err) {
            console.warn('Floorplan server sync skipped', err);
        }
    }

    function applyServerState(payload) {
        if (!payload || typeof payload !== 'object') return;
        state = {
            ...state,
            ...payload,
            day: payload.day || state.day,
            rooms: payload.rooms || state.rooms,
            desks: payload.desks || state.desks,
            days: payload.days || state.days
        };
        migrateLegacyDayLayouts();
        ensureDayState(state.day);
        overviewDay = state.day;
        populateRoomSelect();
        updateDayTabs();
        updateOverviewTabs();
    }

    function serializeState() {
        return {
            day: state.day,
            days: state.days,
            rooms: state.rooms,
            desks: state.desks
        };
    }

    window.addEventListener('resize', () => {
        state.rooms.forEach(room => clampRoom(room));
        state.desks.forEach(desk => clampDeskToRoom(desk));
        renderAll();
    });

    window.LegacyFloorplanMount = mountOrRefresh;
    mountOrRefresh();
})();
