// Firebase configuration - Replace with your actual config
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
                    }
                })
                .catch((error) => {
                    console.error('Error checking user role:', error);
                    showToast('Error verifying permissions.', 'error');
                });
        }

        // Load student data
        function loadStudentData(uid) {
            // Get student details
            db.collection('students').doc(uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        studentData = doc.data();
                        studentData.id = doc.id;
                        
                        // Update UI with student name
                        document.getElementById('userNameDisplay').textContent = studentData.name;
                        
                        // Load dashboard data
                        loadDashboardData();
                        setupRealtimeListeners();
                    } else {
                        showToast('Student profile not found.', 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error loading student data:', error);
                    showToast('Error loading student profile.', 'error');
                });
        }

        // Load dashboard data
        function loadDashboardData() {
            if (!studentData) return;
            
            // Load attendance statistics
            db.collection('attendance')
                .where('studentId', '==', studentData.id)
                .get()
                .then((querySnapshot) => {
                    let totalDays = querySnapshot.size;
                    let presentDays = 0;
                    let pendingDays = 0;
                    let absentDays = 0;
                    
                    // Check today's attendance
                    const today = new Date().toISOString().split('T')[0];
                    todayAttendance = null;
                    
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        
                        if (data.status === 'approved') {
                            presentDays++;
                        } else if (data.status === 'pending') {
                            pendingDays++;
                        } else if (data.status === 'rejected') {
                            absentDays++;
                        }
                        
                        // Check if today's attendance exists
                        if (data.date === today) {
                            todayAttendance = {
                                id: doc.id,
                                ...data
                            };
                        }
                    });
                    
                    // Update stats
                    document.getElementById('totalDays').textContent = totalDays;
                    document.getElementById('presentDays').textContent = presentDays;
                    document.getElementById('pendingDays').textContent = pendingDays;
                    document.getElementById('absentDays').textContent = absentDays;
                    
                    // Update today's status
                    updateTodayStatus();
                });
            
            // Load attendance history
            loadAttendanceHistory();
        }

        // Update today's attendance status
        function updateTodayStatus() {
            const todayStatus = document.getElementById('todayStatus');
            const markBtn = document.getElementById('markAttendanceBtn');
            const statusDiv = document.getElementById('attendanceStatus');
            
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
                        statusText = 'Your attendance for today was rejected. Please contact your teacher.';
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

        // Load attendance history
        function loadAttendanceHistory() {
            if (!studentData) return;
            
            db.collection('attendance')
                .where('studentId', '==', studentData.id)
                .orderBy('timestamp', 'desc')
                .get()
                .then((querySnapshot) => {
                    const tbody = document.getElementById('attendanceTableBody');
                    tbody.innerHTML = '';
                    
                    if (querySnapshot.empty) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="4" style="text-align: center; padding: 2rem; color: var(--gray-500);">
                                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                                    No attendance records found.
                                </td>
                            </tr>
                        `;
                        return;
                    }
                    
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        const row = document.createElement('tr');
                        
                        row.innerHTML = `
                            <td>${new Date(data.timestamp.toDate()).toLocaleDateString()}</td>
                            <td>${new Date(data.timestamp.toDate()).toLocaleTimeString()}</td>
                            <td><span class="status-badge ${data.status}">${data.status}</span></td>
                            <td>${data.approvedBy ? 'Teacher' : '-'}</td>
                        `;
                        
                        tbody.appendChild(row);
                    });
                })
                .catch((error) => {
                    console.error('Error loading attendance history:', error);
                    showToast('Error loading attendance history.', 'error');
                });
        }

        // Filter attendance
        function filterAttendance() {
            const filterValue = document.getElementById('statusFilter').value;
            const rows = document.getElementById('attendanceTableBody').querySelectorAll('tr');
            
            rows.forEach((row) => {
                if (filterValue === 'all') {
                    row.style.display = '';
                } else {
                    const statusCell = row.querySelector('.status-badge');
                    if (statusCell && statusCell.classList.contains(filterValue)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        }

        // Mark attendance
        function markAttendance() {
            if (!studentData) {
                showToast('Student data not loaded. Please try again.', 'error');
                return;
            }
            
            const now = new Date();
            const hours = now.getHours();
            
            // Check if within school hours
            if (hours < 7 || hours > 17) {
                showToast('Attendance can only be marked during school hours (7AM - 5PM).', 'error');
                return;
            }
            
            // Check if already marked today
            if (todayAttendance) {
                showToast('You have already marked attendance for today.', 'info');
                return;
            }
            
            const markBtn = document.getElementById('markAttendanceBtn');
            const originalText = markBtn.innerHTML;
            
            // Show loading state
            markBtn.disabled = true;
            markBtn.innerHTML = '<span class="spinner"></span> Marking...';
            
            const today = new Date().toISOString().split('T')[0];
            
            // Add attendance record
            db.collection('attendance').add({
                studentId: studentData.id,
                studentName: studentData.name,
                date: today,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                studentIdNumber: studentData.studentId || 'N/A'
            })
            .then(() => {
                showToast('Attendance marked successfully! Waiting for teacher approval.', 'success');
                
                // Add activity log
                return db.collection('activities').add({
                    message: `${studentData.name} marked attendance for ${today}`,
                    icon: 'fa-user-check',
                    type: 'attendance',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => {
                // Reload dashboard data
                loadDashboardData();
            })
            .catch((error) => {
                console.error('Error marking attendance:', error);
                showToast('Error marking attendance. Please try again.', 'error');
                markBtn.disabled = false;
                markBtn.innerHTML = originalText;
            });
        }

        // Set up realtime listeners
        function setupRealtimeListeners() {
            if (!studentData) return;
            
            // Listen for attendance updates
            db.collection('attendance')
                .where('studentId', '==', studentData.id)
                .orderBy('timestamp', 'desc')
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added' || change.type === 'modified') {
                            // Reload dashboard data when attendance changes
                            loadDashboardData();
                        }
                    });
                });
        }

        // Scroll to attendance section
        function scrollToAttendance() {
            document.getElementById('attendanceSection').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

        // Scroll to history section
        function scrollToHistory() {
            document.querySelector('.content-grid').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

        // Scroll to stats section
        function scrollToStats() {
            document.getElementById('statsSection').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

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

        // Initialize dashboard after DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Check if user is logged in
            auth.onAuthStateChanged((user) => {
                if (!user) {
                    window.location.href = 'login.html';
                }
            });
        });