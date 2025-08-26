// Global variables
let currentUser = null;
let userRole = null;

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Authentication Functions
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

function showLoading(show = true) {
    const form = document.getElementById('loginForm');
    const spinner = document.getElementById('loadingSpinner');
    
    if (show) {
        form.style.display = 'none';
        spinner.style.display = 'block';
    } else {
        form.style.display = 'flex';
        spinner.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Login Form Handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.querySelector('input[name="role"]:checked').value;
        
        showLoading(true);
        
        try {
            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Check user role in Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                throw new Error('User profile not found');
            }
            
            const userData = userDoc.data();
            
            // Verify role matches selection
            if (userData.role !== role) {
                throw new Error(`You are not registered as a ${role}`);
            }
            
            // Redirect based on role
            if (role === 'teacher') {
                window.location.href = 'teacher.html';
            } else {
                window.location.href = 'student.html';
            }
            
        } catch (error) {
            showLoading(false);
            let errorMessage = 'Login failed. Please try again.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Try again later';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            showError(errorMessage);
        }
    });
}

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        // Get user role from Firestore
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userRole = userDoc.data().role;
                
                // Update UI with user name
                const userName = userDoc.data().name || user.email;
                const nameElement = document.getElementById('teacherName') || 
                                  document.getElementById('studentName');
                if (nameElement) {
                    nameElement.textContent = `Welcome, ${userName}`;
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
        
    } else {
        currentUser = null;
        userRole = null;
        
        // Redirect to login if not on login page
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
        }
    }
});

// Logout Function
function logout() {
    auth.signOut().then(() => {
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }).catch((error) => {
        showNotification('Error logging out', 'error');
        console.error('Logout error:', error);
    });
}

// Page Load Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state on dashboard pages
    if (window.location.pathname.includes('teacher.html') || 
        window.location.pathname.includes('student.html')) {
        
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    throw new Error('User profile not found');
                }
                
                const userData = userDoc.data();
                const expectedRole = window.location.pathname.includes('teacher.html') ? 'teacher' : 'student';
                
                if (userData.role !== expectedRole) {
                    window.location.href = 'index.html';
                    return;
                }
                
                // Initialize page-specific functionality
                if (expectedRole === 'teacher') {
                    initTeacherDashboard();
                } else {
                    initStudentDashboard();
                }
                
            } catch (error) {
                console.error('Error verifying user:', error);
                window.location.href = 'index.html';
            }
        });
    }
    
    // Update current time on student page
    if (document.getElementById('currentTime')) {
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
    }
    
    // Set current date on student page
    if (document.getElementById('currentDate')) {
        document.getElementById('currentDate').textContent = formatDate(new Date());
    }
});

function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = formatTime(new Date());
    }
}

// Initialize dashboard functions (will be called from respective JS files)