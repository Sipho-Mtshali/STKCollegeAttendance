// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDV1Wcl9a19chq6JsVR-TCDQhT0tS1BzFo",
  authDomain: "stkcollegeattendance.firebaseapp.com",
  projectId: "stkcollegeattendance",
  storageBucket: "stkcollegeattendance.firebasestorage.app",
  messagingSenderId: "574527402732",
  appId: "1:574527402732:web:ecedfb8d3e9aa693776bc9",
  measurementId: "G-8SDMWZ8H9Z"
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other files
window.auth = auth;
window.db = db;

// Add error listeners
auth.onAuthStateChanged((user) => {
    console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
});

// Add Firestore error listener
db.enablePersistence()
  .catch((err) => {
      console.error('Firestore persistence error:', err);
  });

/*
SETUP INSTRUCTIONS:

1. Go to Firebase Console (https://console.firebase.google.com)
2. Create a new project or select existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in test mode (or production with proper rules)
   
5. Get your config:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps" 
   - Click "Config" and copy the firebaseConfig object
   - Replace the config above with your actual values

6. Set up Firestore Security Rules:
   - Go to Firestore Database > Rules
   - Replace with the following rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - only authenticated users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Students collection - teachers can read/write, students can read their own
    match /students/{studentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        resource.data.teacherId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    // Attendance collection - students can create, teachers can read/write
    match /attendance/{attendanceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.studentId;
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
  }
}

7. Optional - Enable Firebase Hosting:
   - Install Firebase CLI: npm install -g firebase-tools
   - Run: firebase init hosting
   - Deploy: firebase deploy

FIRESTORE COLLECTIONS STRUCTURE:

1. users/
   - {userId}: {
       email: string,
       role: 'teacher' | 'student',
       name: string,
       createdAt: timestamp
     }

2. students/
   - {studentId}: {
       name: string,
       email: string,
       studentId: string,
       teacherId: string,
       createdAt: timestamp
     }

3. attendance/
   - {attendanceId}: {
       studentId: string,
       studentName: string,
       date: string (YYYY-MM-DD),
       timestamp: timestamp,
       status: 'pending' | 'approved' | 'rejected',
       approvedBy: string (optional),
       approvedAt: timestamp (optional)
     }
*/