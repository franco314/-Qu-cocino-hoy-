import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCu2bc8xRiKW4vvCXwPkSG69OKoupn1rVQ",
  authDomain: "que-cocino-hoy-f06bd.firebaseapp.com",
  projectId: "que-cocino-hoy-f06bd",
  storageBucket: "que-cocino-hoy-f06bd.firebasestorage.app",
  messagingSenderId: "26918451916",
  appId: "1:26918451916:web:8b9dd39de13908461ae069",
  measurementId: "G-H8DHCL2ZVJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore (for future use)
export const db = getFirestore(app);
