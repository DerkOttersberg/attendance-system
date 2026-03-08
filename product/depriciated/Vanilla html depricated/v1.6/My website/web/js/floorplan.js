(() => {
    const STORAGE_KEY = 'floorplan_state_v1';
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const GRID_SIZE = 20;
    const DESK_SIZE = { w: 80, h: 50 };
    const ROOM_MIN = { w: 160, h: 120 };
    const ROOMS = [
        { id: 'server', label: 'Server Room (6 desks)', x: 20, y: 20, w: 220, h: 140 },
        { id: 'large', label: 'Large Room (16 desks)', x: 280, y: 20, w: 520, h: 240 },
        { id: 'small', label: 'Side Room (8 desks)', x: 20, y: 200, w: 220, h: 220 }
    ];

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

    function init() {
        elements = {
            canvas: document.getElementById('floorplanCanvas'),
            dayTabs: Array.from(document.querySelectorAll('.floorplan-day-tab')),
            roomSelect: document.getElementById('floorplanRoom'),
            details: document.getElementById('floorplanDetails'),
            table: document.getElementById('floorplanTable'),
            overviewTabs: Array.from(document.querySelectorAll('.floorplan-overview-tab')),
            overviewDayTabs: Array.from(document.querySelectorAll('.floorplan-overview-day-tab')),
            addDeskBtn: document.getElementById('addDeskBtn'),
            resetDayBtn: document.getElementById('resetDayBtn')
        };

        if (!elements.canvas) return;

        loadState();
        ensureDayState(state.day);
        overviewDay = state.day;
        populateRoomSelect();
        bindEvents();
        updateDayTabs();
        updateOverviewTabs();
        loadUsers();
        renderAll();
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

        if (elements.addDeskBtn) {
            elements.addDeskBtn.addEventListener('click', () => {
                const defaultRoom = state.rooms && state.rooms.length > 0 ? state.rooms[0].id : ROOMS[0].id;
                addDesk(elements.roomSelect ? elements.roomSelect.value : defaultRoom);
            });
        }

        if (elements.resetDayBtn) {
            elements.resetDayBtn.addEventListener('click', () => {
                if (!confirm('Reset this day? This clears assignments for the selected day.')) return;
                state.days[state.day] = { assignments: {} };
                state.selectedDeskId = null;
                saveState();
                renderAll();
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
    }

    async function loadUsers() {
        try {
            if (window.State && Array.isArray(window.State.allUsers) && window.State.allUsers.length > 0) {
                state.users = window.State.allUsers;
            } else {
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

        renderDetails();
        renderTable();
    }

    function addDesk(roomId) {
        const room = state.rooms.find(r => r.id === roomId) || state.rooms[0];
        const deskId = `desk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const deskCount = state.desks.length + 1;
        const position = findNextDeskPosition(room, state.desks);

        const newDesk = {
            id: deskId,
            name: `Desk ${deskCount}`,
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

    function renderAll() {
        renderCanvas();
        renderDetails();
        renderTable();
    }

    function renderCanvas() {
        if (!elements.canvas) return;
        elements.canvas.innerHTML = '';

        state.rooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'floorplan-room';
            roomEl.style.left = `${room.x}px`;
            roomEl.style.top = `${room.y}px`;
            roomEl.style.width = `${room.w}px`;
            roomEl.style.height = `${room.h}px`;
            roomEl.dataset.roomId = room.id;
            const label = document.createElement('div');
            label.className = 'floorplan-room-label';
            label.textContent = room.label;
            const handle = document.createElement('div');
            handle.className = 'floorplan-room-handle';
            handle.title = 'Resize room';
            handle.addEventListener('pointerdown', event => handleRoomResizePointerDown(event, room.id));
            roomEl.appendChild(label);
            roomEl.appendChild(handle);
            roomEl.addEventListener('pointerdown', event => handleRoomPointerDown(event, room.id));
            elements.canvas.appendChild(roomEl);
        });

        state.desks.forEach(desk => {
            const deskEl = document.createElement('div');
            deskEl.className = `desk ${getDeskStatusClass(desk, state.day)}`;
            const footprint = getDeskFootprint(desk);
            deskEl.style.left = `${desk.x}px`;
            deskEl.style.top = `${desk.y}px`;
            deskEl.style.width = `${footprint.w}px`;
            deskEl.style.height = `${footprint.h}px`;
            deskEl.dataset.id = desk.id;

            const body = document.createElement('div');
            body.className = 'desk-body';
            body.style.width = `${desk.w}px`;
            body.style.height = `${desk.h}px`;
            body.style.transform = `translate(-50%, -50%) rotate(${desk.rotation || 0}deg)`;

            const label = document.createElement('div');
            label.className = 'desk-label';
            label.textContent = desk.name || 'Desk';
            label.style.transform = `rotate(${-(desk.rotation || 0)}deg)`;

            body.appendChild(label);
            deskEl.appendChild(body);

            deskEl.addEventListener('pointerdown', event => handleDeskPointerDown(event, desk.id));
            deskEl.addEventListener('click', () => selectDesk(desk.id));
            elements.canvas.appendChild(deskEl);
        });

        highlightSelectedDesk();
    }

    function highlightSelectedDesk() {
        if (!elements.canvas) return;
        elements.canvas.querySelectorAll('.desk').forEach(deskEl => {
            const isSelected = deskEl.dataset.id === state.selectedDeskId;
            deskEl.classList.toggle('selected', isSelected);
        });
    }

    function selectDesk(deskId) {
        state.selectedDeskId = deskId;
        renderDetails();
        highlightSelectedDesk();
    }

    function renderDetails() {
        if (!elements.details) return;
        const desk = getSelectedDesk();
        if (!desk) {
            elements.details.innerHTML = `
                <div class="floorplan-empty">
                    Select a desk to edit it. You can add desks with the button above and drag them on the grid.
                </div>
            `;
            return;
        }

        const assignments = getDeskAssignments(desk.id, state.day);

        elements.details.innerHTML = `
            <div>
                <label for="deskName">Desk name</label>
                <input id="deskName" type="text" />
            </div>
            <div>
                <label for="deskRotation">Rotation</label>
                <select id="deskRotation">
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                </select>
            </div>
            <div>
                <label for="deskRoom">Room</label>
                <select id="deskRoom">
                    ${state.rooms.map(room => `
                        <option value="${room.id}" ${room.id === desk.room ? 'selected' : ''}>${room.label}</option>
                    `).join('')}
                </select>
            </div>
            <div class="slot-row">
                <label for="deskMorning">Morning slot</label>
                <select id="deskMorning">
                    ${renderUserOptions(assignments.morning)}
                </select>
            </div>
            <div class="slot-row">
                <label for="deskAfternoon">Afternoon slot</label>
                <select id="deskAfternoon">
                    ${renderUserOptions(assignments.afternoon)}
                </select>
            </div>
            <div class="slot-actions">
                <button class="btn btn-secondary" id="clearMorningBtn">Clear morning</button>
                <button class="btn btn-secondary" id="clearAfternoonBtn">Clear afternoon</button>
            </div>
            <div>
                <button class="btn btn-danger" id="deleteDeskBtn">Remove desk</button>
            </div>
        `;

        const nameInput = document.getElementById('deskName');
        const rotationSelect = document.getElementById('deskRotation');
        const roomSelect = document.getElementById('deskRoom');
        const morningSelect = document.getElementById('deskMorning');
        const afternoonSelect = document.getElementById('deskAfternoon');
        const clearMorningBtn = document.getElementById('clearMorningBtn');
        const clearAfternoonBtn = document.getElementById('clearAfternoonBtn');
        const deleteDeskBtn = document.getElementById('deleteDeskBtn');

        if (nameInput) {
            nameInput.value = desk.name || '';
            nameInput.addEventListener('input', event => {
                desk.name = event.target.value.trim() || 'Desk';
                saveState();
                renderCanvas();
                renderTable();
            });
        }

        if (rotationSelect) {
            rotationSelect.value = String(desk.rotation || 0);
            rotationSelect.addEventListener('change', event => {
                desk.rotation = parseInt(event.target.value, 10) || 0;
                saveState();
                renderCanvas();
                renderTable();
            });
        }

        if (roomSelect) {
            roomSelect.addEventListener('change', event => {
                desk.room = event.target.value;
                clampDesksToRoom(desk.room);
                saveState();
                renderCanvas();
                renderTable();
            });
        }

        if (morningSelect) {
            morningSelect.addEventListener('change', event => {
                setDeskAssignment(desk.id, state.day, 'morning', normalizeUserValue(event.target.value));
                saveState();
                renderCanvas();
                renderTable();
            });
        }

        if (afternoonSelect) {
            afternoonSelect.addEventListener('change', event => {
                setDeskAssignment(desk.id, state.day, 'afternoon', normalizeUserValue(event.target.value));
                saveState();
                renderCanvas();
                renderTable();
            });
        }

        if (clearMorningBtn) {
            clearMorningBtn.addEventListener('click', () => {
                setDeskAssignment(desk.id, state.day, 'morning', null);
                saveState();
                renderDetails();
                renderCanvas();
                renderTable();
            });
        }

        if (clearAfternoonBtn) {
            clearAfternoonBtn.addEventListener('click', () => {
                setDeskAssignment(desk.id, state.day, 'afternoon', null);
                saveState();
                renderDetails();
                renderCanvas();
                renderTable();
            });
        }

        if (deleteDeskBtn) {
            deleteDeskBtn.addEventListener('click', () => {
                removeDesk(desk.id);
            });
        }
    }

    function renderTable() {
        if (!elements.table) return;
        const desks = [...state.desks];
        if (desks.length === 0) {
            elements.table.innerHTML = '<div class="no-data">No desks added yet.</div>';
            return;
        }

        desks.sort((a, b) => {
            const roomOrder = getRoomOrder(a.room) - getRoomOrder(b.room);
            if (roomOrder !== 0) return roomOrder;
            if (a.y !== b.y) return a.y - b.y;
            if (a.x !== b.x) return a.x - b.x;
            return (a.name || '').localeCompare(b.name || '');
        });

        const activeDay = overviewDay || state.day;
        const rows = desks.map(desk => {
            const assignments = getDeskAssignments(desk.id, activeDay);
            const status = getDeskStatus(assignments);
            const freeSlots = [];
            if (!assignments.morning) freeSlots.push('Morning');
            if (!assignments.afternoon) freeSlots.push('Afternoon');

            if (overviewMode === 'free' && freeSlots.length === 0) {
                return '';
            }

            if (overviewMode === 'free') {
                return `
                    <tr>
                        <td><strong>${escapeHtml(desk.name || 'Desk')}</strong></td>
                        <td>${escapeHtml(getRoomLabel(desk.room))}</td>
                        <td>${escapeHtml(freeSlots.join(', ')) || '-'}</td>
                        <td>${escapeHtml(getUserName(assignments.morning))}</td>
                        <td>${escapeHtml(getUserName(assignments.afternoon))}</td>
                        <td>
                            <span class="floorplan-table-status">
                                <span class="legend-dot ${status.dot}"></span>
                                ${status.label}
                            </span>
                        </td>
                        <td><button class="btn btn-secondary" data-select-desk="${desk.id}">Select</button></td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td><strong>${escapeHtml(desk.name || 'Desk')}</strong></td>
                    <td>${escapeHtml(getRoomLabel(desk.room))}</td>
                    <td>${escapeHtml(getUserName(assignments.morning))}</td>
                    <td>${escapeHtml(getUserName(assignments.afternoon))}</td>
                    <td>
                        <span class="floorplan-table-status">
                            <span class="legend-dot ${status.dot}"></span>
                            ${status.label}
                        </span>
                    </td>
                    <td><button class="btn btn-secondary" data-select-desk="${desk.id}">Select</button></td>
                </tr>
            `;
        }).filter(Boolean).join('');

        const headerRow = overviewMode === 'free'
            ? `
                <tr>
                    <th>Desk</th>
                    <th>Room</th>
                    <th>Free Slots</th>
                    <th>Morning</th>
                    <th>Afternoon</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            `
            : `
                <tr>
                    <th>Desk</th>
                    <th>Room</th>
                    <th>Morning</th>
                    <th>Afternoon</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            `;

        if (!rows) {
            elements.table.innerHTML = '<div class="no-data">No desks match this view.</div>';
            return;
        }

        elements.table.innerHTML = `
            <table>
                <thead>
                    ${headerRow}
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        elements.table.querySelectorAll('[data-select-desk]').forEach(button => {
            button.addEventListener('click', event => {
                const deskId = event.currentTarget.getAttribute('data-select-desk');
                selectDesk(deskId);
            });
        });
    }

    function handleDeskPointerDown(event, deskId) {
        event.preventDefault();
        selectDesk(deskId);

        const desk = findDeskById(deskId);
        if (!desk || !elements.canvas) return;

        const canvasRect = elements.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasRect.left;
        const pointerY = event.clientY - canvasRect.top;

        const deskEl = event.currentTarget;

        dragState = {
            deskId,
            deskEl,
            startX: pointerX,
            startY: pointerY,
            originX: desk.x,
            originY: desk.y
        };

        if (deskEl && deskEl.setPointerCapture) {
            deskEl.setPointerCapture(event.pointerId);
        }

        window.addEventListener('pointermove', handleDeskPointerMove);
        window.addEventListener('pointerup', handleDeskPointerUp);
    }

    function handleDeskPointerMove(event) {
        if (!dragState || !elements.canvas) return;

        const canvasRect = elements.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasRect.left;
        const pointerY = event.clientY - canvasRect.top;
        const deltaX = pointerX - dragState.startX;
        const deltaY = pointerY - dragState.startY;

        const desk = findDeskById(dragState.deskId);
        if (!desk) return;

        const roomBounds = getRoomBounds(desk.room);
        const footprint = getDeskFootprint(desk);
        const maxX = roomBounds.x + roomBounds.w - footprint.w;
        const maxY = roomBounds.y + roomBounds.h - footprint.h;

        const nextX = clamp(dragState.originX + deltaX, roomBounds.x, maxX);
        const nextY = clamp(dragState.originY + deltaY, roomBounds.y, maxY);

        desk.x = nextX;
        desk.y = nextY;

        if (dragState.deskEl) {
            dragState.deskEl.style.left = `${desk.x}px`;
            dragState.deskEl.style.top = `${desk.y}px`;
        }
    }

    function handleDeskPointerUp(event) {
        if (!dragState || !elements.canvas) return;

        const desk = findDeskById(dragState.deskId);
        if (desk) {
            const roomBounds = getRoomBounds(desk.room);
            const footprint = getDeskFootprint(desk);
            const maxX = roomBounds.x + roomBounds.w - footprint.w;
            const maxY = roomBounds.y + roomBounds.h - footprint.h;
            desk.x = clamp(snapToGrid(desk.x), roomBounds.x, maxX);
            desk.y = clamp(snapToGrid(desk.y), roomBounds.y, maxY);
            saveState();
            renderCanvas();
        }

        dragState = null;
        window.removeEventListener('pointermove', handleDeskPointerMove);
        window.removeEventListener('pointerup', handleDeskPointerUp);
    }

    function removeDesk(deskId) {
        state.desks = state.desks.filter(desk => desk.id !== deskId);
        DAYS.forEach(day => {
            if (state.days[day] && state.days[day].assignments) {
                delete state.days[day].assignments[deskId];
            }
        });
        if (state.selectedDeskId === deskId) {
            state.selectedDeskId = null;
        }
        saveState();
        renderAll();
    }

    function getSelectedDesk() {
        return findDeskById(state.selectedDeskId);
    }

    function findDeskById(deskId) {
        if (!deskId) return null;
        return state.desks.find(desk => desk.id === deskId) || null;
    }

    function normalizeUserValue(value) {
        if (!value) return null;
        return String(value);
    }

    function renderUserOptions(selectedId) {
        const selected = selectedId ? String(selectedId) : '';
        const options = state.users.map(user => {
            const userId = String(user.id);
            const name = escapeHtml(user.name || `User ${user.id}`);
            return `<option value="${userId}" ${userId === selected ? 'selected' : ''}>${name}</option>`;
        }).join('');

        return `
            <option value="">Unassigned</option>
            ${options}
        `;
    }

    function getDeskStatusClass(desk, day) {
        const assignments = getDeskAssignments(desk.id, day);
        const status = getDeskStatus(assignments);
        if (status.key === 'free') return 'desk-status-free';
        if (status.key === 'partial') return 'desk-status-partial';
        return 'desk-status-full';
    }

    function getDeskStatus(assignments) {
        const hasMorning = Boolean(assignments.morning);
        const hasAfternoon = Boolean(assignments.afternoon);

        if (!hasMorning && !hasAfternoon) {
            return { key: 'free', label: 'Free', dot: 'legend-free' };
        }
        if (hasMorning && hasAfternoon) {
            return { key: 'full', label: 'Full', dot: 'legend-full' };
        }
        return { key: 'partial', label: 'One slot', dot: 'legend-partial' };
    }

    function getRoomLabel(roomId) {
        const room = state.rooms.find(r => r.id === roomId);
        return room ? room.label : roomId;
    }

    function getRoomOrder(roomId) {
        const index = state.rooms.findIndex(r => r.id === roomId);
        return index === -1 ? 999 : index;
    }

    function getUserName(userId) {
        if (!userId) return '-';
        const user = usersById[String(userId)];
        return user ? (user.name || `User ${user.id}`) : 'Unknown';
    }

    function snapToGrid(value) {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    function getRoomBounds(roomId) {
        const room = state.rooms.find(r => r.id === roomId) || state.rooms[0];
        return {
            x: room.x,
            y: room.y,
            w: room.w,
            h: room.h
        };
    }

    function handleRoomPointerDown(event, roomId) {
        if (event.target && event.target.closest('.floorplan-room-handle')) return;
        event.preventDefault();

        const room = getRoomById(roomId);
        if (!room || !elements.canvas) return;

        const canvasRect = elements.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasRect.left;
        const pointerY = event.clientY - canvasRect.top;

        const roomEl = event.currentTarget;
        roomDragState = {
            type: 'move',
            roomId,
            roomEl,
            startX: pointerX,
            startY: pointerY,
            originX: room.x,
            originY: room.y,
            totalDeltaX: 0,
            totalDeltaY: 0
        };

        if (roomEl && roomEl.setPointerCapture) {
            roomEl.setPointerCapture(event.pointerId);
        }

        window.addEventListener('pointermove', handleRoomPointerMove);
        window.addEventListener('pointerup', handleRoomPointerUp);
    }

    function handleRoomResizePointerDown(event, roomId) {
        event.preventDefault();
        event.stopPropagation();

        const room = getRoomById(roomId);
        if (!room || !elements.canvas) return;

        const canvasRect = elements.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasRect.left;
        const pointerY = event.clientY - canvasRect.top;

        const roomEl = event.currentTarget.parentElement;
        roomDragState = {
            type: 'resize',
            roomId,
            roomEl,
            startX: pointerX,
            startY: pointerY,
            originX: room.x,
            originY: room.y,
            originW: room.w,
            originH: room.h
        };

        if (roomEl && roomEl.setPointerCapture) {
            roomEl.setPointerCapture(event.pointerId);
        }

        window.addEventListener('pointermove', handleRoomPointerMove);
        window.addEventListener('pointerup', handleRoomPointerUp);
    }

    function handleRoomPointerMove(event) {
        if (!roomDragState || !elements.canvas) return;

        const canvasRect = elements.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasRect.left;
        const pointerY = event.clientY - canvasRect.top;
        const deltaX = pointerX - roomDragState.startX;
        const deltaY = pointerY - roomDragState.startY;

        const room = getRoomById(roomDragState.roomId);
        if (!room) return;

        if (roomDragState.type === 'move') {
            const maxX = Math.max(0, elements.canvas.clientWidth - room.w);
            const maxY = Math.max(0, elements.canvas.clientHeight - room.h);

            const nextX = clamp(snapToGrid(roomDragState.originX + deltaX), 0, maxX);
            const nextY = clamp(snapToGrid(roomDragState.originY + deltaY), 0, maxY);

            const stepX = nextX - room.x;
            const stepY = nextY - room.y;

            room.x = nextX;
            room.y = nextY;
            roomDragState.totalDeltaX = room.x - roomDragState.originX;
            roomDragState.totalDeltaY = room.y - roomDragState.originY;

            if (roomDragState.roomEl) {
                roomDragState.roomEl.style.left = `${room.x}px`;
                roomDragState.roomEl.style.top = `${room.y}px`;
            }

            if (stepX !== 0 || stepY !== 0) {
                shiftDesksForRoom(room.id, stepX, stepY);
                updateDeskElementsPositions(room.id);
            }
        }

        if (roomDragState.type === 'resize') {
            const maxW = Math.max(ROOM_MIN.w, elements.canvas.clientWidth - room.x);
            const maxH = Math.max(ROOM_MIN.h, elements.canvas.clientHeight - room.y);

            const nextW = clamp(snapToGrid(roomDragState.originW + deltaX), ROOM_MIN.w, maxW);
            const nextH = clamp(snapToGrid(roomDragState.originH + deltaY), ROOM_MIN.h, maxH);

            room.w = nextW;
            room.h = nextH;

            if (roomDragState.roomEl) {
                roomDragState.roomEl.style.width = `${room.w}px`;
                roomDragState.roomEl.style.height = `${room.h}px`;
            }
        }
    }

    function handleRoomPointerUp() {
        if (!roomDragState) return;

        const room = getRoomById(roomDragState.roomId);
        if (room) {
            if (roomDragState.type === 'resize') {
                clampDesksToRoom(room.id);
            }
        }

        saveState();
        renderCanvas();

        roomDragState = null;
        window.removeEventListener('pointermove', handleRoomPointerMove);
        window.removeEventListener('pointerup', handleRoomPointerUp);
    }

    function getRoomById(roomId) {
        return state.rooms.find(room => room.id === roomId) || null;
    }

    function shiftDesksForRoom(roomId, deltaX, deltaY) {
        state.desks.forEach(desk => {
            if (desk.room !== roomId) return;
            desk.x += deltaX;
            desk.y += deltaY;
        });

        clampDesksToRoom(roomId);
    }

    function clampDesksToRoom(roomId) {
        const bounds = getRoomBounds(roomId);
        state.desks.forEach(desk => {
            if (desk.room !== roomId) return;
            const footprint = getDeskFootprint(desk);
            const maxX = bounds.x + bounds.w - footprint.w;
            const maxY = bounds.y + bounds.h - footprint.h;
            desk.x = clamp(desk.x, bounds.x, maxX);
            desk.y = clamp(desk.y, bounds.y, maxY);
        });
    }

    function updateDeskElementsPositions(roomId) {
        if (!elements.canvas) return;

        state.desks.forEach(desk => {
            if (desk.room !== roomId) return;
            const deskEl = elements.canvas.querySelector(`.desk[data-id="${desk.id}"]`);
            if (!deskEl) return;
            deskEl.style.left = `${desk.x}px`;
            deskEl.style.top = `${desk.y}px`;
        });
    }

    function getDeskFootprint(desk) {
        const rotation = (desk.rotation || 0) % 180;
        if (rotation !== 0) {
            return { w: desk.h, h: desk.w };
        }
        return { w: desk.w, h: desk.h };
    }

    function getDeskAssignments(deskId, day) {
        ensureDayState(day);
        const dayState = state.days[day];
        const assignments = dayState.assignments[deskId];
        return assignments || { morning: null, afternoon: null };
    }

    function setDeskAssignment(deskId, day, slot, value) {
        ensureDayState(day);
        if (!state.days[day].assignments[deskId]) {
            state.days[day].assignments[deskId] = { morning: null, afternoon: null };
        }
        state.days[day].assignments[deskId][slot] = value;
    }

    function setDay(day) {
        if (!DAYS.includes(day)) return;
        state.day = day;
        ensureDayState(state.day);
        state.selectedDeskId = null;
        overviewDay = day;
        updateDayTabs();
        updateOverviewTabs();
        renderAll();
    }

    function updateDayTabs() {
        if (!elements.dayTabs || elements.dayTabs.length === 0) return;
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
        if (!window.API || !API.saveFloorplan) return;
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
        if (!window.API || !API.fetchFloorplan) return;
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

    function isEmptyFloorplan(currentState) {
        const desksEmpty = !currentState.desks || currentState.desks.length === 0;
        const roomsEmpty = !currentState.rooms || currentState.rooms.length === 0;
        return desksEmpty && roomsEmpty;
    }

    function getDefaultRooms() {
        return ROOMS.map(room => ({
            id: room.id,
            label: room.label,
            x: room.x,
            y: room.y,
            w: room.w,
            h: room.h
        }));
    }

    function migrateLegacyDayLayouts() {
        const legacyDays = Object.values(state.days || {}).filter(dayState => Array.isArray(dayState.desks) && dayState.desks.length > 0);
        if (state.desks && state.desks.length > 0) {
            DAYS.forEach(day => {
                if (state.days[day] && !state.days[day].assignments) {
                    state.days[day].assignments = {};
                }
            });
            return;
        }

        if (legacyDays.length === 0) {
            state.desks = state.desks || [];
            DAYS.forEach(day => ensureDayState(day));
            return;
        }

        const layoutSource = legacyDays[0];
        state.desks = layoutSource.desks.map(desk => ({
            id: desk.id,
            name: desk.name,
            room: desk.room,
            x: desk.x,
            y: desk.y,
            w: desk.w,
            h: desk.h,
            rotation: desk.rotation || 0
        }));

        DAYS.forEach(day => {
            ensureDayState(day);
            const dayState = state.days[day];
            dayState.assignments = dayState.assignments || {};
            if (Array.isArray(dayState.desks)) {
                dayState.desks.forEach(desk => {
                    dayState.assignments[desk.id] = {
                        morning: desk.slots ? desk.slots.morning : null,
                        afternoon: desk.slots ? desk.slots.afternoon : null
                    };
                });
                delete dayState.desks;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
