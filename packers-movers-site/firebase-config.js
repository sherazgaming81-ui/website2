/* =========================================================
   firebase-config.js — Firebase SDK initialization
   =========================================================

   Your LIVE Firebase config values:
   - Project: kn-packers-and-movers
   - Storage: kn-packers-and-movers.firebasestorage.app (NEW format)
   ========================================================= */

// Firebase SDK v10.7.1 (modular imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ✅ YOUR REAL FIREBASE CONFIG (updated from your SDK)
const firebaseConfig = {
  apiKey: "AIzaSyASd1Cz-ojXleq1OiZRMUhiO4EVYSMlPeE",
  authDomain: "kn-packers-and-movers.firebaseapp.com",
  projectId: "kn-packers-and-movers",
  storageBucket: "kn-packers-and-movers.firebasestorage.app",
  messagingSenderId: "995866937342",
  appId: "1:995866937342:web:973d54333b2c014f9962af"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize and export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Log success (helps debug in browser console)
console.log("[K&N] Firebase initialized successfully · project:", firebaseConfig.projectId);
