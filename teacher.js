// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDV1Wcl9a19chq6JsVR-TCDQhT0tS1BzFo",
    authDomain: "stkcollegeattendance.firebaseapp.com",
    projectId: "stkcollegeattendance",
    storageBucket: "stkcollegeattendance.firebasestorage.app",
    messagingSenderId: "574527402732",
    appId: "1:574527402732:web:ecedfb8d3e9aa693776bc9",
    measurementId: "G-8SDMWZ8H9Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let teacherData = null;
let studentsList = [];

function getStudentEmail(studentId, fallbackEmail) {
    if (fallbackEmail && fallbackEmail !== 'N/A') return fallbackEmail;

    const student = studentsList.find(s => s.studentId === studentId);
    return student ? (student.email || student.studentEmail || student.userEmail || 'N/A') : 'N/A';
}

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        document.getElementById('userNameDisplay').textContent = user.displayName || user.email;
        checkTeacherRole(user.uid);
    } else {
        // No user is signed in, redirect to login
        window.location.href = 'login.html';
    }
});

// Setup navigation
function setupNavigation() {
    // Add click event listeners to all nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show the corresponding section
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
        });
    });
}

// Check if user has teacher role
function checkTeacherRole(uid) {
    db.collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                if (userData.role !== 'teacher') {
                    showToast('Access denied. Teacher privileges required.', 'error');
                    setTimeout(() => {
                        logout();
                    }, 2000);
                } else {
                    // Load teacher data and dashboard
                    teacherData = userData;
                    loadDashboardData();
                    loadStudents();
                    setupRealtimeListeners();
                    setupNavigation();
                }
            } else {
                showToast('User profile not found.', 'error');
                setTimeout(() => {
                    logout();
                }, 2000);
            }
        })
        .catch((error) => {
            console.error('Error checking user role:', error);
            showToast('Error verifying permissions.', 'error');
        });
}

// Show section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const sectionElement = document.getElementById(`${sectionId}Section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    
    switch(sectionId) {
        case 'dashboard':
            pageTitle.textContent = 'Teacher Dashboard';
            pageSubtitle.textContent = 'Welcome back! Here\'s your teaching summary.';
            loadDashboardData();
            break;
        case 'pending':
            pageTitle.textContent = 'Pending Approval';
            pageSubtitle.textContent = 'Review and approve student attendance requests.';
            loadPendingAttendance();
            break;
        case 'history':
            pageTitle.textContent = 'Attendance History';
            pageSubtitle.textContent = 'View all attendance records.';
            loadAttendanceHistory();
            break;
        case 'reports':
            pageTitle.textContent = 'Attendance Reports';
            pageSubtitle.textContent = 'Generate and download attendance reports.';
            break;
    }
}

// Load dashboard data with enhanced error handling
function loadDashboardData() {
    console.log('Loading teacher dashboard data...');
    
    // Load student counts - only students assigned to this teacher
    const studentPromise = db.collection('users').where('role', '==', 'student').get()
        .then((querySnapshot) => {
            const studentCount = querySnapshot.size;
            console.log('Student count:', studentCount);
            document.getElementById('totalStudents').textContent = studentCount;
            return studentCount;
        })
        .catch((error) => {
            console.error('Error loading student count:', error);
            document.getElementById('totalStudents').textContent = '0';
            return 0;
        });

    // Load pending approvals count
    const pendingPromise = db.collection('attendance').where('status', '==', 'pending').get()
        .then((querySnapshot) => {
            const pendingCount = querySnapshot.size;
            console.log('Pending approvals count:', pendingCount);
            document.getElementById('pendingApprovals').textContent = pendingCount;
            return pendingCount;
        })
        .catch((error) => {
            console.error('Error loading pending approvals:', error);
            document.getElementById('pendingApprovals').textContent = '0';
            return 0;
        });

    // Load today's attendance count
    const todayPromise = new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];
        db.collection('attendance')
            .where('date', '==', today)
            .where('status', '==', 'approved')
            .get()
            .then((querySnapshot) => {
                const todayCount = querySnapshot.size;
                console.log('Today\'s attendance count:', todayCount);
                document.getElementById('todayAttendance').textContent = todayCount;
                resolve(todayCount);
            })
            .catch((error) => {
                console.error('Error loading today\'s attendance:', error);
                document.getElementById('todayAttendance').textContent = '0';
                resolve(0);
            });
    });

    // Load attendance rate
    const attendanceRatePromise = db.collection('attendance').get()
        .then((querySnapshot) => {
            const totalRecords = querySnapshot.size;
            let approvedRecords = 0;
            
            querySnapshot.forEach(doc => {
                if (doc.data().status === 'approved') {
                    approvedRecords++;
                }
            });
            
            const attendanceRate = totalRecords > 0 ? Math.round((approvedRecords / totalRecords) * 100) : 0;
            console.log('Attendance rate:', attendanceRate + '%');
            document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
            return attendanceRate;
        })
        .catch((error) => {
            console.error('Error loading attendance rate:', error);
            document.getElementById('attendanceRate').textContent = '0%';
            return 0;
        });

    // Load recent activities
    const activitiesPromise = loadRecentActivities();

    // Wait for all promises to complete
    return Promise.all([studentPromise, pendingPromise, todayPromise, attendanceRatePromise, activitiesPromise]);
}

