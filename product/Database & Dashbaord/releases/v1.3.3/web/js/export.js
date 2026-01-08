// PDF Export Functionality
const Export = {
    calculateDagdelen(workDurationMinutes) {
        // Calculate dagdelen: 1 if less than 4 hours, 2 if 4 hours or more
        if (!workDurationMinutes) return 1;
        const hours = workDurationMinutes / 60;
        return hours >= 4 ? 2 : 1;
    },

    async renderSignatureImage(signatureData) {
        if (!signatureData) return null;
        
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '180px';
        tempDiv.style.height = '70px';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.display = 'flex';
        tempDiv.style.alignItems = 'center';
        tempDiv.style.justifyContent = 'center';
        tempDiv.innerHTML = signatureData
            .replace(/<svg/, `<svg viewBox="${CONFIG.SVG_VIEWBOX}" preserveAspectRatio="xMidYMid meet"`)
            .replace(/width="550"/, 'width="100%"')
            .replace(/height="270"/, 'height="100%"');
        document.body.appendChild(tempDiv);

        try {
            const canvas = await html2canvas(tempDiv, { backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            return imgData;
        } catch (e) {
            console.error('Error rendering signature:', e);
            return null;
        } finally {
            document.body.removeChild(tempDiv);
        }
    },

    async generatePDFWithLayout(records, selectedUser = null) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Load logo as data URL
        let logoDataUrl = null;
        try {
            const response = await fetch('images/zeeuwsezorg.png');
            if (response.ok) {
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {
            console.log('Logo image not found');
        }

        // Helper function to add header with logo
        const addHeader = (yPos) => {
            // Add Zeeuwse Zorg logo at top right
            if (logoDataUrl) {
                try {
                    doc.addImage(logoDataUrl, 'PNG', pageWidth - 50, 10, 40, 25);
                } catch (e) {
                    console.log('Could not add logo to PDF');
                }
            }
            
            // Add title
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Presentie', 14, 20);
            
            return yPos;
        };

        let yPos = addHeader(30);

        // Determine date range info
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        
        let periodText = '';
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate).toLocaleDateString('nl-NL') : 'Beginning';
            const end = endDate ? new Date(endDate).toLocaleDateString('nl-NL') : 'Today';
            periodText = `${start} / ${end}`;
        } else {
            periodText = 'All Time';
        }

        // Period info
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Periode ${periodText}`, 14, yPos);
        yPos += 10;

        // Add horizontal line
        doc.setDrawColor(100, 100, 100);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 8;

        // Group records by user/client name
        const recordsByUser = {};
        records.forEach(record => {
            const userName = record.name;
            if (!recordsByUser[userName]) {
                recordsByUser[userName] = [];
            }
            recordsByUser[userName].push(record);
        });

        // Column positions for 4 columns (datum, aantal, eendheden, signature)
        const col1X = 14;      // datum
        const col2X = 75;      // aantal
        const col3X = 115;     // eendheden
        const col4X = 155;     // signature
        const rowHeight = 6;

        // Process each user's records
        for (const userName in recordsByUser) {
            const userRecords = recordsByUser[userName];

            // Check if we need a new page
            if (yPos > pageHeight - 100) {
                doc.addPage();
                yPos = addHeader(30);
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                doc.text(`Periode ${periodText}`, 14, yPos);
                yPos += 10;
                doc.setDrawColor(100, 100, 100);
                doc.line(14, yPos, pageWidth - 14, yPos);
                yPos += 8;
            }

            // User name heading
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Cliënt: ${userName}`, 14, yPos);
            yPos += 8;

            // Department/Financieringvorm info
            const userDepartment = userRecords[0].department || '-';
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Financieringvorm: ${userDepartment}`, 14, yPos);
            yPos += 7;

            // Table headers
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setFillColor(240, 240, 240);

            doc.rect(col1X, yPos, col2X - col1X - 2, rowHeight, 'F');
            doc.rect(col2X, yPos, col3X - col2X - 2, rowHeight, 'F');
            doc.rect(col3X, yPos, col4X - col3X - 2, rowHeight, 'F');
            doc.rect(col4X, yPos, pageWidth - col4X - 14, rowHeight, 'F');

            doc.text('datum', col1X + 2, yPos + 4);
            doc.text('aantal', col2X + 2, yPos + 4);
            doc.text('eendheden', col3X + 2, yPos + 4);
            doc.text('signature', col4X + 2, yPos + 4);

            yPos += rowHeight;

            // Table rows
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);

            let totalDagdelen = 0;

            for (let i = 0; i < userRecords.length; i++) {
                const record = userRecords[i];

                // Check if we need a new page
                if (yPos > pageHeight - 50) {
                    doc.addPage();
                    yPos = addHeader(30);
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');
                    doc.text(`Periode ${periodText}`, 14, yPos);
                    yPos += 10;
                    doc.setDrawColor(100, 100, 100);
                    doc.line(14, yPos, pageWidth - 14, yPos);
                    yPos += 8;

                    // User name heading
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.text(`Cliënt: ${userName}`, 14, yPos);
                    yPos += 8;

                    // Department/Financieringvorm info
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');
                    doc.text(`Financieringvorm: ${userDepartment}`, 14, yPos);
                    yPos += 7;

                    // Re-add table headers
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    doc.setFillColor(240, 240, 240);
                    doc.rect(col1X, yPos, col2X - col1X - 2, rowHeight, 'F');
                    doc.rect(col2X, yPos, col3X - col2X - 2, rowHeight, 'F');
                    doc.rect(col3X, yPos, col4X - col3X - 2, rowHeight, 'F');
                    doc.rect(col4X, yPos, pageWidth - col4X - 14, rowHeight, 'F');
                    doc.text('datum', col1X + 2, yPos + 4);
                    doc.text('aantal', col2X + 2, yPos + 4);
                    doc.text('eendheden', col3X + 2, yPos + 4);
                    doc.text('signature', col4X + 2, yPos + 4);
                    yPos += rowHeight;
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(9);
                }

                const dagdelen = this.calculateDagdelen(record.work_duration);
                totalDagdelen += dagdelen;

                // Format date and times
                const dateObj = new Date(record.date);
                const dateFormatted = dateObj.toLocaleDateString('nl-NL', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                });
                
                const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('nl-NL', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }) : '-';
                
                const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('nl-NL', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }) : '-';

                // Date and times in first column
                const datumText = `${dateFormatted}\n${clockIn} - ${clockOut}`;
                
                // Determine row height based on signature presence
                let currentRowHeight = rowHeight * 2;
                if (record.signature_data) {
                    currentRowHeight = rowHeight * 4; // More space for signature
                }

                // Draw cell borders
                doc.setDrawColor(200, 200, 200);
                doc.rect(col1X, yPos, col2X - col1X - 2, currentRowHeight);
                doc.rect(col2X, yPos, col3X - col2X - 2, currentRowHeight);
                doc.rect(col3X, yPos, col4X - col3X - 2, currentRowHeight);
                doc.rect(col4X, yPos, pageWidth - col4X - 14, currentRowHeight);

                // Add text
                doc.setFontSize(8);
                doc.text(datumText, col1X + 2, yPos + 2, { maxWidth: col2X - col1X - 4 });
                doc.setFontSize(9);
                doc.text(dagdelen.toString(), col2X + 2, yPos + 5);
                doc.text('dagdelen', col3X + 2, yPos + 5);

                // Add signature if exists in signature column
                if (record.signature_data) {
                    const imgData = await this.renderSignatureImage(record.signature_data);
                    if (imgData) {
                        // Position signature in the signature column
                        const signatureXPos = col4X + 2;
                        const signatureYPos = yPos + 2;
                        doc.addImage(imgData, 'PNG', signatureXPos, signatureYPos, 35, 10);
                    }
                }

                yPos += currentRowHeight;
            }

            // Add total row for this user
            doc.setFont(undefined, 'bold');
            doc.setFillColor(240, 240, 240);
            doc.rect(col1X, yPos, col2X - col1X - 2, rowHeight, 'F');
            doc.rect(col2X, yPos, col3X - col2X - 2, rowHeight, 'F');
            doc.rect(col3X, yPos, col4X - col3X - 2, rowHeight, 'F');
            doc.rect(col4X, yPos, pageWidth - col4X - 14, rowHeight, 'F');

            doc.setFontSize(9);
            doc.text(`Totaal`, col1X + 2, yPos + 4);
            doc.text(totalDagdelen.toString(), col2X + 2, yPos + 4);

            yPos += rowHeight + 15; // Space between user tables
        }

        // Save PDF
        const fileName = selectedUser || 'All_Clients';
        const filename = `Presentie_${fileName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
    },

    async exportToPDF() {
        const records = State.filteredAttendanceData || [];
        if (records.length === 0) {
            alert('No records to export');
            return;
        }
        await this.generatePDFWithLayout(records);
    }
};

// Expose to global scope
window.exportToPDF = () => Export.exportToPDF();