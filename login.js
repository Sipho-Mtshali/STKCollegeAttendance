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

        // Set persistence to session instead of local to prevent automatic login
        auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .catch((error) => {
                console.error("Error setting auth persistence:", error);
            });

        // DOM Elements
        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const passwordToggle = document.getElementById('passwordToggle');
        const loginButton = document.getElementById('loginButton');
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const roleRadios = document.querySelectorAll('input[name="role"]');
        const rememberMe = document.getElementById('rememberMe');

        // Toggle password visibility
        passwordToggle.addEventListener('click', function() {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                passwordToggle.classList.remove('fa-eye');
                passwordToggle.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                passwordToggle.classList.remove('fa-eye-slash');
                passwordToggle.classList.add('fa-eye');
            }
        });

        // Show toast notification
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                ${message}
            `;
            
            document.getElementById('toastContainer').appendChild(toast);
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        // Show error message
        function showError(message) {
            errorText.textContent = message;
            errorMessage.classList.add('show');
        }

        // Hide error message
        function hideError() {
            errorMessage.classList.remove('show');
        }

        // Handle form submission
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const selectedRole = document.querySelector('input[name="role"]:checked').value;
            const remember = rememberMe.checked;
            
            // Basic validation
            if (!email || !password) {
                showError('Please fill in all fields');
                return;
            }
            
            // Set persistence based on remember me selection
            const persistence = remember ? 
                firebase.auth.Auth.Persistence.LOCAL : 
                firebase.auth.Auth.Persistence.SESSION;
            
            await auth.setPersistence(persistence);
            
            // Show loading state
            loginButton.innerHTML = '';
            loginButton.classList.add('btn-loading');
            loginButton.disabled = true;
            hideError();
            
            try {
                // Sign in with Firebase Auth
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Check user role in Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    await auth.signOut();
                    throw new Error('User profile not found. Please contact administrator.');
                }
                
                const userData = userDoc.data();
                
                // Verify role matches selection
                if (userData.role !== selectedRole) {
                    await auth.signOut();
                    throw new Error(`You are not registered as a ${selectedRole}. Please select the correct role.`);
                }
                
                showToast('Login successful! Redirecting...');
                
                // Redirect based on role after a brief delay
                setTimeout(() => {
                    switch (selectedRole) {
                        case 'admin':
                            window.location.href = 'admin.html';
                            break;
                        case 'teacher':
                            window.location.href = 'teacher.html';
                            break;
                        case 'student':
                            window.location.href = 'student.html';
                            break;
                    }
                }, 1500);
                
            } catch (error) {
                console.error('Login error:', error);
                
                // Reset button state
                loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
                loginButton.classList.remove('btn-loading');
                loginButton.disabled = false;
                
                // Show appropriate error message
                let errorMessage = 'Login failed. Please try again.';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password. Please try again.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address format.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later.';
                        break;
                    default:
                        errorMessage = error.message || 'An unexpected error occurred.';
                }
                
                showError(errorMessage);
            }
        });

        // Clear any existing auth state on page load
        window.addEventListener('load', () => {
            // We're not automatically redirecting anymore
            console.log('Login page loaded. Ready for credentials.');
        });