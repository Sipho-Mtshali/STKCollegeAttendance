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
let allUsers = [];
let allAttendance = [];
let studentsList = [];
// Add this function to get student email
function getStudentEmail(studentId, fallbackEmail) {
    if (fallbackEmail && fallbackEmail !== 'N/A') return fallbackEmail;

    const student = studentsList.find(s => s.studentId === studentId);
    return student ? (student.email || student.studentEmail || student.userEmail || 'N/A') : 'N/A';
}
// Generate PDF report function (MOVE THIS TO THE TOP)
function generatePDFReport(data, title, reportType = 'attendance') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Prepare table data based on report type
    let head = [];
    let body = [];
    
    if (reportType === 'attendance') {
        // Attendance report format
        head = [['Student Name', 'Email', 'Date', 'Time', 'Status', 'Approved By']];
        body = data.map(item => [
            item.studentName,
            item.studentEmail,
            item.date,
            item.time,
            item.status.toUpperCase(),
            item.approvedBy
        ]);
    } else if (reportType === 'user') {
        // User report format
        head = [['Name', 'Email', 'Role', 'Created At']];
        body = data.map(item => [
            item.name,
            item.email,
            item.role,
            item.createdAt
        ]);
    } else {
        // Default format (for system reports)
        head = [['Metric', 'Value']];
        body = data.map(item => [item.metric, item.value]);
    }
    
    // Add data as table
    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
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
    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    showToast(`${title} downloaded successfully.`, 'success');
}
// Generate user report
function generateUserReport() {
    db.collection('users').get()
        .then((querySnapshot) => {
            const userData = [];
            const roleCounts = {
                admin: 0,
                teacher: 0,
                student: 0
            };
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                userData.push({
                    name: data.name || 'N/A',
                    email: data.email,
                    role: data.role,
                    createdAt: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'N/A'
                });
                
                if (roleCounts.hasOwnProperty(data.role)) {
                    roleCounts[data.role]++;
                }
            });
            
            generatePDFReport(userData, 'User Statistics Report', 'user');
        })
        .catch((error) => {
            console.error('Error generating user report:', error);
            showToast('Error generating user report.', 'error');
        });
}


// Check authentication state with better debugging
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User authenticated:', user.uid, user.email);
        currentUser = user;
        
        // Get user data to display name instead of email
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    document.getElementById('userNameDisplay').textContent = userData.name || user.email;
                } else {
                    document.getElementById('userNameDisplay').textContent = user.email;
                }
            })
            .catch((error) => {
                console.error('Error fetching user data:', error);
                document.getElementById('userNameDisplay').textContent = user.email;
            });
            
        checkAdminRole(user.uid);
        
        // Load students first, then other data
        loadStudents().then(() => {
            console.log('Students loaded, now loading dashboard and attendance');
            loadDashboardData();
            setupRealtimeListeners();
            setupNavigation();
            
            // If we're on the attendance section, load it too
            if (document.getElementById('attendanceSection').style.display !== 'none') {
                loadAllAttendance();
            }
        }).catch((error) => {
            console.error('Error loading students:', error);
            // Still try to load other data even if students fail
            loadDashboardData();
            setupRealtimeListeners();
            setupNavigation();
        });
    } else {
        console.log('No user authenticated, redirecting to login');
        window.location.href = 'login.html';
    }
});

// Add this function to load students (similar to teacher.js)
function loadStudents() {
    return db.collection('users').where('role', '==', 'student').get()
        .then((querySnapshot) => {
            studentsList = [];
            querySnapshot.forEach((doc) => {
                const studentData = {
                    id: doc.id,
                    ...doc.data()
                };
                studentsList.push(studentData);
                console.log('Loaded student:', studentData);
            });
            console.log('Total students loaded:', studentsList.length);
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            showToast('Error loading students.', 'error');
        });
}