// Load students list
function loadStudents() {
    return db.collection('users').where('role', '==', 'student').get()
        .then((querySnapshot) => {
            studentsList = [];
            querySnapshot.forEach((doc) => {
                studentsList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            showToast('Error loading students.', 'error');
        });
}


// Load pending attendance with enhanced error handling
function loadPendingAttendance() {
    console.log('Loading pending attendance...');
    
    // Show loading state
    const tbody = document.getElementById('pendingTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i>
                <p style="color: var(--gray-500);">Loading pending requests...</p>
            </td>
        </tr>
    `;
    
    db.collection('attendance')
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .get()
        .then((querySnapshot) => {
            tbody.innerHTML = '';
            
            if (querySnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p style="color: var(--gray-500);">No pending attendance requests</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${data.studentName || 'Unknown'}</td>
                    <td>${getStudentEmail(data.studentId, data.studentEmail)}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleDateString()}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                    <td><span class="status-badge ${data.status}">${data.status}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="approveAttendance('${doc.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="rejectAttendance('${doc.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading pending attendance:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading pending requests. Please try again.</p>
                        <button class="btn btn-primary" onclick="loadPendingAttendance()" style="margin-top: 1rem;">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    </td>
                </tr>
            `;
            showToast('Error loading pending attendance.', 'error');
        });
}

// Filter pending attendance
function filterPendingAttendance() {
    const dateFilter = document.getElementById('dateFilter').value;
    const studentFilter = document.getElementById('studentFilter').value.toLowerCase();
    const rows = document.getElementById('pendingTableBody').querySelectorAll('tr');
    
    rows.forEach((row) => {
        if (row.cells.length < 6) return; // Skip the no-data row
        
        const date = row.cells[2].textContent;
        const studentName = row.cells[0].textContent.toLowerCase();
        
        const dateMatch = !dateFilter || date === new Date(dateFilter).toLocaleDateString();
        const studentMatch = !studentFilter || studentName.includes(studentFilter);
        
        if (dateMatch && studentMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Load attendance history with enhanced error handling
function loadAttendanceHistory() {
    console.log('Loading attendance history...');
    
    // Show loading state
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i>
                <p style="color: var(--gray-500);">Loading attendance history...</p>
            </td>
        </tr>
    `;
    
    db.collection('attendance')
        .orderBy('timestamp', 'desc')
        .get()
        .then((querySnapshot) => {
            tbody.innerHTML = '';
            
            if (querySnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-inbox" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p style="color: var(--gray-500);">No attendance records found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const row = document.createElement('tr');
                
                // Status badge with icon
                let statusBadge = '';
                if (data.status === 'approved') {
                    statusBadge = `<span class="status-badge approved"><i class="fas fa-check-circle"></i> Approved</span>`;
                } else if (data.status === 'rejected') {
                    statusBadge = `<span class="status-badge rejected"><i class="fas fa-times-circle"></i> Rejected</span>`;
                } else {
                    statusBadge = `<span class="status-badge pending"><i class="fas fa-clock"></i> Pending</span>`;
                }
                
                // Determine which buttons to show based on status
                let actionButtons = '';
                if (data.status === 'approved') {
                    actionButtons = `
                        <div class="btn-action-group">
                            <button class="btn-status btn-absent" onclick="updateAttendanceStatus('${doc.id}', 'rejected')">
                                <i class="fas fa-user-times"></i> Mark Absent
                            </button>
                        </div>
                    `;
                } else if (data.status === 'rejected') {
                    actionButtons = `
                        <div class="btn-action-group">
                            <button class="btn-status btn-present" onclick="updateAttendanceStatus('${doc.id}', 'approved')">
                                <i class="fas fa-user-check"></i> Mark Present
                            </button>
                        </div>
                    `;
                } else { // pending
                    actionButtons = `
                        <div class="btn-action-group">
                            <button class="btn-status btn-present" onclick="updateAttendanceStatus('${doc.id}', 'approved')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn-status btn-absent" onclick="updateAttendanceStatus('${doc.id}', 'rejected')">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    `;
                }
                
                row.innerHTML = `
                    <td>${data.studentName || 'Unknown'}</td>
                    <td>${getStudentEmail(data.studentId, data.studentEmail)}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleDateString()}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                    <td>${statusBadge}</td>
                    <td>${data.approvedBy || '-'}</td>
                    <td class="table-actions">${actionButtons}</td>
                `;
                
                tbody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading attendance history:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading attendance history. Please try again.</p>
                        <button class="btn btn-primary" onclick="loadAttendanceHistory()" style="margin-top: 1rem;">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    </td>
                </tr>
            `;
            showToast('Error loading attendance history.', 'error');
        });
}
// Update attendance status (for history section)
function updateAttendanceStatus(attendanceId, newStatus) {
    db.collection('attendance').doc(attendanceId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                return db.collection('attendance').doc(attendanceId).update({
                    status: newStatus,
                    approvedBy: currentUser.displayName || currentUser.email,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    const statusText = newStatus === 'approved' ? 'approved' : 'rejected';
                    showToast(`Attendance ${statusText} successfully.`, 'success');
                    loadAttendanceHistory();
                    loadDashboardData(); // Refresh dashboard stats
                    
                    // Add activity log
                    db.collection('activities').add({
                        type: 'attendance',
                        icon: newStatus === 'approved' ? 'fa-check-circle' : 'fa-times-circle',
                        message: `${newStatus === 'approved' ? 'Approved' : 'Rejected'} attendance for ${data.studentName}`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: currentUser.uid,
                        userName: currentUser.displayName || currentUser.email
                    });
                });
            }
        })
        .catch((error) => {
            console.error('Error updating attendance status:', error);
            showToast('Error updating attendance status.', 'error');
        });
}
// Filter attendance history
function filterAttendanceHistory() {
    const dateFilter = document.getElementById('historyDateFilter').value;
    const studentFilter = document.getElementById('historyStudentFilter').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const rows = document.getElementById('historyTableBody').querySelectorAll('tr');
    
    rows.forEach((row) => {
        if (row.cells.length < 7) return; // Skip the no-data row
        
        const date = row.cells[2].textContent;
        const studentName = row.cells[0].textContent.toLowerCase();
        const statusElement = row.cells[4].querySelector('.status-badge');
        const status = statusElement ? statusElement.textContent.toLowerCase().trim() : '';
        
        const dateMatch = !dateFilter || date === new Date(dateFilter).toLocaleDateString();
        const studentMatch = !studentFilter || studentName.includes(studentFilter);
        const statusMatch = statusFilter === 'all' || status.includes(statusFilter);
        
        if (dateMatch && studentMatch && statusMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Load recent activities with enhanced error handling
function loadRecentActivities() {
    return db.collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then((querySnapshot) => {
            const activityList = document.getElementById('activityList');
            activityList.innerHTML = '';
            
            if (querySnapshot.empty) {
                activityList.innerHTML = `
                    <li style="text-align: center; padding: 1rem; color: var(--gray-500);">
                        <i class="fas fa-info-circle" style="display: block; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        No recent activities
                    </li>
                `;
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const item = document.createElement('li');
                item.className = 'activity-item';
                
                item.innerHTML = `
                    <div class="activity-icon ${data.type === 'user' ? 'blue' : 'green'}">
                        <i class="fas ${data.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${data.message}</p>
                        <span class="activity-time">${formatTimeAgo(data.timestamp.toDate())}</span>
                    </div>
                `;
                
                activityList.appendChild(item);
            });
        })
        .catch((error) => {
            console.error('Error loading activities:', error);
            const activityList = document.getElementById('activityList');
            activityList.innerHTML = `
                <li style="text-align: center; padding: 1rem; color: var(--danger);">
                    <i class="fas fa-exclamation-triangle" style="display: block; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    Error loading activities
                </li>
            `;
        });
}

// Approve attendance with enhanced error handling
function approveAttendance(attendanceId) {
    db.collection('attendance').doc(attendanceId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                return db.collection('attendance').doc(attendanceId).update({
                    status: 'approved',
                    approvedBy: currentUser.displayName || currentUser.email,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    showToast('Attendance approved successfully.', 'success');
                    loadPendingAttendance();
                    loadDashboardData(); // Refresh dashboard stats
                    
                    // Add activity log
                    db.collection('activities').add({
                        type: 'attendance',
                        icon: 'fa-check-circle',
                        message: `Approved attendance for ${data.studentName}`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: currentUser.uid,
                        userName: currentUser.displayName || currentUser.email
                    });
                });
            }
        })
        .catch((error) => {
            console.error('Error approving attendance:', error);
            showToast('Error approving attendance.', 'error');
        });
}

// Reject attendance with enhanced error handling
function rejectAttendance(attendanceId) {
    db.collection('attendance').doc(attendanceId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                return db.collection('attendance').doc(attendanceId).update({
                    status: 'rejected',
                    approvedBy: currentUser.displayName || currentUser.email,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    showToast('Attendance rejected.', 'success');
                    loadPendingAttendance();
                    loadDashboardData(); // Refresh dashboard stats
                    
                    // Add activity log
                    db.collection('activities').add({
                        type: 'attendance',
                        icon: 'fa-times-circle',
                        message: `Rejected attendance for ${data.studentName}`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: currentUser.uid,
                        userName: currentUser.displayName || currentUser.email
                    });
                });
            }
        })
        .catch((error) => {
            console.error('Error rejecting attendance:', error);
            showToast('Error rejecting attendance.', 'error');
        });
}

