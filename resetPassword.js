// First, make sure you have Firebase initialized in your project
// Add this to your HTML head section (if not already added):
/*
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
*/

// Firebase configuration (replace with your config)
const firebaseConfig = {
    apiKey: "AIzaSyDV1Wcl9a19chq6JsVR-TCDQhT0tS1BzFo",
    authDomain: "stkcollegeattendance.firebaseapp.com",
    projectId: "stkcollegeattendance",
    storageBucket: "stkcollegeattendance.firebasestorage.app",
    messagingSenderId: "574527402732",
    appId: "1:574527402732:web:ecedfb8d3e9aa693776bc9",
    measurementId: "G-8SDMWZ8H9Z"
};

// Initialize Firebase (if not already done)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// DOM Elements
const emailForm = document.getElementById('emailForm');
const passwordForm = document.getElementById('passwordForm');
const steps = document.querySelectorAll('.step');
const progressSteps = document.querySelectorAll('.progress-step');
const progressBar = document.querySelector('.progress-bar');
const userEmailSpan = document.getElementById('userEmail');
const sendResetBtn = document.getElementById('sendResetBtn');
const resendBtn = document.getElementById('resendBtn');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordStrengthBar = document.getElementById('passwordStrengthBar');
const toggleNewPassword = document.getElementById('toggleNewPassword');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

// Current step tracker
let currentStep = 1;
let userEmail = '';

// Get reset token from URL parameters
function getResetToken() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('oobCode'); // Firebase uses 'oobCode' parameter
}

// Check if this is a password reset confirmation page
function checkResetMode() {
    const mode = new URLSearchParams(window.location.search).get('mode');
    const oobCode = getResetToken();
    
    if (mode === 'resetPassword' && oobCode) {
        // User clicked reset link from email, show step 3 directly
        showStep(3);
        return true;
    }
    return false;
}

// Show a specific step
function showStep(stepNumber) {
    steps.forEach(step => step.classList.remove('active'));
    document.getElementById(`step${stepNumber}`).classList.add('active');
    currentStep = stepNumber;
    
    // Update progress bar
    progressSteps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < stepNumber) {
            step.classList.add('completed');
        } else if (index + 1 === stepNumber) {
            step.classList.add('active');
        }
    });
    
    // Update progress bar width
    const progressWidth = (stepNumber - 1) * 50;
    progressBar.style.setProperty('--progress-width', `${progressWidth}%`);
}

// Toast notification function
function showToast(message, type) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    const rules = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password)
    };
    
    // Update rules UI
    document.getElementById('ruleLength').className = rules.length ? 'rule-valid' : 'rule-invalid';
    document.getElementById('ruleUppercase').className = rules.uppercase ? 'rule-valid' : 'rule-invalid';
    document.getElementById('ruleLowercase').className = rules.lowercase ? 'rule-valid' : 'rule-invalid';
    document.getElementById('ruleNumber').className = rules.number ? 'rule-valid' : 'rule-invalid';
    
    // Calculate strength
    if (rules.length) strength += 25;
    if (rules.uppercase) strength += 25;
    if (rules.lowercase) strength += 25;
    if (rules.number) strength += 25;
    
    // Update strength bar
    passwordStrengthBar.style.width = `${strength}%`;
    
    // Set color based on strength
    if (strength < 50) {
        passwordStrengthBar.style.backgroundColor = '#ef4444'; // danger color
    } else if (strength < 100) {
        passwordStrengthBar.style.backgroundColor = '#f59e0b'; // warning color
    } else {
        passwordStrengthBar.style.backgroundColor = '#10b981'; // success color
    }
    
    return strength === 100;
}

// Toggle password visibility
function setupPasswordToggle(toggleElement, inputElement) {
    toggleElement.addEventListener('click', function() {
        const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
        inputElement.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
}

// Send password reset email using Firebase
async function sendPasswordResetEmail(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        let message = 'Error sending reset email';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email address';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address';
                break;
            case 'auth/too-many-requests':
                message = 'Too many requests. Please try again later';
                break;
            default:
                message = error.message;
        }
        
        return { success: false, message };
    }
}

// Confirm password reset using Firebase
async function confirmPasswordReset(oobCode, newPassword) {
    try {
        await auth.confirmPasswordReset(oobCode, newPassword);
        return { success: true };
    } catch (error) {
        let message = 'Error resetting password';
        
        switch (error.code) {
            case 'auth/expired-action-code':
                message = 'Reset link has expired. Please request a new one';
                break;
            case 'auth/invalid-action-code':
                message = 'Invalid reset link. Please request a new one';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak. Please choose a stronger password';
                break;
            default:
                message = error.message;
        }
        
        return { success: false, message };
    }
}

// Event Listeners
emailForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    if (!email) {
        showToast('Please enter your email address', 'danger');
        return;
    }
    
    // Show loading state
    sendResetBtn.classList.add('btn-loading');
    
    // Send reset email using Firebase
    const result = await sendPasswordResetEmail(email);
    
    if (result.success) {
        // Store email for later use
        userEmail = email;
        userEmailSpan.textContent = email;
        
        // Move to next step
        showStep(2);
        showToast('Password reset link sent to your email', 'success');
    } else {
        showToast(result.message, 'danger');
    }
    
    // Remove loading state
    sendResetBtn.classList.remove('btn-loading');
});

resendBtn.addEventListener('click', async function() {
    if (!userEmail) {
        showToast('Please enter your email first', 'danger');
        showStep(1);
        return;
    }
    
    // Show loading state
    resendBtn.classList.add('btn-loading');
    
    // Resend reset email
    const result = await sendPasswordResetEmail(userEmail);
    
    if (result.success) {
        showToast('Reset link sent again', 'success');
    } else {
        showToast(result.message, 'danger');
    }
    
    // Remove loading state
    resendBtn.classList.remove('btn-loading');
});

passwordForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const oobCode = getResetToken();
    
    if (!oobCode) {
        showToast('Invalid reset link', 'danger');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'danger');
        return;
    }
    
    if (!checkPasswordStrength(newPassword)) {
        showToast('Please choose a stronger password', 'danger');
        return;
    }
    
    // Show loading state
    resetPasswordBtn.classList.add('btn-loading');
    
    // Confirm password reset using Firebase
    const result = await confirmPasswordReset(oobCode, newPassword);
    
    if (result.success) {
        // Move to success step
        showStep(4);
        showToast('Password reset successfully', 'success');
    } else {
        showToast(result.message, 'danger');
    }
    
    // Remove loading state
    resetPasswordBtn.classList.remove('btn-loading');
});

// Check password strength as user types
newPasswordInput.addEventListener('input', function() {
    checkPasswordStrength(this.value);
});

// Setup password visibility toggles
setupPasswordToggle(toggleNewPassword, newPasswordInput);
setupPasswordToggle(toggleConfirmPassword, confirmPasswordInput);

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    if (!checkResetMode()) {
        // Show step 1 if not coming from reset email
        showStep(1);
    }
});