// Update the editAttendance function to use getStudentEmail
function editAttendance(attendanceId) {
    const attendance = allAttendance.find(a => a.id === attendanceId);
    
    if (attendance) {
        // Use getStudentEmail function to get the email
        const studentEmail = getStudentEmail(attendance.studentId, attendance.studentEmail);
        
        // Populate the form
        document.getElementById('editAttendanceId').value = attendanceId;
        document.getElementById('editStudentName').value = attendance.studentName || 'Unknown';
        document.getElementById('editStudentEmail').value = studentEmail;
        document.getElementById('editAttendanceDate').value = new Date(attendance.timestamp.toDate()).toLocaleDateString();
        document.getElementById('editAttendanceTime').value = new Date(attendance.timestamp.toDate()).toLocaleTimeString();
        document.getElementById('editAttendanceStatus').value = attendance.status;
        document.getElementById('editAttendanceNotes').value = '';
        
        // Open the modal
        openModal('editAttendanceModal');
    }
}

// Function to update attendance status
function updateAttendanceStatus() {
    const attendanceId = document.getElementById('editAttendanceId').value;
    const newStatus = document.getElementById('editAttendanceStatus').value;
    const notes = document.getElementById('editAttendanceNotes').value;
    
    // Get current user name for the approvedBy field
    const currentUserName = document.getElementById('userNameDisplay').textContent;
    
    // Disable the update button to prevent multiple clicks
    const updateBtn = document.querySelector('#editAttendanceModal .btn-primary');
    const originalText = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    
    // Update the attendance record
    db.collection('attendance').doc(attendanceId).update({
        status: newStatus,
        approvedBy: currentUserName,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        notes: notes || null
    })
    .then(() => {
        showToast(`Attendance status updated to ${newStatus}.`, 'success');
        closeModal('editAttendanceModal');
        
        // Add activity log
        const attendance = allAttendance.find(a => a.id === attendanceId);
        return db.collection('activities').add({
            type: 'attendance',
            icon: newStatus === 'approved' ? 'fa-check-circle' : newStatus === 'rejected' ? 'fa-times-circle' : 'fa-clock',
            message: `Admin updated attendance status for ${attendance.studentName} to ${newStatus}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid,
            userName: currentUserName
        });
    })
    .then(() => {
        // Reload attendance data
        loadAllAttendance();
        
        // If we're on the dashboard, reload that too
        if (document.getElementById('dashboardSection').style.display !== 'none') {
            loadDashboardData();
        }
    })
    .catch((error) => {
        console.error('Error updating attendance:', error);
        showToast('Error updating attendance: ' + error.message, 'error');
    })
    .finally(() => {
        // Re-enable the button
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalText;
    });
}

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

// Show section based on ID
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
    
    // Update page title and subtitle
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    
    switch(sectionId) {
        case 'dashboard':
            pageTitle.textContent = 'Admin Dashboard';
            pageSubtitle.textContent = 'Welcome back, Admin! Here\'s what\'s happening today.';
            loadDashboardData();
            break;
        case 'users':
            pageTitle.textContent = 'Manage Users';
            pageSubtitle.textContent = 'View and manage all system users.';
            loadUsers();
            break;
        case 'attendance':
            pageTitle.textContent = 'Attendance Management';
            pageSubtitle.textContent = 'View and manage attendance records.';
            loadAllAttendance();
            break;
        case 'reports':
            pageTitle.textContent = 'Generate Reports';
            pageSubtitle.textContent = 'Create and download system reports.';
            break;
        case 'settings':
            pageTitle.textContent = 'System Settings';
            pageSubtitle.textContent = 'Configure system settings and preferences.';
            loadSettings();
            break;
    }
}

// Check if user has admin role
function checkAdminRole(uid) {
    db.collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                console.log('Current user data:', userData);
                if (userData.role !== 'admin') {
                    showToast('Access denied. Admin privileges required.', 'error');
                    setTimeout(() => {
                        logout();
                    }, 2000);
                }
            } else {
                console.log('User document does not exist');
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

// Load dashboard data
function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    // Load user counts with better error handling and debugging
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

    const teacherPromise = db.collection('users').where('role', '==', 'teacher').get()
        .then((querySnapshot) => {
            const teacherCount = querySnapshot.size;
            console.log('Teacher count:', teacherCount);
            document.getElementById('totalTeachers').textContent = teacherCount;
            return teacherCount;
        })
        .catch((error) => {
            console.error('Error loading teacher count:', error);
            document.getElementById('totalTeachers').textContent = '0';
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

    // Load attendance rate (calculate based on approved/total)
    const attendancePromise = db.collection('attendance').get()
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

    // Load attendance data
    const recentAttendancePromise = db.collection('attendance')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then((querySnapshot) => {
            const tbody = document.getElementById('attendanceTableBody');
            tbody.innerHTML = '';
            
            if (querySnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem;">
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
                
                row.innerHTML = `
                    <td>${data.studentName || 'Unknown'}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleDateString()}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                    <td><span class="status-badge ${data.status}">${data.status}</span></td>
                    <td>
                        <button class="btn" onclick="downloadAttendanceRecord('${doc.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
                            <i class="fas fa-download"></i>
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading attendance data:', error);
        });

    // Load recent activities
    const activitiesPromise = db.collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(4)
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
        });

    // Wait for all promises to complete
    return Promise.all([studentPromise, teacherPromise, pendingPromise, attendancePromise, 
                       recentAttendancePromise, activitiesPromise]);
}

