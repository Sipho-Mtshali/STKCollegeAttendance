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
let studentData = null;
let todayAttendance = null;
let allAttendanceRecords = [];
let markBtn = null;
let statusChart = null; // Add chart instance variable

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

// Check if user has student role - ENHANCED VERSION
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
    
    // First try to find student by userId in students collection
    db.collection('students')
        .where('userId', '==', uid)
        .get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                // Student found by userId field
                const doc = querySnapshot.docs[0];
                studentData = doc.data();
                studentData.id = doc.id;
                
                console.log("Student data loaded by userId:", studentData);
                
                document.getElementById('userNameDisplay').textContent = studentData.name;
                
                // Load dashboard and listeners AFTER studentData is ready
                showSection('dashboard');
                loadDashboardData();
                setupRealtimeListeners();
                setupMobileMenu();
            } else {
                // If not found, try to create student document
                createStudentDocument(uid);
            }
        })
        .catch((error) => {
            console.error('Error loading student data by userId:', error);
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        teacherId: '' // You might want to assign students to teachers
    };
    
    // First create the user document in the users collection
    db.collection('users').doc(uid).set({
        email: currentUser.email,
        role: 'student',
        name: studentDoc.name,
        studentId: studentDoc.studentId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        // Then create the student document in the students collection
        return db.collection('students').add(studentDoc);
    })
    .then((docRef) => {
        studentData = studentDoc;
        studentData.id = docRef.id;
        
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
        
        // Enable the mark button even if student data fails to load
        const markBtn = document.getElementById('markAttendanceBtn');
        if (markBtn) {
            markBtn.disabled = false;
            markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark Me Present Today';
        }
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
            // Ensure chart is updated when switching to stats section
            setTimeout(() => {
                updateStatistics();
            }, 100);
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
    if (!currentUser || !currentUser.uid) {
        console.error("Current user not available for loading dashboard");
        showToast('User not authenticated. Please log in again.', 'error');
        return;
    }

    db.collection('attendance')
        .where('studentUid', '==', currentUser.uid)
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

            // Update statistics section as well
            const statsTotalDaysEl = document.getElementById('statsTotalDays');
            const statsPresentDaysEl = document.getElementById('statsPresentDays');
            const statsPendingDaysEl = document.getElementById('statsPendingDays');
            const statsAbsentDaysEl = document.getElementById('statsAbsentDays');

            if (statsTotalDaysEl) statsTotalDaysEl.textContent = totalDays;
            if (statsPresentDaysEl) statsPresentDaysEl.textContent = presentDays;
            if (statsPendingDaysEl) statsPendingDaysEl.textContent = pendingDays;
            if (statsAbsentDaysEl) statsAbsentDaysEl.textContent = absentDays;

            // Update attendance rate
            const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
            const attendanceRateBar = document.getElementById('attendanceRateBar');
            const attendanceRateText = document.getElementById('attendanceRateText');
            
            if (attendanceRateBar) {
                attendanceRateBar.style.width = `${attendanceRate}%`;
                attendanceRateBar.textContent = `${attendanceRate}%`;
            }
            if (attendanceRateText) attendanceRateText.textContent = `${attendanceRate}% attendance rate`;

            updateTodayStatus();
            loadRecentAttendance();
            
            // FIX 2: Update the status chart with current data
            updateStatusChart(presentDays, pendingDays, absentDays);
        })
        .catch((error) => {
            console.error('Error loading attendance data:', error);
            showToast('Error loading attendance data: ' + error.message, 'error');
        });

    loadRecentActivity();
}