// Export today's attendance with enhanced error handling
function exportTodayAttendance() {
    const today = new Date().toISOString().split('T')[0];
    
    db.collection('attendance')
        .where('date', '==', today)
        .get()
        .then((querySnapshot) => {
            const attendanceData = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                attendanceData.push({
                    studentName: data.studentName || 'Unknown',
                    studentEmail: getStudentEmail(data.studentId, data.studentEmail),
                    date: data.date,
                    time: new Date(data.timestamp.toDate()).toLocaleTimeString(),
                    status: data.status
                });
            });
            
            generatePDF(attendanceData, `Today's Attendance Report - ${today}`);
        })
        .catch((error) => {
            console.error('Error exporting today\'s attendance:', error);
            showToast('Error generating report.', 'error');
        });
}

// Export date range attendance with enhanced error handling
function exportDateRangeAttendance() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates.', 'error');
        return;
    }
    
    db.collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get()
        .then((querySnapshot) => {
            const attendanceData = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                attendanceData.push({
                    studentName: data.studentName || 'Unknown',
                    studentEmail: getStudentEmail(data.studentId, data.studentEmail),
                    date: data.date,
                    time: new Date(data.timestamp.toDate()).toLocaleTimeString(),
                    status: data.status
                });
            });
            
            generatePDF(attendanceData, `Attendance Report - ${startDate} to ${endDate}`);
        })
        .catch((error) => {
            console.error('Error exporting date range attendance:', error);
            showToast('Error generating report.', 'error');
        });
}