// Load all users
// Modified loadUsers function to accept filter parameters
function loadUsers(roleFilter = 'all', searchFilter = '') {
    console.log('Loading users...');
    return db.collection('users').get()
        .then((querySnapshot) => {
            allUsers = [];
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';
            
            if (querySnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-users" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p style="color: var(--gray-500);">No users found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const userData = {
                    id: doc.id,
                    ...doc.data()
                };
                allUsers.push(userData);
            });
            
            // Apply filters to the data
            const filteredUsers = allUsers.filter(user => {
                const roleMatch = roleFilter === 'all' || user.role === roleFilter;
                const searchMatch = !searchFilter || 
                                  (user.name && user.name.toLowerCase().includes(searchFilter)) || 
                                  user.email.toLowerCase().includes(searchFilter);
                return roleMatch && searchMatch;
            });
            
            // Display filtered users
            if (filteredUsers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-search" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p style="color: var(--gray-500);">No users match your filters</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            filteredUsers.forEach((userData) => {
                const row = document.createElement('tr');
                const createdDate = userData.createdAt ? new Date(userData.createdAt.toDate()).toLocaleDateString() : 'N/A';
                
                row.innerHTML = `
                    <td>${userData.name || 'N/A'}</td>
                    <td>${userData.email}</td>
                    <td><span class="status-badge">${userData.role}</span></td>
                    <td>${createdDate}</td>
                    <td><span class="status-badge approved">Active</span></td>
                    <td>
                        <button class="btn btn-sm" onclick="editUser('${userData.id}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser('${userData.id}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading users:', error);
            showToast('Error loading users.', 'error');
            throw error; // Re-throw to allow proper error handling in calling functions
        });
}

// Modified filterUsers function
function filterUsers() {
    const roleFilter = document.getElementById('userRoleFilter').value;
    const searchFilter = document.getElementById('userSearch').value.toLowerCase();
    
    // Reload users with the current filters
    loadUsers(roleFilter, searchFilter);
}

// Filter users
function filterUsers() {
    const roleFilter = document.getElementById('userRoleFilter').value;
    const searchFilter = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.getElementById('usersTableBody').querySelectorAll('tr');
    
    rows.forEach((row) => {
        if (row.cells.length < 6) return; // Skip the no-data row
        
        const role = row.cells[2].textContent.toLowerCase();
        const name = row.cells[0].textContent.toLowerCase();
        const email = row.cells[1].textContent.toLowerCase();
        
        const roleMatch = roleFilter === 'all' || role === roleFilter;
        const searchMatch = !searchFilter || name.includes(searchFilter) || email.includes(searchFilter);
        
        if (roleMatch && searchMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Update the loadAllAttendance function to use getStudentEmail
function loadAllAttendance() {
    console.log('Loading all attendance...');
    
    // Show loading state
    const tbody = document.getElementById('allAttendanceTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i>
                <p style="color: var(--gray-500);">Loading attendance records...</p>
            </td>
        </tr>
    `;
    
    db.collection('attendance')
        .orderBy('timestamp', 'desc')
        .get()
        .then((querySnapshot) => {
            allAttendance = [];
            tbody.innerHTML = '';
            
            if (querySnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-clipboard-check" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p style="color: var(--gray-500);">No attendance records found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const data = {
                    id: doc.id,
                    ...doc.data()
                };
                allAttendance.push(data);
                
                const row = document.createElement('tr');
                
                // Use getStudentEmail function to get the email
                const studentEmail = getStudentEmail(data.studentId, data.studentEmail);
                
                row.innerHTML = `
                    <td>${data.studentName || 'Unknown'}</td>
                    <td>${studentEmail}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleDateString()}</td>
                    <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                    <td><span class="status-badge ${data.status}">${data.status}</span></td>
                    <td>${data.approvedBy || '-'}</td>
                    <td>
                        <div class="attendance-actions">
                            <button class="btn-status edit" onclick="editAttendance('${doc.id}')" title="Edit Status">
                                <i class="fas fa-edit"></i>
                                <span>Edit</span>
                            </button>
                            <button class="btn-status" onclick="downloadAttendanceRecord('${doc.id}')" title="Download">
                                <i class="fas fa-download"></i>
                                <span>Download</span>
                            </button>
                        </div>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading attendance:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading attendance records. Please try again.</p>
                        <button class="btn btn-primary" onclick="loadAllAttendance()" style="margin-top: 1rem;">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    </td>
                </tr>
            `;
            showToast('Error loading attendance records.', 'error');
        });
}

// Filter attendance
function filterAttendance() {
    const dateFilter = document.getElementById('attendanceDateFilter').value;
    const statusFilter = document.getElementById('attendanceStatusFilter').value;
    const studentFilter = document.getElementById('attendanceStudentFilter').value.toLowerCase();
    const rows = document.getElementById('allAttendanceTableBody').querySelectorAll('tr');
    
    rows.forEach((row) => {
        if (row.cells.length < 7) return; // Skip the no-data row
        
        const date = row.cells[2].textContent;
        const status = row.cells[4].querySelector('.status-badge').textContent.toLowerCase();
        const studentName = row.cells[0].textContent.toLowerCase();
        
        const dateMatch = !dateFilter || date === new Date(dateFilter).toLocaleDateString();
        const statusMatch = statusFilter === 'all' || status === statusFilter;
        const studentMatch = !studentFilter || studentName.includes(studentFilter);
        
        if (dateMatch && statusMatch && studentMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Update the approveAttendance and rejectAttendance functions to use names
function approveAttendance(attendanceId) {
    // Get current user name for the approvedBy field
    const currentUserName = document.getElementById('userNameDisplay').textContent;
    
    db.collection('attendance').doc(attendanceId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                return db.collection('attendance').doc(attendanceId).update({
                    status: 'approved',
                    approvedBy: currentUserName,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    showToast('Attendance approved successfully.', 'success');
                    loadAllAttendance();
                    
                    // Add activity log
                    db.collection('activities').add({
                        type: 'attendance',
                        icon: 'fa-check-circle',
                        message: `Admin approved attendance for ${data.studentName}`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: currentUser.uid,
                        userName: currentUserName
                    });
                });
            }
        })
        .catch((error) => {
            console.error('Error approving attendance:', error);
            showToast('Error approving attendance.', 'error');
        });
}

function rejectAttendance(attendanceId) {
    // Get current user name for the approvedBy field
    const currentUserName = document.getElementById('userNameDisplay').textContent;
    
    db.collection('attendance').doc(attendanceId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                return db.collection('attendance').doc(attendanceId).update({
                    status: 'rejected',
                    approvedBy: currentUserName,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    showToast('Attendance rejected.', 'success');
                    loadAllAttendance();
                    
                    // Add activity log
                    db.collection('activities').add({
                        type: 'attendance',
                        icon: 'fa-times-circle',
                        message: `Admin rejected attendance for ${data.studentName}`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: currentUser.uid,
                        userName: currentUserName
                    });
                });
            }
        })
        .catch((error) => {
            console.error('Error rejecting attendance:', error);
            showToast('Error rejecting attendance.', 'error');
        });
}

// Load settings
function loadSettings() {
    // This would typically load from a settings collection in Firestore
    // For now, we'll set some default values
    document.getElementById('schoolName').value = 'STK College';
    document.getElementById('attendanceHours').value = '7:00 AM - 5:00 PM';
    document.getElementById('adminEmail').value = 'admin@stkcollege.edu';
    document.getElementById('systemTimezone').value = 'UTC';
}

// Save settings
function saveSettings() {
    const schoolName = document.getElementById('schoolName').value;
    const attendanceHours = document.getElementById('attendanceHours').value;
    const adminEmail = document.getElementById('adminEmail').value;
    const timezone = document.getElementById('systemTimezone').value;
    
    // In a real application, you would save these to Firestore
    showToast('Settings saved successfully.', 'success');
    
    // Add activity log
    db.collection('activities').add({
        type: 'settings',
        icon: 'fa-cog',
        message: 'Admin updated system settings',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email
    });
}

// Generate attendance report
function generateAttendanceReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const reportType = document.getElementById('reportType').value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates.', 'error');
        return;
    }
    
    let query = db.collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate);
    
    if (reportType !== 'all') {
        query = query.where('status', '==', reportType);
    }
    
    query.get()
        .then((querySnapshot) => {
            const attendanceData = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Use getStudentEmail function to get the email
                const studentEmail = getStudentEmail(data.studentId, data.studentEmail);
                
                attendanceData.push({
                    studentName: data.studentName,
                    studentEmail: studentEmail,
                    date: data.date,
                    time: new Date(data.timestamp.toDate()).toLocaleTimeString(),
                    status: data.status,
                    approvedBy: data.approvedBy || 'N/A'
                });
            });
            
            generatePDFReport(attendanceData, `Attendance Report - ${startDate} to ${endDate}`);
        })
        .catch((error) => {
            console.error('Error generating report:', error);
            showToast('Error generating report.', 'error');
        });
}

