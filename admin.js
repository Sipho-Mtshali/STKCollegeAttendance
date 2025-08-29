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

        // Check authentication state
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in
                document.getElementById('userNameDisplay').textContent = user.displayName || user.email;
                checkAdminRole(user.uid);
                loadDashboardData();
                setupRealtimeListeners();
            } else {
                // No user is signed in, redirect to login
                window.location.href = 'login.html';
            }
        });

        // Check if user has admin role
        function checkAdminRole(uid) {
            db.collection('users').doc(uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        if (userData.role !== 'admin') {
                            showToast('Access denied. Admin privileges required.', 'error');
                            setTimeout(() => {
                                logout();
                            }, 2000);
                        }
                    }
                })
                .catch((error) => {
                    console.error('Error checking user role:', error);
                    showToast('Error verifying permissions.', 'error');
                });
        }

        // Load dashboard data
        function loadDashboardData() {
            // Load user counts
            db.collection('users').where('role', '==', 'student').get()
                .then((querySnapshot) => {
                    document.getElementById('totalStudents').textContent = querySnapshot.size;
                });

            db.collection('users').where('role', '==', 'teacher').get()
                .then((querySnapshot) => {
                    document.getElementById('totalTeachers').textContent = querySnapshot.size;
                });

            // Load attendance data
            db.collection('attendance')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get()
                .then((querySnapshot) => {
                    const tbody = document.getElementById('attendanceTableBody');
                    tbody.innerHTML = '';
                    
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        const row = document.createElement('tr');
                        
                        row.innerHTML = `
                            <td>${data.studentName}</td>
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
                });

            // Load recent activities
            db.collection('activities')
                .orderBy('timestamp', 'desc')
                .limit(4)
                .get()
                .then((querySnapshot) => {
                    const activityList = document.getElementById('activityList');
                    activityList.innerHTML = '';
                    
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
                });
        }

        // Set up realtime listeners
        function setupRealtimeListeners() {
            // Listen for new attendance records
            db.collection('attendance')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .onSnapshot((snapshot) => {
                    const tbody = document.getElementById('attendanceTableBody');
                    tbody.innerHTML = '';
                    
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        const row = document.createElement('tr');
                        
                        row.innerHTML = `
                            <td>${data.studentName}</td>
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
                });

            // Listen for new activities
            db.collection('activities')
                .orderBy('timestamp', 'desc')
                .limit(4)
                .onSnapshot((snapshot) => {
                    const activityList = document.getElementById('activityList');
                    activityList.innerHTML = '';
                    
                    snapshot.forEach((doc) => {
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
                });
        }

        // Format time ago
        function formatTimeAgo(date) {
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);
            
            if (seconds < 60) return `${seconds} seconds ago`;
            
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes} minutes ago`;
            
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours} hours ago`;
            
            const days = Math.floor(hours / 24);
            return `${days} days ago`;
        }

        // Add user form submission
        document.getElementById('addUserForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const userName = document.getElementById('userName').value;
            const userEmail = document.getElementById('userEmail').value;
            const userRole = document.getElementById('userRole').value;
            const userPassword = document.getElementById('userPassword').value;
            const submitButton = document.getElementById('submitButton');
            
            // Show loading state
            submitButton.innerHTML = '<span class="spinner"></span> Adding User...';
            submitButton.disabled = true;
            
            // Create user with Firebase Auth
            auth.createUserWithEmailAndPassword(userEmail, userPassword)
                .then((userCredential) => {
                    // Add user data to Firestore
                    return db.collection('users').doc(userCredential.user.uid).set({
                        name: userName,
                        email: userEmail,
                        role: userRole,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => {
                    // Log activity
                    return db.collection('activities').add({
                        message: `New ${userRole} registered: ${userName}`,
                        icon: userRole === 'student' ? 'fa-user-graduate' : 
                              userRole === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-cog',
                        type: 'user',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => {
                    showToast('User added successfully!', 'success');
                    document.getElementById('addUserForm').reset();
                })
                .catch((error) => {
                    console.error('Error adding user:', error);
                    showToast(`Error: ${error.message}`, 'error');
                })
                .finally(() => {
                    // Reset button state
                    submitButton.innerHTML = '<i class="fas fa-plus"></i> Add User';
                    submitButton.disabled = false;
                });
        });

        // Export attendance as PDF
        function exportAttendancePDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(18);
            doc.text('STK College - Attendance Report', 14, 22);
            
            // Add date
            doc.setFontSize(12);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
            
            // Get attendance data
            db.collection('attendance')
                .orderBy('timestamp', 'desc')
                .get()
                .then((querySnapshot) => {
                    const tableData = [];
                    
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        tableData.push([
                            data.studentName,
                            new Date(data.timestamp.toDate()).toLocaleDateString(),
                            new Date(data.timestamp.toDate()).toLocaleTimeString(),
                            data.status
                        ]);
                    });
                    
                    // Add table to PDF
                    doc.autoTable({
                        head: [['Student', 'Date', 'Time', 'Status']],
                        body: tableData,
                        startY: 40,
                        styles: { fontSize: 10 },
                        headStyles: { fillColor: [79, 70, 229] }
                    });
                    
                    // Save the PDF
                    doc.save(`attendance-report-${new Date().toISOString().split('T')[0]}.pdf`);
                    showToast('PDF exported successfully!', 'success');
                })
                .catch((error) => {
                    console.error('Error generating PDF:', error);
                    showToast('Error generating PDF report.', 'error');
                });
        }

        // Download individual attendance record
        function downloadAttendanceRecord(recordId) {
            db.collection('attendance').doc(recordId).get()
                .then((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        const { jsPDF } = window.jspdf;
                        const pdfDoc = new jsPDF();
                        
                        pdfDoc.setFontSize(16);
                        pdfDoc.text('STK College - Attendance Record', 14, 22);
                        
                        pdfDoc.setFontSize(12);
                        pdfDoc.text(`Student: ${data.studentName}`, 14, 32);
                        pdfDoc.text(`Date: ${new Date(data.timestamp.toDate()).toLocaleDateString()}`, 14, 40);
                        pdfDoc.text(`Time: ${new Date(data.timestamp.toDate()).toLocaleTimeString()}`, 14, 48);
                        pdfDoc.text(`Status: ${data.status}`, 14, 56);
                        
                        if (data.notes) {
                            pdfDoc.text(`Notes: ${data.notes}`, 14, 64);
                        }
                        
                        pdfDoc.save(`attendance-${data.studentName}-${new Date(data.timestamp.toDate()).toISOString().split('T')[0]}.pdf`);
                        showToast('Record downloaded successfully!', 'success');
                    }
                })
                .catch((error) => {
                    console.error('Error downloading record:', error);
                    showToast('Error downloading record.', 'error');
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