// FIX 2: Create and update status chart properly
function updateStatusChart(approved, pending, rejected) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (statusChart) {
        statusChart.destroy();
    }

    // Only create chart if there's data to display
    const hasData = approved > 0 || pending > 0 || rejected > 0;
    
    if (!hasData) {
        ctx.style.display = 'none';
        const parent = ctx.parentElement;
        if (parent) {
            let noDataMsg = parent.querySelector('.no-data-message');
            if (!noDataMsg) {
                noDataMsg = document.createElement('div');
                noDataMsg.className = 'no-data-message';
                noDataMsg.innerHTML = '<p style="text-align: center; color: #666; margin-top: 50px;">No attendance data yet</p>';
                parent.appendChild(noDataMsg);
            }
        }
        return;
    }

    ctx.style.display = 'block';
    const parent = ctx.parentElement;
    if (parent) {
        const noDataMsg = parent.querySelector('.no-data-message');
        if (noDataMsg) noDataMsg.remove();
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [{
                data: [approved, pending, rejected],
                backgroundColor: [
                    '#10b981', // Green for approved
                    '#f59e0b', // Orange for pending  
                    '#ef4444'  // Red for rejected
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
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
                // FIX 3: Show admin comments correctly - check multiple possible field names
                const comment = todayAttendance.remarks || todayAttendance.comment || todayAttendance.notes || '';
                statusText = `Your attendance for today was rejected.${comment ? ' Reason: ' + comment : ' Please contact your teacher.'}`;
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
    if (!currentUser || !currentUser.uid) {
        showToast('User not authenticated. Please log in again.', 'error');
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
    const studentName = studentData ? studentData.name : (currentUser.displayName || currentUser.email.split('@')[0]);
    const studentId = studentData ? studentData.studentId : 'N/A';

    db.collection('attendance').add({
        studentUid: currentUser.uid,
        studentName: studentName,
        studentId: studentId,
        date: today,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
    })
    .then((docRef) => {
        showToast('Attendance marked successfully! Waiting for teacher approval.', 'success');
        return db.collection('activities').add({
            message: `${studentName} marked attendance for ${today}`,
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

// Load recent attendance
function loadRecentAttendance() {
    const tableBody = document.getElementById('recentAttendanceTableBody');
    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = '';

    // Sort by date descending and get latest 5 records
    const recentRecords = [...allAttendanceRecords]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (recentRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No attendance records found</td></tr>';
        return;
    }

    recentRecords.forEach(record => {
        const row = document.createElement('tr');
        
        const date = new Date(record.date);
        const formattedDate = date.toLocaleDateString();
        const formattedTime = record.timestamp ? record.timestamp.toDate().toLocaleTimeString() : 'N/A';
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${formattedTime}</td>
            <td><span class="status-badge ${record.status}">${record.status}</span></td>
            <td>${record.approvedBy || 'N/A'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Load attendance history
function loadAttendanceHistory() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = '';

    // Get status filter value
    const statusFilter = document.getElementById('statusFilter').value;

    // Filter records if needed
    let filteredRecords = allAttendanceRecords;
    if (statusFilter !== 'all') {
        filteredRecords = allAttendanceRecords.filter(record => record.status === statusFilter);
    }

    // Sort by date descending
    filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No attendance records found</td></tr>';
        return;
    }

    filteredRecords.forEach(record => {
        const row = document.createElement('tr');
        
        const date = new Date(record.date);
        const formattedDate = date.toLocaleDateString();
        const formattedTime = record.timestamp ? record.timestamp.toDate().toLocaleTimeString() : 'N/A';
        
        // FIX 3: Display admin comments correctly - check multiple possible field names and only show N/A if truly no comment
        let comment = 'N/A';
        if (record.status === 'rejected' || record.status === 'approved') {
            const adminComment = record.remarks || record.comment || record.notes || '';
            if (adminComment && adminComment.trim() !== '') {
                comment = adminComment.trim();
            }
        }
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${formattedTime}</td>
            <td><span class="status-badge ${record.status}">${record.status}</span></td>
            <td>${record.approvedBy || 'N/A'}</td>
            <td>${comment}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Filter attendance history
function filterAttendance() {
    loadAttendanceHistory();
}

// Update statistics
function updateStatistics() {
    // This is already handled in loadDashboardData()
    // We just need to make sure the stats section is updated
    loadDashboardData();
}

// FIX 1: Load recent activity with duplicate prevention
function loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    // Clear existing items
    activityList.innerHTML = '';

    // Get recent activities that mention this student
    const studentName = studentData ? studentData.name : (currentUser.displayName || currentUser.email.split('@')[0]);
    
    db.collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(20) // Get more records to filter duplicates
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                activityList.innerHTML = '<li class="empty-state">No recent activity</li>';
                return;
            }

            // FIX 1: Use a Set to track unique activities and prevent duplicates
            const uniqueActivities = new Map();
            const studentRelatedActivities = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // Only show activities that mention this student specifically
                if (data.message && data.message.includes(studentName)) {
                    // Create a unique key based on message content and date
                    const activityDate = data.timestamp ? data.timestamp.toDate().toDateString() : 'No Date';
                    const uniqueKey = `${data.message}-${activityDate}`;
                    
                    // Only add if we haven't seen this exact activity before
                    if (!uniqueActivities.has(uniqueKey)) {
                        uniqueActivities.set(uniqueKey, true);
                        studentRelatedActivities.push({
                            id: doc.id,
                            ...data
                        });
                    }
                }
            });

            // Sort by timestamp and limit to 5 most recent unique activities
            studentRelatedActivities
                .sort((a, b) => {
                    const timeA = a.timestamp ? a.timestamp.toDate() : new Date(0);
                    const timeB = b.timestamp ? b.timestamp.toDate() : new Date(0);
                    return timeB - timeA;
                })
                .slice(0, 5)
                .forEach((data) => {
                    const item = document.createElement('li');
                    item.className = 'activity-item';
                    
                    const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : 'N/A';
                    
                    item.innerHTML = `
                        <div class="activity-icon blue">
                            <i class="fas ${data.icon || 'fa-bell'}"></i>
                        </div>
                        <div class="activity-content">
                            <p>${data.message}</p>
                            <span class="activity-time">${time}</span>
                        </div>
                    `;
                    
                    activityList.appendChild(item);
                });

            // If no activities were added, show message
            if (activityList.children.length === 0) {
                activityList.innerHTML = '<li class="empty-state">No recent activity related to you</li>';
            }
        })
        .catch((error) => {
            console.error('Error loading activities:', error);
            activityList.innerHTML = '<li class="empty-state">Error loading activities</li>';
        });
}

// Set up realtime listeners
function setupRealtimeListeners() {
    if (!currentUser || !currentUser.uid) return;

    // Listen for attendance changes
    db.collection('attendance')
        .where('studentUid', '==', currentUser.uid)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    loadDashboardData();
                    if (change.type === 'modified') {
                        const newData = change.doc.data();
                        const oldData = change.doc._previousData || {};
                        if (newData.status !== oldData.status) {
                            let message = '';
                            if (newData.status === 'approved') {
                                message = `Your attendance for ${newData.date} has been approved!`;
                            } else if (newData.status === 'rejected') {
                                // FIX 3: Include admin comment in notification
                                const comment = newData.remarks || newData.comment || newData.notes || '';
                                message = `Your attendance for ${newData.date} was rejected.${comment ? ' Reason: ' + comment : ''}`;
                            }
                            if (message) showToast(message, newData.status === 'approved' ? 'success' : 'error');
                        }
                    }
                }
            });
        }, (error) => {
            console.error('Error in realtime listener:', error);
        });

    // Listen for activity changes
    db.collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot((snapshot) => {
            loadRecentActivity();
        }, (error) => {
            console.error('Error in activity listener:', error);
        });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3000);
}

// Logout
function logout() {
    auth.signOut()
        .then(() => {
            console.log('User signed out successfully');
            window.location.href = 'login.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
            showToast('Error signing out. Please try again.', 'error');
        });
}

// Initialize the mark attendance button
function initMarkAttendanceButton() {
    markBtn = document.getElementById('markAttendanceBtn');
    if (markBtn) {
        // Enable button by default - it will be disabled if needed
        markBtn.disabled = false;
    }
}

// Show profile modal
function showProfileModal() {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    
    // Fill the form with current user data
    document.getElementById('profileName').value = studentData ? studentData.name : (currentUser.displayName || currentUser.email.split('@')[0]);
    document.getElementById('profilePassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    
    modal.style.display = 'flex';
}

// Close profile modal
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'none';
}

// Handle profile form submission
function handleProfileUpdate(e) {
    e.preventDefault();
    
    const name = document.getElementById('profileName').value.trim();
    const password = document.getElementById('profilePassword').value;
    const confirmPassword = document.getElementById('profileConfirmPassword').value;
    
    // Validate form
    if (!name) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    if (password && password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password && password.length < 6) {
        showToast('Password should be at least 6 characters', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#profileForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
    
    // Update profile
    updateProfile(name, password)
        .then(() => {
            showToast('Profile updated successfully', 'success');
            closeProfileModal();
        })
        .catch((error) => {
            console.error('Error updating profile:', error);
            showToast('Error updating profile: ' + error.message, 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
}

// Update profile in Firebase
function updateProfile(name, password) {
    const promises = [];
    
    // Update user display name in Firebase Auth
    if (currentUser.displayName !== name) {
        promises.push(
            currentUser.updateProfile({
                displayName: name
            })
        );
    }
    
    // Update password if provided
    if (password) {
        promises.push(currentUser.updatePassword(password));
    }
    
    // Update student document in Firestore
    if (studentData && studentData.name !== name) {
        promises.push(
            db.collection('students').doc(studentData.id).update({
                name: name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
        );
        
        // Also update the user document
        promises.push(
            db.collection('users').doc(currentUser.uid).update({
                name: name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
        );
    }
    
    return Promise.all(promises)
        .then(() => {
            // Update UI with new name
            document.getElementById('userNameDisplay').textContent = name;
            if (studentData) {
                studentData.name = name;
            }
        });
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeProfileModal();
            }
        });
    }
    
    // Initialize other functions
    initMarkAttendanceButton();
    setupMobileMenu();
    showSection('dashboard');
});