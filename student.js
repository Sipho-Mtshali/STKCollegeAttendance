// Teacher Dashboard Functions
let studentsData = [];
let attendanceData = [];

function initTeacherDashboard() {
    loadStats();
    loadPendingAttendance();
    loadRecentActivity();
    setupAddStudentForm();
}

// Add Student Functionality
function setupAddStudentForm() {
    const form = document.getElementById('addStudentForm');
    if (form) {
        form.addEventListener('submit', addStudent);
    }
}

async function addStudent(e) {
    e.preventDefault();
    
    const name = document.getElementById('studentName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    const password = document.getElementById('studentPassword').value;
    
    if (!name || !studentId || !email || !password) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    const addBtn = document.querySelector('.add-btn');
    addBtn.classList.add('loading');
    addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Student...';
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;
        
        // Add to users collection
        await db.collection('users').doc(newUser.uid).set({
            email: email,
            name: name,
            role: 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to students collection
        await db.collection('students').doc(newUser.uid).set({
            name: name,
            email: email,
            studentId: studentId,
            teacherId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reset form
        document.getElementById('addStudentForm').reset();
        
        showNotification(`Student ${name} added successfully!`, 'success');
        addActivity(`Added new student: ${name} (${studentId})`);
        loadStats(); // Refresh stats
        
    } catch (error) {
        console.error('Error adding student:', error);
        let errorMessage = 'Failed to add student';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email is already registered';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Sign back in as teacher (since createUser signs in the new user)
        if (currentUser) {
            await auth.signOut();
            // The auth state observer will handle redirecting back
        }
    }
    
    // Reset button
    addBtn.classList.remove('loading');
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Student';
}

// Load Statistics
async function loadStats() {
    try {
        // Count total students
        const studentsSnapshot = await db.collection('students')
            .where('teacherId', '==', currentUser.uid)
            .get();
        
        const totalStudents = studentsSnapshot.size;
        document.getElementById('totalStudents').textContent = totalStudents;
        
        // Count pending requests
        const pendingSnapshot = await db.collection('attendance')
            .where('status', '==', 'pending')
            .get();
        
        const pendingRequests = pendingSnapshot.size;
        document.getElementById('pendingRequests').textContent = pendingRequests;
        
        // Count today's approved attendance
        const today = new Date().toISOString().split('T')[0];
        const approvedTodaySnapshot = await db.collection('attendance')
            .where('date', '==', today)
            .where('status', '==', 'approved')
            .get();
        
        const todayApproved = approvedTodaySnapshot.size;
        document.getElementById('todayApproved').textContent = todayApproved;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load Pending Attendance
async function loadPendingAttendance() {
    const tableBody = document.getElementById('pendingTableBody');
    
    try {
        const snapshot = await db.collection('attendance')
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .get();
        
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">
                        <i class="fas fa-inbox"></i>
                        <p>No pending requests</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp.toDate();
            
            html += `
                <tr>
                    <td>${data.studentName}</td>
                    <td>${data.studentId || 'N/A'}</td>
                    <td>${formatDate(new Date(data.date))}</td>
                    <td>${formatTime(timestamp)}</td>
                    <td><span class="status-badge status-pending">Pending</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="approve-btn" onclick="approveAttendance('${doc.id}', '${data.studentName}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="reject-btn" onclick="rejectAttendance('${doc.id}', '${data.studentName}')">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading pending attendance:', error);
        showNotification('Error loading attendance data', 'error');
    }
}

// Approve Attendance
async function approveAttendance(attendanceId, studentName) {
    try {
        await db.collection('attendance').doc(attendanceId).update({
            status: 'approved',
            approvedBy: currentUser.uid,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification(`Approved attendance for ${studentName}`, 'success');
        addActivity(`Approved attendance for ${studentName}`);
        loadPendingAttendance();
        loadStats();
        
    } catch (error) {
        console.error('Error approving attendance:', error);
        showNotification('Failed to approve attendance', 'error');
    }
}

// Reject Attendance
async function rejectAttendance(attendanceId, studentName) {
    try {
        await db.collection('attendance').doc(attendanceId).update({
            status: 'rejected',
            approvedBy: currentUser.uid,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification(`Rejected attendance for ${studentName}`, 'info');
        addActivity(`Rejected attendance for ${studentName}`);
        loadPendingAttendance();
        loadStats();
        
    } catch (error) {
        console.error('Error rejecting attendance:', error);
        showNotification('Failed to reject attendance', 'error');
    }
}

// Load Recent Activity
async function loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    try {
        // Get recent attendance activities
        const snapshot = await db.collection('attendance')
            .where('status', 'in', ['approved', 'rejected'])
            .orderBy('approvedAt', 'desc')
            .limit(5)
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="activity-content">
                        <p>Welcome to STK College! Start by adding students.</p>
                        <span class="activity-time">Just now</span>
                    </div>
                </div>
            `;
        } else {
            snapshot.forEach((doc) => {
                const data = doc.data();
                const approvedAt = data.approvedAt ? data.approvedAt.toDate() : new Date();
                const timeAgo = getTimeAgo(approvedAt);
                
                const iconClass = data.status === 'approved' ? 'fa-check-circle' : 'fa-times-circle';
                const action = data.status === 'approved' ? 'Approved' : 'Rejected';
                
                html += `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="activity-content">
                            <p>${action} attendance for ${data.studentName}</p>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>
                `;
            });
        }
        
        activityList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function addActivity(message) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    const newActivity = `
        <div class="activity-item fade-in">
            <div class="activity-icon">
                <i class="fas fa-plus-circle"></i>
            </div>
            <div class="activity-content">
                <p>${message}</p>
                <span class="activity-time">Just now</span>
            </div>
        </div>
    `;
    
    activityList.insertAdjacentHTML('afterbegin', newActivity);
    
    // Remove old activities (keep only 10)
    const activities = activityList.querySelectorAll('.activity-item');
    if (activities.length > 10) {
        activities[activities.length - 1].remove();
    }
}

// Real-time listeners
function setupRealtimeListeners() {
    // Listen for new pending attendance
    db.collection('attendance')
        .where('status', '==', 'pending')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    showNotification(`New attendance request from ${data.studentName}`, 'info');
                    loadPendingAttendance();
                    loadStats();
                }
            });
        });
}

// Initialize real-time listeners when teacher dashboard loads
if (window.location.pathname.includes('teacher.html')) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            setupRealtimeListeners();
        }
    });
}