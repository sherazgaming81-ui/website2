/* =========================================================
   firebase-auth.js — Authentication helpers for K&N website
   ========================================================= */

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Detect mobile — use redirect instead of popup on mobile (popups are blocked on mobile)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// ============================================================
// SIGN UP with email/password
// ============================================================
export async function signUp(email, password, name, phone) {
  try {
    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }
    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (name) {
      try { await updateProfile(cred.user, { displayName: name }); } catch {}
    }

    // Create user document in Firestore
    try {
      await setDoc(doc(db, "users", cred.user.uid), {
        email, name: name || "", phone: phone || "",
        role: "customer",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } catch (firestoreErr) {
      console.warn("[K&N] User profile save failed (continuing):", firestoreErr);
    }

    console.log("[K&N] User signed up:", cred.user.uid);
    return { success: true, user: cred.user };
  } catch (error) {
    console.error("[K&N] Sign up failed:", error);
    return { success: false, error: friendlyAuthError(error.code) || error.message || "Sign up failed." };
  }
}

// ============================================================
// SIGN IN with email/password
// ============================================================
export async function signIn(email, password) {
  try {
    if (!email || !password) {
      return { success: false, error: "Please enter email and password." };
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Update lastLogin timestamp (non-blocking)
    setDoc(doc(db, "users", cred.user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true }).catch(() => {});

    console.log("[K&N] User signed in:", cred.user.uid);
    return { success: true, user: cred.user };
  } catch (error) {
    console.error("[K&N] Sign in failed:", error);
    return { success: false, error: friendlyAuthError(error.code) || error.message || "Sign in failed." };
  }
}

// ============================================================
// SIGN IN with Google
// (Uses popup on desktop, redirect on mobile — popups blocked on mobile)
// ============================================================
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Force account selection every time
    provider.setCustomParameters({ prompt: 'select_account' });

    let result;
    if (isMobile) {
      // Mobile: use redirect (full page flow)
      await signInWithRedirect(auth, provider);
      return { success: true, redirecting: true };
    } else {
      // Desktop: use popup
      result = await signInWithPopup(auth, provider);
    }

    // Create user profile if first time
    try {
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: result.user.email,
          name: result.user.displayName || "",
          phone: result.user.phoneNumber || "",
          role: "customer",
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      } else {
        await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
      }
    } catch (firestoreErr) {
      console.warn("[K&N] Firestore profile save failed:", firestoreErr);
    }

    console.log("[K&N] Google sign in:", result.user.uid);
    return { success: true, user: result.user };
  } catch (error) {
    console.error("[K&N] Google sign in failed:", error);
    return { success: false, error: friendlyAuthError(error.code) || error.message || "Google sign-in failed." };
  }
}

// ============================================================
// SIGN OUT
// ============================================================
export async function logOut() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// PASSWORD RESET
// ============================================================
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent! Check your inbox." };
  } catch (error) {
    return { success: false, error: friendlyAuthError(error.code) || error.message };
  }
}

// ============================================================
// AUTH STATE OBSERVER
// ============================================================
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}

export async function isAdmin(user) {
  if (!user) return false;
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() && userDoc.data().role === "admin";
  } catch (error) {
    return false;
  }
}

// ============================================================
// FRIENDLY ERROR MESSAGES
// ============================================================
function friendlyAuthError(code) {
  const errors = {
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': '⚠️ Sign-in method not enabled. Contact site admin or enable in Firebase Console → Authentication.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/user-not-found': 'No account found with this email. Try signing up.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': '⚠️ Too many attempts. Please wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/popup-blocked': '⚠️ Popup was blocked by browser. Please allow popups for this site.',
    'auth/network-request-failed': '⚠️ Network error. Please check your internet connection.',
    'auth/unauthorized-domain': '⚠️ This domain is not authorized for Google sign-in. Site admin needs to add "packers-movers-site.vercel.app" to Firebase Console → Authentication → Settings → Authorized Domains.',
    'auth/operation-not-supported-in-this-environment': '⚠️ Popup not supported. Try email/password instead.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email. Try signing in with the original method.',
    'auth/network-request-failed': '⚠️ Network error. Please check your connection.'
  };
  return errors[code] || null;
}
