// Filter Management
const Filters = {
    async applyFilters() {
        const userId = document.getElementById('filterUser').value;
        const department = document.getElementById('filterDepartment').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const product = document.getElementById('filterProduct').value;

        const content = document.getElementById('allContent');
        content.innerHTML = '<div class="loading">Filtering...</div>';

        try {
            const filteredData = await API.fetchFilteredAttendance(userId, department, startDate, endDate, product);
            State.filteredAttendanceData = filteredData;

            const userName = userId ? State.allUsers.find(u => u.id == userId)?.name : 'All Users';
            const deptName = department ? State.departments.find(d => d.name === department)?.name : 'All Departments';
            const productName = product || 'All Products';
            const dateRange = startDate || endDate ? 
                `${startDate || 'Beginning'} to ${endDate || 'Today'}` : 'All Time';

            document.getElementById('filterResults').innerHTML = `
                <div class="results-summary">
                    <div>
                        Showing <strong>${filteredData.length}</strong> records for 
                        <strong>${userName}</strong> / <strong>${deptName}</strong> / <strong>${productName}</strong> (${dateRange})
                    </div>
                </div>
            `;

            content.innerHTML = UI.renderAttendanceTable(filteredData);
        } catch (error) {
            console.error('Error filtering attendance:', error);
            content.innerHTML = '<div class="error">Failed to filter attendance data</div>';
        }
    },

    clearFilters() {
        document.getElementById('filterUser').value = '';
        document.getElementById('filterDepartment').value = '';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterProduct').value = '';
        document.getElementById('filterResults').innerHTML = '';
        
        State.filteredAttendanceData = State.allAttendanceData;
        document.getElementById('allContent').innerHTML = UI.renderAttendanceTable(State.allAttendanceData);
    }
};

// Expose to global scope
window.applyFilters = () => Filters.applyFilters();
window.clearFilters = () => Filters.clearFilters();

// Attendance Selection Management
function toggleSelectAllAttendance(checkbox) {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateAttendanceSelectionUI();
}

function toggleRowSelection(event, recordId) {
    // Only toggle if clicking on the row itself, not on checkbox or signature
    if (event.target.tagName === 'INPUT' || event.target.closest('.signature-preview')) {
        return;
    }
    
    const checkbox = document.querySelector(`.attendance-checkbox[data-id="${recordId}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateAttendanceSelectionUI();
    }
}

function toggleSelectAllAttendance(checkbox) {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateAttendanceSelectionUI();
}

function updateAttendanceSelectionUI() {
    const checkboxes = Array.from(document.querySelectorAll('.attendance-checkbox'));
    const selectedCount = checkboxes.filter(cb => cb.checked).length;
    const selectAllCheckbox = document.getElementById('attendanceSelectAll');
    
    // Update select all checkbox state
    if (selectAllCheckbox) {
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
        selectAllCheckbox.checked = selectedCount === checkboxes.length && checkboxes.length > 0;
    }
    
    // Highlight selected rows
    document.querySelectorAll('.attendance-row').forEach(row => {
        const checkbox = row.querySelector('.attendance-checkbox');
        if (checkbox && checkbox.checked) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    });
    
    // Update or create results summary
    let resultsSummary = document.querySelector('.results-summary');
    if (!resultsSummary) {
        resultsSummary = document.createElement('div');
        resultsSummary.className = 'results-summary';
        const filterResults = document.getElementById('filterResults');
        if (filterResults) {
            filterResults.appendChild(resultsSummary);
        }
    }
    
    if (resultsSummary) {
        if (selectedCount > 0) {
            resultsSummary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${selectedCount}</strong> record(s) selected
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-success" onclick="exportSelectedToPDF()" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">📄 Export Selected</button>
                        <button class="btn btn-danger" onclick="deleteSelectedAttendance()" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">🗑️ Delete Selected</button>
                    </div>
                </div>
            `;
        } else {
            resultsSummary.innerHTML = '';
        }
    }
}

function getSelectedAttendanceRecords() {
    const checkboxes = Array.from(document.querySelectorAll('.attendance-checkbox:checked'));
    return checkboxes.map(cb => parseInt(cb.getAttribute('data-id')));
}

async function deleteSelectedAttendance() {
    const selectedIds = getSelectedAttendanceRecords();
    if (selectedIds.length === 0) {
        alert('No records selected');
        return;
    }
    
    if (!confirm(`Delete ${selectedIds.length} attendance record(s)? This action cannot be undone.`)) {
        return;
    }
    
    try {
        document.getElementById('allContent').innerHTML = '<div class="loading">Deleting records...</div>';
        await API.deleteAttendanceRecords(selectedIds);
        
        // Reload data
        await loadAllAttendance();
        clearAttendanceSelection();
    } catch (error) {
        console.error('Error deleting attendance records:', error);
        document.getElementById('allContent').innerHTML = '<div class="error">Failed to delete records: ' + error.message + '</div>';
    }
}

function clearAttendanceSelection() {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('attendanceSelectAll');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateAttendanceSelectionUI();
}

async function exportSelectedToPDF() {
    const selectedIds = getSelectedAttendanceRecords();
    if (selectedIds.length === 0) {
        alert('No records selected');
        return;
    }
    
    // Get all attendance records (both filtered and all)
    const allRecords = State.allAttendanceData || State.filteredAttendanceData || [];
    const selectedRecords = allRecords.filter(r => selectedIds.includes(r.id));
    
    if (selectedRecords.length === 0) {
        alert('Selected records not found');
        return;
    }
    
    // Use the new export layout from Export object
    await Export.generatePDFWithLayout(selectedRecords, 'Selected Records');
}

// Manual Attendance Management
let signatureCanvas = null;
let signatureContext = null;
let isDrawing = false;

