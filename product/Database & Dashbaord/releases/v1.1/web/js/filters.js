// Filter Management
const Filters = {
    async applyFilters() {
        const userId = document.getElementById('filterUser').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        const content = document.getElementById('allContent');
        content.innerHTML = '<div class="loading">Filtering...</div>';

        try {
            const filteredData = await API.fetchFilteredAttendance(userId, startDate, endDate);
            State.filteredAttendanceData = filteredData;

            const userName = userId ? State.allUsers.find(u => u.id == userId)?.name : 'All Users';
            const dateRange = startDate || endDate ? 
                `${startDate || 'Beginning'} to ${endDate || 'Today'}` : 'All Time';

            document.getElementById('filterResults').innerHTML = `
                <div class="results-summary">
                    <div>
                        Showing <strong>${filteredData.length}</strong> records for 
                        <strong>${userName}</strong> (${dateRange})
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
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterResults').innerHTML = '';
        
        State.filteredAttendanceData = State.allAttendanceData;
        document.getElementById('allContent').innerHTML = UI.renderAttendanceTable(State.allAttendanceData);
    }
};

// Expose to global scope
window.applyFilters = () => Filters.applyFilters();
window.clearFilters = () => Filters.clearFilters();