// Export full attendance with enhanced error handling
function exportFullAttendance() {
    loadStudents().then(() => {
        db.collection('attendance')
            .get()
            .then((querySnapshot) => {
                const attendanceData = [];
                
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    attendanceData.push({
                        studentName: data.studentName || 'Unknown',
                        studentEmail: getStudentEmail(data.studentId, data.studentEmail),
                        date: data.date,
                        time: new Date(data.timestamp.toDate()).toLocaleTimeString(),
                        status: data.status
                    });
                });
                
                generatePDF(attendanceData, 'Full Attendance Report');
            })
            .catch((error) => {
                console.error('Error exporting full attendance:', error);
                showToast('Error generating report.', 'error');
            });
    });
}



// Generate PDF report
function generatePDF(data, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    
    // Prepare table data
    const tableData = data.map(item => [
        item.studentName,
        item.studentId,
        item.date,
        item.time,
        item.status.toUpperCase()
    ]);
    
    // Generate table
    doc.autoTable({
        startY: 30,
        head: [['Student Name', 'Email', 'Date', 'Time', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [79, 70, 229],
            textColor: 255
        },
        alternateRowStyles: {
            fillColor: [243, 244, 246]
        }
    });
    
    // Save the PDF
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    showToast('Report downloaded successfully.', 'success');
}

// Setup realtime listeners
function setupRealtimeListeners() {
    // Listen for new pending attendance
    db.collection('attendance')
        .where('status', '==', 'pending')
        .onSnapshot((snapshot) => {
            document.getElementById('pendingApprovals').textContent = snapshot.size;
        });
        
    // Listen for changes in students collection
    db.collection('users')
        .where('role', '==', 'student')
        .onSnapshot((snapshot) => {
            document.getElementById('totalStudents').textContent = snapshot.size;
        });
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleDateString();
}

// Show toast notification - CENTERED VERSION
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 5000);
}

// Logout function
function logout() {
    auth.signOut()
        .then(() => {
            window.location.href = 'login.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
            showToast('Error signing out.', 'error');
        });
}

// Initialize dashboard on load
window.onload = function() {
    // Set default date values for filters
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateFilter').value = today;
    document.getElementById('historyDateFilter').value = today;
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
};