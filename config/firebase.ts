import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "que-cocino-hoy-f06bd.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "que-cocino-hoy-f06bd",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "que-cocino-hoy-f06bd.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "26918451916",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:26918451916:web:8b9dd39de13908461ae069",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-H8DHCL2ZVJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);

// Initialize Functions and connect to emulator in development
export const functions = getFunctions(app);

// Connect to emulator only in development mode
// Set USE_EMULATOR to true to test with local functions
const USE_EMULATOR = true; // Set to true for local emulator testing

if (USE_EMULATOR && window.location.hostname === 'localhost') {
  connectFunctionsEmulator(functions, 'localhost', 5002);
  console.log('🔧 Connected to Firebase Functions Emulator on port 5002');
}
