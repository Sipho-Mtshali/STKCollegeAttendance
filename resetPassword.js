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

        // Event Listeners
        emailForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            if (!email) {
                showToast('Please enter your email address', 'danger');
                return;
            }
            
            // Show loading state
            sendResetBtn.classList.add('btn-loading');
            
            // Simulate API call
            setTimeout(() => {
                // Store email for later use
                userEmailSpan.textContent = email;
                
                // Move to next step
                showStep(2);
                showToast('Password reset link sent to your email', 'success');
                
                // Remove loading state
                sendResetBtn.classList.remove('btn-loading');
            }, 1500);
        });

        resendBtn.addEventListener('click', function() {
            const email = document.getElementById('email').value;
            
            // Show loading state
            resendBtn.classList.add('btn-loading');
            
            // Simulate API call
            setTimeout(() => {
                showToast('Reset link sent again', 'success');
                
                // Remove loading state
                resendBtn.classList.remove('btn-loading');
            }, 1000);
        });

        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
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
            
            // Simulate API call
            setTimeout(() => {
                // Move to success step
                showStep(4);
                showToast('Password reset successfully', 'success');
                
                // Remove loading state
                resetPasswordBtn.classList.remove('btn-loading');
            }, 1500);
        });

        // Check password strength as user types
        newPasswordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });

        // Setup password visibility toggles
        setupPasswordToggle(toggleNewPassword, newPasswordInput);
        setupPasswordToggle(toggleConfirmPassword, confirmPasswordInput);