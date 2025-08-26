// app.js - Main Firebase configuration and shared logic
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let userRole = null;

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await getUserRole();
    } else {
        currentUser = null;
        userRole = null;
        // Redirect to login if not on login page
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    }
});

// Get user role from Firestore
async function getUserRole() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            userRole = userDoc.data().role;
            // Redirect based on role if on login page
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                if (userRole === 'teacher') {
                    window.location.href = 'teacher.html';
                } else if (userRole === 'student') {
                    window.location.href = 'student.html';
                }
            }
        }
    } catch (error) {
        console.error('Error getting user role:', error);
        showNotification('Error fetching user data', 'error');
    }
}

// Login function
async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showNotification('Login successful!', 'success');
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. ';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format.';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many failed attempts. Try again later.';
                break;
            default:
                errorMessage += error.message;
        }
        showNotification(errorMessage, 'error');
        throw error;
    }
}

// Logout function
async function logout() {
    try {
        await signOut(auth);
        showNotification('Logged out successfully', 'success');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Error logging out', 'error');
    }
}

// Mark attendance (for students)
async function markAttendance() {
    if (!currentUser || userRole !== 'student') {
        showNotification('Unauthorized action', 'error');
        return;
    }

    try {
        // Check if already marked today
        const today = new Date().toDateString();
        const q = query(
            collection(db, 'attendance'),
            where('studentId', '==', currentUser.uid),
            where('date', '==', today)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            showNotification('Attendance already marked for today', 'warning');
            return;
        }

        // Create attendance record
        await addDoc(collection(db, 'attendance'), {
            studentId: currentUser.uid,
            studentEmail: currentUser.email,
            date: today,
            timestamp: new Date(),
            status: 'pending'
        });

        showNotification('Attendance marked successfully! Waiting for teacher approval.', 'success');
        loadStudentAttendance(); // Refresh the attendance list
    } catch (error) {
        console.error('Error marking attendance:', error);
        showNotification('Error marking attendance', 'error');
    }
}

// Load student attendance records
async function loadStudentAttendance() {
    if (!currentUser || userRole !== 'student') return;

    try {
        const q = query(
            collection(db, 'attendance'),
            where('studentId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const attendanceTableBody = document.getElementById('attendance-table-body');
        
        if (!attendanceTableBody) return;

        attendanceTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            attendanceTableBody.innerHTML = '<tr><td colspan="3" class="no-data">No attendance records found</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            
            const statusClass = data.status === 'approved' ? 'status-approved' : 
                              data.status === 'rejected' ? 'status-rejected' : 'status-pending';
            
            row.innerHTML = `
                <td>${data.date}</td>
                <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                <td><span class="status ${statusClass}">${data.status.toUpperCase()}</span></td>
            `;
            attendanceTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading attendance:', error);
        showNotification('Error loading attendance records', 'error');
    }
}

// Load pending attendance for teachers
async function loadPendingAttendance() {
    if (!currentUser || userRole !== 'teacher') return;

    try {
        const q = query(
            collection(db, 'attendance'),
            where('status', '==', 'pending'),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const pendingTableBody = document.getElementById('pending-table-body');
        
        if (!pendingTableBody) return;

        pendingTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            pendingTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No pending attendance requests</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${data.studentEmail}</td>
                <td>${data.date}</td>
                <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                <td><span class="status status-pending">PENDING</span></td>
                <td class="action-buttons">
                    <button class="btn-approve" onclick="approveAttendance('${doc.id}')">Approve</button>
                    <button class="btn-reject" onclick="rejectAttendance('${doc.id}')">Reject</button>
                </td>
            `;
            pendingTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading pending attendance:', error);
        showNotification('Error loading pending attendance', 'error');
    }
}

// Approve attendance
async function approveAttendance(docId) {
    try {
        await updateDoc(doc(db, 'attendance', docId), {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: currentUser.uid
        });
        showNotification('Attendance approved successfully', 'success');
        loadPendingAttendance();
    } catch (error) {
        console.error('Error approving attendance:', error);
        showNotification('Error approving attendance', 'error');
    }
}

// Reject attendance
async function rejectAttendance(docId) {
    try {
        await updateDoc(doc(db, 'attendance', docId), {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: currentUser.uid
        });
        showNotification('Attendance rejected successfully', 'success');
        loadPendingAttendance();
    } catch (error) {
        console.error('Error rejecting attendance:', error);
        showNotification('Error rejecting attendance', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 4000);
}

// Format date for display
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Initialize page based on current page
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Set up login form if on index page
    if (currentPage === 'index.html' || currentPage === '') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                const loginBtn = document.getElementById('login-btn');
                const originalText = loginBtn.textContent;
                loginBtn.textContent = 'Signing in...';
                loginBtn.disabled = true;
                
                try {
                    await login(email, password);
                } catch (error) {
                    // Error is already handled in login function
                } finally {
                    loginBtn.textContent = originalText;
                    loginBtn.disabled = false;
                }
            });
        }
    }
    
    // Set up logout buttons
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', logout);
    });

    // Set up mark attendance button for students
    const markAttendanceBtn = document.getElementById('mark-attendance-btn');
    if (markAttendanceBtn) {
        markAttendanceBtn.addEventListener('click', markAttendance);
    }

    // Load data based on page
    setTimeout(() => {
        if (currentPage === 'student.html' && currentUser && userRole === 'student') {
            loadStudentAttendance();
        } else if (currentPage === 'teacher.html' && currentUser && userRole === 'teacher') {
            loadPendingAttendance();
        }
    }, 1000);
});

// Export functions for global use
window.login = login;
window.logout = logout;
window.markAttendance = markAttendance;
window.approveAttendance = approveAttendance;
window.rejectAttendance = rejectAttendance;
window.loadStudentAttendance = loadStudentAttendance;
window.loadPendingAttendance = loadPendingAttendance;