// Generate system report
function generateSystemReport() {
    // This would typically gather various system statistics
    const systemData = [
        { metric: 'Total Users', value: allUsers.length },
        { metric: 'Total Attendance Records', value: allAttendance.length },
        { metric: 'Pending Approvals', value: allAttendance.filter(a => a.status === 'pending').length },
        { metric: 'System Uptime', value: '99.9%' }
    ];
    
    // Create a different format for system report
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('System Summary Report', 14, 15);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Add data as table
    doc.autoTable({
        startY: 30,
        head: [['Metric', 'Value']],
        body: systemData.map(item => [item.metric, item.value]),
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
    doc.save(`System_Summary_Report_${new Date().getTime()}.pdf`);
    showToast('System Summary Report downloaded successfully.', 'success');
}

// Update the downloadAttendanceRecord function to use getStudentEmail
function downloadAttendanceRecord(attendanceId) {
    const attendance = allAttendance.find(a => a.id === attendanceId);
    
    if (attendance) {
        // Use getStudentEmail function to get the email
        const studentEmail = getStudentEmail(attendance.studentId, attendance.studentEmail);
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Add title
        pdf.setFontSize(16);
        pdf.text('Attendance Record', 14, 15);
        
        // Add details
        pdf.setFontSize(10);
        pdf.text(`Student: ${attendance.studentName}`, 14, 25);
        pdf.text(`Email: ${studentEmail}`, 14, 32);
        pdf.text(`Date: ${new Date(attendance.timestamp.toDate()).toLocaleDateString()}`, 14, 39);
        pdf.text(`Time: ${new Date(attendance.timestamp.toDate()).toLocaleTimeString()}`, 14, 46);
        pdf.text(`Status: ${attendance.status}`, 14, 53);
        
        if (attendance.approvedBy) {
            pdf.text(`Approved By: ${attendance.approvedBy}`, 14, 60);
            if (attendance.approvedAt) {
                pdf.text(`Approved At: ${new Date(attendance.approvedAt.toDate()).toLocaleString()}`, 14, 67);
            }
        }
        
        // Save the PDF
        pdf.save(`Attendance_${attendance.studentName}_${new Date(attendance.timestamp.toDate()).toISOString().split('T')[0]}.pdf`);
        showToast('Attendance record downloaded.', 'success');
    }
}

// Export attendance as PDF
function exportAttendancePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Recent Attendance Records', 14, 15);
    
    // Get table data
    const table = document.getElementById('attendanceTableBody');
    const rows = table.querySelectorAll('tr');
    const data = [];
    
    rows.forEach(row => {
        if (row.cells.length === 5) {
            data.push([
                row.cells[0].textContent,
                row.cells[1].textContent,
                row.cells[2].textContent,
                row.cells[3].textContent
            ]);
        }
    });
    
    // Add table
    doc.autoTable({
        startY: 20,
        head: [['Student', 'Date', 'Time', 'Status']],
        body: data
    });
    
    // Save the PDF
    doc.save('Recent_Attendance_Records.pdf');
    showToast('Attendance exported as PDF.', 'success');
}

// Enhanced add user function with better error handling
// Enhanced add user function with better error handling
document.getElementById('addUserForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;
    
    console.log('Adding user:', { name, email, role });
    
    const submitButton = document.getElementById('submitButton');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding User...';
    
    // Store current user before creating new user
    const currentAdmin = auth.currentUser;
    
    // Create user with Firebase Auth
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log('User created in Auth:', user.uid);
            
            // Add user data to Firestore
            return db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser.uid,
                active: true
            }).then(() => {
                console.log('User data saved to Firestore');
                // Update user profile
                return user.updateProfile({
                    displayName: name
                });
            });
        })
        .then(() => {
            console.log('User profile updated');
            
            // Sign back in as the original admin user
            return auth.signInWithEmailAndPassword(currentAdmin.email, promptForAdminPassword());
        })
        .then(() => {
            showToast('User created successfully.', 'success');
            document.getElementById('addUserForm').reset();
            
            // Add activity log
            db.collection('activities').add({
                type: 'user',
                icon: 'fa-user-plus',
                message: `Admin created new ${role} user: ${name}`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email
            });
            
            // Reload dashboard data after a short delay
            setTimeout(() => {
                loadDashboardData();
                loadUsers();
            }, 1000);
        })
        .catch((error) => {
            console.error('Error creating user:', error);
            
            // Try to sign back in as admin if we got logged out
            if (error.code === 'permission-denied') {
                auth.signInWithEmailAndPassword(currentAdmin.email, promptForAdminPassword())
                    .then(() => {
                        showToast('User created but had to re-authenticate.', 'success');
                    })
                    .catch((reauthError) => {
                        console.error('Reauthentication failed:', reauthError);
                        showToast(`Error creating user: ${error.message}`, 'error');
                    });
            } else {
                showToast(`Error creating user: ${error.message}`, 'error');
            }
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-plus"></i> Add User';
        });
});

