// Use the Firebase instance already initialized in firebase-config.js
// Global variables
let currentUser = null;
let studentData = null;
let todayAttendance = null;
let allAttendanceRecords = [];
let markBtn = null;


// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        document.getElementById('userNameDisplay').textContent = user.displayName || user.email;
        checkStudentRole(user.uid);
    } else {
        // No user is signed in, redirect to login
        window.location.href = 'login.html';
    }
});

// Check if user has student role
function checkStudentRole(uid) {
    db.collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                if (userData.role !== 'student') {
                    showToast('Access denied. Student privileges required.', 'error');
                    setTimeout(() => {
                        logout();
                    }, 2000);
                } else {
                    // Load student data and dashboard
                    loadStudentData(uid);
                }
            } else {
                // User document doesn't exist, create it with student role
                createStudentUserDocument(uid);
            }
        })
        .catch((error) => {
            console.error('Error checking user role:', error);
            showToast('Error verifying permissions.', 'error');
        });
}

// Create user document if it doesn't exist
function createStudentUserDocument(uid) {
    const userData = {
        email: currentUser.email,
        role: 'student',
        name: currentUser.displayName || currentUser.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('users').doc(uid).set(userData)
        .then(() => {
            showToast('User profile created successfully.', 'success');
            loadStudentData(uid);
        })
        .catch((error) => {
            console.error('Error creating user document:', error);
            showToast('Error creating user profile.', 'error');
        });
}

// Load student data
function loadStudentData(uid) {
    console.log("Loading student data for UID:", uid);
    
    db.collection('students').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                studentData = doc.data();
                studentData.id = doc.id;

                console.log("Student data loaded by document ID:", studentData);

                document.getElementById('userNameDisplay').textContent = studentData.name;

                // Load dashboard and listeners AFTER studentData is ready
                showSection('dashboard');
                loadDashboardData();
                setupRealtimeListeners();
                setupMobileMenu();
            } else {
                createStudentDocument(uid);
            }
        })
        .catch((error) => {
            console.error('Error loading student data:', error);
            createStudentDocument(uid);
        });
}

// Create student document
function createStudentDocument(uid) {
    const studentDoc = {
        userId: uid,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        studentId: 'STU-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('students').doc(uid).set(studentDoc)
        .then(() => {
            studentData = studentDoc;
            studentData.id = uid;

            showToast('Student profile created successfully.', 'success');
            console.log("Student document created:", studentData);

            document.getElementById('userNameDisplay').textContent = studentData.name;

            showSection('dashboard');
            loadDashboardData();
            setupRealtimeListeners();
            setupMobileMenu();
        })
        .catch((error) => {
            console.error('Error creating student document:', error);
            showToast('Error creating student profile: ' + error.message, 'error');
        });
}

// Setup mobile menu toggle
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (!menuToggle || !sidebar) return;

    if (window.innerWidth <= 768) menuToggle.style.display = 'flex';

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target) &&
            sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) menuToggle.style.display = 'flex';
        else {
            menuToggle.style.display = 'none';
            sidebar.classList.remove('open');
        }
    });
}

// Show specific section
function showSection(section) {
    const sections = ['dashboardSection', 'attendanceSection', 'historySection', 'statsSection'];
    sections.forEach(sec => {
        const element = document.getElementById(sec);
        if (element) element.style.display = 'none';
    });

    switch(section) {
        case 'dashboard':
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection) {
                dashboardSection.style.display = 'block';
                const statsGrid = document.querySelector('.stats-grid');
                if (statsGrid) statsGrid.style.display = 'grid';
                const contentGrid = document.querySelector('.content-grid');
                if (contentGrid) contentGrid.style.display = 'grid';
            }
            updateNavActive('dashboard');
            break;
        case 'attendance':
            const attendanceSection = document.getElementById('attendanceSection');
            if (attendanceSection) attendanceSection.style.display = 'block';
            updateNavActive('attendance');
            break;
        case 'history':
            const historySection = document.getElementById('historySection');
            if (historySection) historySection.style.display = 'block';
            updateNavActive('history');
            loadAttendanceHistory();
            break;
        case 'stats':
            const statsSection = document.getElementById('statsSection');
            if (statsSection) statsSection.style.display = 'block';
            updateNavActive('stats');
            updateStatistics();
            break;
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
}

// Update nav active state
function updateNavActive(section) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    const activeLink = document.querySelector(`.nav-link[onclick="showSection('${section}')"]`);
    if (activeLink) activeLink.classList.add('active');
}

// Load dashboard data
function loadDashboardData() {
    if (!studentData || !studentData.id) {
        console.error("Student data not available for loading dashboard");
        showToast('Student data not loaded. Please refresh the page.', 'error');
        return;
    }

    db.collection('attendance')
        .where('studentId', '==', studentData.id)
        .get()
        .then((querySnapshot) => {
            allAttendanceRecords = [];
            let totalDays = querySnapshot.size;
            let presentDays = 0;
            let pendingDays = 0;
            let absentDays = 0;
            const today = new Date().toISOString().split('T')[0];
            todayAttendance = null;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                allAttendanceRecords.push({ id: doc.id, ...data });

                if (data.status === 'approved') presentDays++;
                else if (data.status === 'pending') pendingDays++;
                else if (data.status === 'rejected') absentDays++;

                if (data.date === today) todayAttendance = { id: doc.id, ...data };
            });

            const totalDaysEl = document.getElementById('totalDays');
            const presentDaysEl = document.getElementById('presentDays');
            const pendingDaysEl = document.getElementById('pendingDays');
            const absentDaysEl = document.getElementById('absentDays');

            if (totalDaysEl) totalDaysEl.textContent = totalDays;
            if (presentDaysEl) presentDaysEl.textContent = presentDays;
            if (pendingDaysEl) pendingDaysEl.textContent = pendingDays;
            if (absentDaysEl) absentDaysEl.textContent = absentDays;

            updateTodayStatus();
            loadRecentAttendance();
        })
        .catch((error) => {
            console.error('Error loading attendance data:', error);
            showToast('Error loading attendance data: ' + error.message, 'error');
        });

    loadRecentActivity();
}