function showManualAttendanceModal() {
    const modal = document.getElementById('manualAttendanceModal');
    const userSelect = document.getElementById('manualUser');
    
    // Populate user dropdown
    userSelect.innerHTML = '<option value="">Select User...</option>' +
        State.allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    
    // Set default date to today
    document.getElementById('manualDate').valueAsDate = new Date();
    document.getElementById('manualClockIn').value = '';
    document.getElementById('manualClockOut').value = '';
    document.getElementById('manualAttendanceMessage').style.display = 'none';
    document.getElementById('manualAttendanceMessage').innerHTML = '';
    
    modal.classList.add('active');
    
    // Initialize canvas if not already done
    setTimeout(() => {
        initializeSignatureCanvas();
    }, 100);
}

function closeManualAttendanceModal(event) {
    if (event && event.target.id !== 'manualAttendanceModal') return;
    
    document.getElementById('manualAttendanceModal').classList.remove('active');
    cleanupSignatureCanvas();
}

function initializeSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    signatureCanvas = canvas;
    signatureContext = canvas.getContext('2d');
    signatureContext.strokeStyle = '#1e293b';
    signatureContext.lineWidth = 2;
    signatureContext.lineCap = 'round';
    signatureContext.lineJoin = 'round';
    
    // Clear canvas
    signatureContext.fillStyle = 'white';
    signatureContext.fillRect(0, 0, canvas.width, canvas.height);
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    signatureContext.beginPath();
    signatureContext.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = signatureCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    signatureContext.lineTo(x, y);
    signatureContext.stroke();
}

function stopDrawing() {
    isDrawing = false;
    if (signatureContext) signatureContext.closePath();
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = signatureCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    isDrawing = true;
    signatureContext.beginPath();
    signatureContext.moveTo(x, y);
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = signatureCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    signatureContext.lineTo(x, y);
    signatureContext.stroke();
}

function clearSignatureCanvas() {
    if (signatureContext && signatureCanvas) {
        signatureContext.fillStyle = 'white';
        signatureContext.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }
}

function cleanupSignatureCanvas() {
    if (signatureCanvas) {
        signatureCanvas.removeEventListener('mousedown', startDrawing);
        signatureCanvas.removeEventListener('mousemove', draw);
        signatureCanvas.removeEventListener('mouseup', stopDrawing);
        signatureCanvas.removeEventListener('mouseout', stopDrawing);
        signatureCanvas.removeEventListener('touchstart', handleTouchStart);
        signatureCanvas.removeEventListener('touchmove', handleTouchMove);
        signatureCanvas.removeEventListener('touchend', stopDrawing);
    }
    signatureCanvas = null;
    signatureContext = null;
    isDrawing = false;
}

function canvasToSVG() {
    const canvas = document.getElementById('signatureCanvas');
    const imageData = signatureContext.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Check if canvas is empty (all white)
    let hasDrawing = false;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) { // Check alpha channel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (!(r === 255 && g === 255 && b === 255)) {
                hasDrawing = true;
                break;
            }
        }
    }
    
    if (!hasDrawing) {
        return null; // No signature drawn
    }
    
    // Convert canvas to image and wrap in SVG
    const dataUrl = canvas.toDataURL('image/png');
    const width = canvas.width;
    const height = canvas.height;
    
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect width="${width}" height="${height}" fill="white"/>
        <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>
    </svg>`;
}

async function submitManualAttendance() {
    const userId = document.getElementById('manualUser').value;
    const date = document.getElementById('manualDate').value;
    const clockIn = document.getElementById('manualClockIn').value;
    const clockOut = document.getElementById('manualClockOut').value;
    const messageDiv = document.getElementById('manualAttendanceMessage');
    
    // Validation
    if (!userId || !date || !clockIn) {
        messageDiv.style.display = 'block';
        messageDiv.className = 'error';
        messageDiv.innerHTML = 'Please fill in User, Date, and Clock In Time';
        return;
    }
    
    const signature = canvasToSVG();
    if (!signature) {
        messageDiv.style.display = 'block';
        messageDiv.className = 'error';
        messageDiv.innerHTML = 'Please draw a signature';
        return;
    }
    
    try {
        messageDiv.style.display = 'block';
        messageDiv.className = 'loading';
        messageDiv.innerHTML = 'Saving...';
        
        // Combine date and time into ISO datetime
        const clockInDateTime = date + 'T' + clockIn + ':00';
        const clockOutDateTime = clockOut ? date + 'T' + clockOut + ':00' : null;
        
        await API.createManualAttendance(userId, date, clockInDateTime, clockOutDateTime, signature);
        
        messageDiv.className = 'success';
        messageDiv.innerHTML = 'Attendance record created successfully!';
        
        setTimeout(() => {
            closeManualAttendanceModal();
            loadAllAttendance();
        }, 1000);
    } catch (error) {
        console.error('Error creating attendance:', error);
        messageDiv.className = 'error';
        messageDiv.innerHTML = `Error: ${error.message}`;
    }
}

// Expose to global scope
window.showManualAttendanceModal = showManualAttendanceModal;
window.closeManualAttendanceModal = closeManualAttendanceModal;
window.clearSignatureCanvas = clearSignatureCanvas;
window.submitManualAttendance = submitManualAttendance;
window.toggleSelectAllAttendance = toggleSelectAllAttendance;
window.toggleRowSelection = toggleRowSelection;
window.updateAttendanceSelectionUI = updateAttendanceSelectionUI;
window.deleteSelectedAttendance = deleteSelectedAttendance;
window.exportSelectedToPDF = exportSelectedToPDF;
window.clearAttendanceSelection = clearAttendanceSelection;