// Helper function to prompt for admin password (in a real app, you'd use a more secure method)
function promptForAdminPassword() {
    // In a real application, you would have stored this more securely
    // This is just a placeholder implementation
    return prompt("Please enter admin password to continue:");
}

// Edit user
async function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const newName = prompt('Enter new name:', user.name || '');
    if (newName === null) return;

    const newRole = prompt('Enter new role (admin/teacher/student):', user.role);
    if (newRole === null) return;

    if (!['admin', 'teacher', 'student'].includes(newRole)) {
        showToast('Invalid role. Must be admin, teacher, or student.', 'error');
        return;
    }

    try {
        await db.collection('users').doc(userId).update({ name: newName, role: newRole });
        await db.collection('activities').add({
            type: 'user',
            icon: 'fa-user-edit',
            message: `Admin updated user: ${user.email}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email
        });
        showToast('User updated successfully.', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Error updating user.', 'error');
    }
}



// Delete user
function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    
    if (user && confirm(`Are you sure you want to delete user: ${user.email}?`)) {
        // Delete from Firestore
        db.collection('users').doc(userId).delete()
            .then(() => {
                showToast('User deleted successfully.', 'success');
                loadUsers();
                
                // Add activity log
                db.collection('activities').add({
                    type: 'user',
                    icon: 'fa-user-times',
                    message: `Admin deleted user: ${user.email}`,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: currentUser.uid,
                    userName: currentUser.displayName || currentUser.email
                });
            })
            .catch((error) => {
                console.error('Error deleting user:', error);
                showToast('Error deleting user.', 'error');
            });
    }
}

// Enhanced realtime listeners
function setupRealtimeListeners() {
    console.log('Setting up realtime listeners...');
    
    // Listen for changes in users collection
    db.collection('users').onSnapshot((snapshot) => {
        console.log('Users collection changed, refreshing counts...');
        // Small delay to ensure all changes are processed
        setTimeout(() => {
            loadDashboardData();
        }, 200);
    }, (error) => {
        console.error('Error with users listener:', error);
    });
    
    // Listen for changes in attendance collection
    db.collection('attendance').onSnapshot((snapshot) => {
        console.log('Attendance collection changed, refreshing counts...');
        setTimeout(() => {
            loadDashboardData();
        }, 200);
    }, (error) => {
        console.error('Error with attendance listener:', error);
    });
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
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

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Enhanced delete user function with modal
function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    
    if (user) {
        // Set the message
        document.getElementById('deleteModalMessage').textContent = 
            `Are you sure you want to delete ${user.name} (${user.email})? This action cannot be undone.`;
        
        // Set up the confirm button
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        confirmBtn.onclick = () => {
            performUserDeletion(userId, user);
            closeModal('deleteModal');
        };
        
        // Open the modal
        openModal('deleteModal');
    }
}

function performUserDeletion(userId, user) {
    // Disable the delete button to prevent multiple clicks
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    // Delete from Firestore
    db.collection('users').doc(userId).delete()
        .then(() => {
            showToast('User deleted successfully.', 'success');
            
            // Add activity log
            return db.collection('activities').add({
                type: 'user',
                icon: 'fa-user-times',
                message: `Admin deleted user: ${user.email}`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email
            });
        })
        .then(() => {
            // Reload users but maintain the current filter
            const currentRoleFilter = document.getElementById('userRoleFilter').value;
            const currentSearchFilter = document.getElementById('userSearch').value;
            
            return loadUsers(currentRoleFilter, currentSearchFilter);
        })
        .catch((error) => {
            console.error('Error deleting user:', error);
            showToast('Error deleting user: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable the button
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalText;
        });
}

// Enhanced edit user function with modal
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    
    if (user) {
        // Populate the form
        document.getElementById('editUserId').value = userId;
        document.getElementById('editUserName').value = user.name || '';
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserRole').value = user.role;
        
        // Open the modal
        openModal('editModal');
    }
}

function updateUser() {
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();
    const role = document.getElementById('editUserRole').value;
    
    if (!name || !email || !role) {
        showToast('Please fill all fields.', 'error');
        return;
    }
    
    if (!['admin', 'teacher', 'student'].includes(role)) {
        showToast('Invalid role. Must be admin, teacher, or student.', 'error');
        return;
    }
    
    // Disable the update button to prevent multiple clicks
    const updateBtn = document.querySelector('#editModal .btn-primary');
    const originalText = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    
    db.collection('users').doc(userId).update({
        name: name,
        email: email,
        role: role
    })
    .then(() => {
        showToast('User updated successfully.', 'success');
        closeModal('editModal');
        
        // Add activity log
        return db.collection('activities').add({
            type: 'user',
            icon: 'fa-user-edit',
            message: `Admin updated user: ${email}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email
        });
    })
    .then(() => {
        // Reload users but maintain the current filter
        const currentRoleFilter = document.getElementById('userRoleFilter').value;
        const currentSearchFilter = document.getElementById('userSearch').value;
        
        return loadUsers(currentRoleFilter, currentSearchFilter);
    })
    .catch((error) => {
        console.error('Error updating user:', error);
        showToast('Error updating user: ' + error.message, 'error');
    })
    .finally(() => {
        // Re-enable the button
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalText;
    });
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