// pdf.js - PDF export functionality using jsPDF
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const auth = getAuth();

// Export attendance to PDF
async function exportAttendanceToPDF(filterDate = null, filterStatus = 'approved') {
    try {
        // Show loading state
        const exportBtn = document.getElementById('export-pdf-btn');
        if (exportBtn) {
            exportBtn.textContent = 'Generating PDF...';
            exportBtn.disabled = true;
        }

        // Build query
        let q;
        if (filterDate) {
            q = query(
                collection(db, 'attendance'),
                where('status', '==', filterStatus),
                where('date', '==', filterDate),
                orderBy('timestamp', 'desc')
            );
        } else {
            q = query(
                collection(db, 'attendance'),
                where('status', '==', filterStatus),
                orderBy('timestamp', 'desc')
            );
        }

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            alert('No attendance records found for the selected criteria.');
            return;
        }

        // Prepare data
        const attendanceData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            attendanceData.push({
                studentEmail: data.studentEmail,
                date: data.date,
                time: new Date(data.timestamp.toDate()).toLocaleTimeString(),
                status: data.status.toUpperCase()
            });
        });

        // Generate PDF
        generatePDF(attendanceData, filterDate, filterStatus);

    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error generating PDF. Please try again.');
    } finally {
        // Reset button state
        const exportBtn = document.getElementById('export-pdf-btn');
        if (exportBtn) {
            exportBtn.textContent = 'Export PDF';
            exportBtn.disabled = false;
        }
    }
}