// Update today's attendance status
function updateTodayStatus() {
    const todayStatus = document.getElementById('todayStatus');
    const markBtn = document.getElementById('markAttendanceBtn');
    const statusDiv = document.getElementById('attendanceStatus');
    
    if (!todayStatus || !markBtn || !statusDiv) return;

    if (todayAttendance) {
        markBtn.disabled = true;
        markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Already Marked';

        let statusText = '';
        let statusClass = '';

        switch (todayAttendance.status) {
            case 'pending':
                statusText = 'Your attendance for today is pending teacher approval.';
                statusClass = 'pending';
                break;
            case 'approved':
                statusText = `Your attendance for today has been approved.`;
                statusClass = 'approved';
                break;
            case 'rejected':
                statusText = `Your attendance for today was rejected. ${todayAttendance.remarks ? 'Reason: ' + todayAttendance.remarks : 'Please contact your teacher.'}`;
                statusClass = 'rejected';
                break;
        }

        statusDiv.innerHTML = statusText;
        statusDiv.className = `attendance-status ${statusClass}`;
        statusDiv.style.display = 'block';

        todayStatus.innerHTML = `Today's Status: <span class="status-badge ${todayAttendance.status}">${todayAttendance.status}</span>`;
    } else {
        markBtn.disabled = false;
        markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark Me Present Today';
        statusDiv.style.display = 'none';

        const now = new Date();
        const hours = now.getHours();

        if (hours < 7 || hours > 17) {
            todayStatus.innerHTML = 'Attendance can only be marked during school hours (7AM - 5PM).';
            markBtn.disabled = true;
        } else {
            todayStatus.innerHTML = 'You haven\'t marked attendance for today yet.';
        }
    }
}

// Mark attendance
function markAttendance() {
    if (!studentData || !studentData.id) {
        showToast('Student data not loaded. Please wait and try again.', 'error');
        if (currentUser) loadStudentData(currentUser.uid);
        return;
    }

    const now = new Date();
    const hours = now.getHours();

    if (hours < 7 || hours > 17) {
        showToast('Attendance can only be marked during school hours (7AM - 5PM).', 'error');
        return;
    }

    if (todayAttendance) {
        showToast('You have already marked attendance for today.', 'info');
        return;
    }

    const markBtn = document.getElementById('markAttendanceBtn');
    if (!markBtn) return;

    const originalText = markBtn.innerHTML;
    markBtn.disabled = true;
    markBtn.innerHTML = '<span class="spinner"></span> Marking...';

    const today = new Date().toISOString().split('T')[0];

    db.collection('attendance').add({
        studentId: studentData.id,
        studentName: studentData.name,
        date: today,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        studentIdNumber: studentData.studentId || 'N/A'
    })
    .then((docRef) => {
        showToast('Attendance marked successfully! Waiting for teacher approval.', 'success');
        return db.collection('activities').add({
            message: `${studentData.name} marked attendance for ${today}`,
            icon: 'fa-user-check',
            type: 'attendance',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    })
    .then(() => loadDashboardData())
    .catch((error) => {
        console.error('Error marking attendance:', error);
        showToast('Error marking attendance: ' + error.message, 'error');
        markBtn.disabled = false;
        markBtn.innerHTML = originalText;
    });
}

// Set up realtime listeners
function setupRealtimeListeners() {
    if (!studentData || !studentData.id) return;

    db.collection('attendance')
        .where('studentId', '==', studentData.id)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    loadDashboardData();
                    if (change.type === 'modified') {
                        const newData = change.doc.data();
                        const oldData = change.doc._previousData || {};
                        if (newData.status !== oldData.status) {
                            let message = '';
                            if (newData.status === 'approved') message = `Your attendance for ${newData.date} has been approved!`;
                            else if (newData.status === 'rejected') message = `Your attendance for ${newData.date} was rejected. ${newData.remarks ? 'Reason: ' + newData.remarks : ''}`;
                            if (message) showToast(message, newData.status === 'approved' ? 'success' : 'error');
                        }
                    }
                }
            });
        }, (error) => {
            console.error('Error in realtime listener:', error);
        });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3000);
}

// Logout
function logout() {
    auth.signOut()
        .then(() => { window.location.href = 'login.html'; })
        .catch((error) => {
            console.error('Error signing out:', error);
            showToast('Error signing out.', 'error');
        });
}

document.addEventListener('DOMContentLoaded', function() {
    markBtn = document.getElementById('markAttendanceBtn');
    
    if (markBtn) {
        markBtn.disabled = true; // disable until student data loads
    }
    
    // Setup mobile menu
    setupMobileMenu();
    
    // Show dashboard by default
    showSection('dashboard');
});

