// PDF Export Functionality
const Export = {
    async exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const userId = document.getElementById('filterUser').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        const userName = userId ? State.allUsers.find(u => u.id == userId)?.name : 'All Users';
        const dateRange = startDate || endDate ? 
            `${startDate || 'Beginning'} to ${endDate || 'Today'}` : 'All Time';

        // Title
        doc.setFontSize(18);
        doc.text('Attendance Report', 14, 20);
        
        doc.setFontSize(12);
        doc.text(`User: ${userName}`, 14, 30);
        doc.text(`Period: ${dateRange}`, 14, 37);
        doc.text(`Total Records: ${State.filteredAttendanceData.length}`, 14, 44);

        let yPos = 55;
        doc.setFontSize(10);

        // Calculate total hours
        let totalMinutes = 0;
        State.filteredAttendanceData.forEach(r => {
            if (r.work_duration) totalMinutes += r.work_duration;
        });
        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;
        
        doc.text(`Total Hours Worked: ${totalHours}h ${totalMins}m`, 14, yPos);
        yPos += 10;

        // Records
        for (let i = 0; i < State.filteredAttendanceData.length; i++) {
            const record = State.filteredAttendanceData[i];
            
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(`${new Date(record.date).toLocaleDateString()} - ${record.name}`, 14, yPos);
            yPos += 6;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(`Clock In: ${UI.formatDateTime(record.clock_in)}`, 14, yPos);
            doc.text(`Clock Out: ${UI.formatDateTime(record.clock_out)}`, 80, yPos);
            doc.text(`Duration: ${UI.formatDuration(record.work_duration)}`, 150, yPos);
            yPos += 6;

            // Add signature if exists
            if (record.signature_data) {
                doc.text('Signature:', 14, yPos);
                yPos += 5;
                
                // Create temporary div for signature
                const tempDiv = document.createElement('div');
                tempDiv.style.width = '180px';
                tempDiv.style.height = '70px';
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.display = 'flex';
                tempDiv.style.alignItems = 'center';
                tempDiv.style.justifyContent = 'center';
                tempDiv.innerHTML = record.signature_data
                    .replace(/<svg/, `<svg viewBox="${CONFIG.SVG_VIEWBOX}" preserveAspectRatio="xMidYMid meet"`)
                    .replace(/width="550"/, 'width="100%"')
                    .replace(/height="270"/, 'height="100%"');
                document.body.appendChild(tempDiv);

                try {
                    const canvas = await html2canvas(tempDiv, { backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', 14, yPos, 50, 20);
                    yPos += 25;
                } catch (e) {
                    console.error('Error rendering signature:', e);
                    yPos += 5;
                }
                
                document.body.removeChild(tempDiv);
            } else {
                yPos += 5;
            }

            doc.setDrawColor(200, 200, 200);
            doc.line(14, yPos, 196, yPos);
            yPos += 8;
        }

        // Save PDF
        const filename = `Attendance_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
    }
};

// Expose to global scope
window.exportToPDF = () => Export.exportToPDF();