// Generate PDF using jsPDF
function generatePDF(data, filterDate, filterStatus) {
    // Check if jsPDF is loaded
    if (typeof window.jsPDF === 'undefined') {
        console.error('jsPDF library not loaded');
        alert('PDF library not loaded. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jsPDF;
    const doc = new jsPDF();

    // PDF styling
    const primaryColor = [255, 165, 0]; // Orange
    const secondaryColor = [51, 51, 51]; // Dark gray
    const lightGray = [245, 245, 245];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 220, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Register', 20, 20);

    // Date and filter info
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Generated on: ${currentDate}`, 20, 40);
    
    if (filterDate) {
        doc.text(`Date Filter: ${filterDate}`, 20, 47);
    }
    doc.text(`Status Filter: ${filterStatus.toUpperCase()}`, 20, 54);

    // Table headers
    const headers = [['Student Email', 'Date', 'Time', 'Status']];
    
    // Table data
    const tableData = data.map(record => [
        record.studentEmail,
        record.date,
        record.time,
        record.status
    ]);

    // Generate table using autoTable
    if (doc.autoTable) {
        doc.autoTable({
            head: headers,
            body: tableData,
            startY: 65,
            styles: {
                fontSize: 9,
                textColor: secondaryColor,
                lineColor: [200, 200, 200],
                lineWidth: 0.5
            },
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
            },
            alternateRowStyles: {
                fillColor: lightGray
            },
            columnStyles: {
                0: { cellWidth: 70 }, // Student Email
                1: { cellWidth: 40 }, // Date
                2: { cellWidth: 30 }, // Time
                3: { cellWidth: 30, halign: 'center' } // Status
            },
            margin: { left: 20, right: 20 },
            theme: 'striped'
        });
    } else {
        // Fallback manual table creation
        let yPosition = 75;
        
        // Header row
        doc.setFillColor(...primaryColor);
        doc.rect(20, yPosition - 8, 170, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Student Email', 25, yPosition);
        doc.text('Date', 100, yPosition);
        doc.text('Time', 130, yPosition);
        doc.text('Status', 160, yPosition);
        
        yPosition += 15;
        
        // Data rows
        doc.setTextColor(...secondaryColor);
        doc.setFont('helvetica', 'normal');
        
        tableData.forEach((row, index) => {
            if (index % 2 === 0) {
                doc.setFillColor(...lightGray);
                doc.rect(20, yPosition - 8, 170, 10, 'F');
            }
            
            doc.text(row[0], 25, yPosition);
            doc.text(row[1], 100, yPosition);
            doc.text(row[2], 130, yPosition);
            doc.text(row[3], 160, yPosition);
            
            yPosition += 12;
            
            // Add new page if needed
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 30;
            }
        });
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${totalPages}`, 20, 285);
        doc.text(`Total Records: ${data.length}`, 150, 285);
    }

    // Generate filename
    const filename = `attendance_register_${filterDate || 'all_dates'}_${filterStatus}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Save PDF
    doc.save(filename);
}

// Export approved attendance for specific date
async function exportDailyAttendance() {
    const dateInput = document.getElementById('export-date');
    const selectedDate = dateInput ? dateInput.value : null;
    
    if (!selectedDate) {
        alert('Please select a date to export.');
        return;
    }
    
    const formattedDate = new Date(selectedDate).toDateString();
    await exportAttendanceToPDF(formattedDate, 'approved');
}

// Export all approved attendance
async function exportAllAttendance() {
    await exportAttendanceToPDF(null, 'approved');
}

// Export monthly report
async function exportMonthlyReport() {
    const monthInput = document.getElementById('export-month');
    if (!monthInput) {
        alert('Month selector not found.');
        return;
    }
    
    const selectedMonth = monthInput.value;
    if (!selectedMonth) {
        alert('Please select a month to export.');
        return;
    }
    
    try {
        // Show loading state
        const exportBtn = document.getElementById('export-monthly-btn');
        if (exportBtn) {
            exportBtn.textContent = 'Generating Report...';
            exportBtn.disabled = true;
        }

        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        // Query for the month
        const q = query(
            collection(db, 'attendance'),
            where('status', '==', 'approved'),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const monthlyData = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const recordDate = new Date(data.timestamp.toDate());
            
            if (recordDate >= startDate && recordDate <= endDate) {
                monthlyData.push({
                    studentEmail: data.studentEmail,
                    date: data.date,
                    time: recordDate.toLocaleTimeString(),
                    status: data.status.toUpperCase()
                });
            }
        });

        if (monthlyData.length === 0) {
            alert('No attendance records found for the selected month.');
            return;
        }

        // Generate monthly PDF with statistics
        generateMonthlyReportPDF(monthlyData, selectedMonth);

    } catch (error) {
        console.error('Error generating monthly report:', error);
        alert('Error generating monthly report. Please try again.');
    } finally {
        // Reset button state
        const exportBtn = document.getElementById('export-monthly-btn');
        if (exportBtn) {
            exportBtn.textContent = 'Export Monthly Report';
            exportBtn.disabled = false;
        }
    }
}

// Generate monthly report PDF with statistics
function generateMonthlyReportPDF(data, selectedMonth) {
    const { jsPDF } = window.jsPDF;
    const doc = new jsPDF();

    const primaryColor = [255, 165, 0];
    const secondaryColor = [51, 51, 51];
    
    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 220, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Attendance Report', 20, 20);
    
    doc.setFontSize(12);
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    doc.text(monthName, 20, 30);

    // Statistics
    const totalRecords = data.length;
    const uniqueStudents = [...new Set(data.map(record => record.studentEmail))].length;
    const uniqueDates = [...new Set(data.map(record => record.date))].length;

    doc.setTextColor(...secondaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 50);
    doc.text(`Total Attendance Records: ${totalRecords}`, 20, 57);
    doc.text(`Unique Students: ${uniqueStudents}`, 20, 64);
    doc.text(`Days with Attendance: ${uniqueDates}`, 20, 71);

    // Table
    const headers = [['Student Email', 'Date', 'Time', 'Status']];
    const tableData = data.map(record => [
        record.studentEmail,
        record.date,
        record.time,
        record.status
    ]);

    if (doc.autoTable) {
        doc.autoTable({
            head: headers,
            body: tableData,
            startY: 85,
            styles: {
                fontSize: 9,
                textColor: secondaryColor
            },
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            }
        });
    }

    const filename = `monthly_attendance_report_${selectedMonth}.pdf`;
    doc.save(filename);
}

// Initialize PDF export functionality
document.addEventListener('DOMContentLoaded', function() {
    // Export buttons event listeners
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportDailyBtn = document.getElementById('export-daily-btn');
    const exportAllBtn = document.getElementById('export-all-btn');
    const exportMonthlyBtn = document.getElementById('export-monthly-btn');

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportAllAttendance);
    }

    if (exportDailyBtn) {
        exportDailyBtn.addEventListener('click', exportDailyAttendance);
    }

    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', exportAllAttendance);
    }

    if (exportMonthlyBtn) {
        exportMonthlyBtn.addEventListener('click', exportMonthlyReport);
    }

    // Set default dates
    const dateInput = document.getElementById('export-date');
    const monthInput = document.getElementById('export-month');
    
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    if (monthInput) {
        const currentDate = new Date();
        const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
        monthInput.value = currentMonth;
    }
});

// Export functions for global use
window.exportAttendanceToPDF = exportAttendanceToPDF;
window.exportDailyAttendance = exportDailyAttendance;
window.exportAllAttendance = exportAllAttendance;
window.exportMonthlyReport = exportMonthlyReport;