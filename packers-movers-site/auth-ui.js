/* =========================================================
   auth-ui.js — Sign In / Sign Up Modal + User Menu
   Mobile-friendly with comprehensive error handling
   ========================================================= */

import { auth } from "./firebase-config.js";
import {
  signIn, signUp, signInWithGoogle, logOut, watchAuth
} from "./firebase-auth.js";

// ============================================================
// MODAL OPEN/CLOSE (with body scroll lock)
// ============================================================
let savedScrollY = 0;

function openAuthModal(tab = 'signin') {
  const modal = document.getElementById('authModal');
  if (!modal) {
    console.error("[K&N] Auth modal not found in DOM");
    return;
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  // Lock body scroll (preserves position so page doesn't jump)
  savedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.overflow = 'hidden';

  switchTab(tab);

  // Focus first input after animation
  setTimeout(() => {
    const firstInput = modal.querySelector('.auth-form:not([style*="display: none"]) input');
    if (firstInput) firstInput.focus();
  }, 200);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  // Restore body scroll
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.overflow = '';
  window.scrollTo(0, savedScrollY);

  clearMessages();
  document.querySelectorAll('.auth-form').forEach(f => f.reset());
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  const signinForm = document.getElementById('signinForm');
  const signupForm = document.getElementById('signupForm');
  if (signinForm) signinForm.style.display = tab === 'signin' ? 'flex' : 'none';
  if (signupForm) signupForm.style.display = tab === 'signup' ? 'flex' : 'none';
  clearMessages();
}

// ============================================================
// MESSAGES
// ============================================================
function showError(msg) {
  const el = document.getElementById('authError');
  if (!el) {
    alert(msg); // Fallback if element missing
    return;
  }
  el.textContent = msg;
  el.classList.add('show');
  // Scroll error into view
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(msg) {
  const el = document.getElementById('authSuccess');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearMessages() {
  const err = document.getElementById('authError');
  const suc = document.getElementById('authSuccess');
  if (err) { err.classList.remove('show'); err.textContent = ''; }
  if (suc) { suc.classList.remove('show'); suc.textContent = ''; }
}

// ============================================================
// FORM HANDLERS
// ============================================================
async function handleSignIn(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.auth-submit');
  const originalText = submitBtn.textContent;
  const fd = new FormData(form);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="auth-spinner"></span>Signing in...';
  clearMessages();

  try {
    const result = await signIn(fd.get('email').trim(), fd.get('password'));

    if (result.success) {
      showSuccess('✅ Signed in! Welcome back.');
      // Close modal after brief delay
      setTimeout(() => closeAuthModal(), 800);
    } else {
      showError('❌ ' + (result.error || 'Sign in failed. Please try again.'));
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  } catch (err) {
    showError('❌ Unexpected error: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.auth-submit');
  const originalText = submitBtn.textContent;
  const fd = new FormData(form);

  const password = fd.get('password');
  if (password.length < 6) {
    showError('❌ Password must be at least 6 characters.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="auth-spinner"></span>Creating account...';
  clearMessages();

  try {
    const result = await signUp(
      fd.get('email').trim(),
      password,
      fd.get('name').trim(),
      fd.get('phone').trim()
    );

    if (result.success) {
      showSuccess('✅ Account created! You are now signed in.');
      setTimeout(() => closeAuthModal(), 1200);
    } else {
      showError('❌ ' + (result.error || 'Sign up failed. Please try again.'));
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  } catch (err) {
    showError('❌ Unexpected error: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleGoogleSignIn() {
  const btn = document.getElementById('googleSignInBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="auth-spinner auth-spinner-dark"></span>Connecting to Google...';
  clearMessages();

  try {
    const result = await signInWithGoogle();

    if (result.success) {
      if (result.redirecting) {
        // Mobile redirect — page is navigating
        showSuccess('✅ Redirecting to Google...');
      } else {
        showSuccess('✅ Signed in with Google!');
        setTimeout(() => closeAuthModal(), 800);
      }
    } else {
      showError('❌ ' + (result.error || 'Google sign-in failed.'));
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  } catch (err) {
    showError('❌ Unexpected error: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ============================================================
// USER MENU
// ============================================================
function setupUserMenu(user) {
  const signInBtn = document.getElementById('signInBtn');
  const userMenu = document.getElementById('userMenu');
  if (!signInBtn || !userMenu) return;

  if (user) {
    signInBtn.style.display = 'none';
    userMenu.style.display = 'block';

    const name = user.displayName || user.email.split('@')[0];
    const avatar = name.charAt(0).toUpperCase();
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    if (avatarEl) avatarEl.textContent = avatar;
    if (nameEl) nameEl.textContent = name;
  } else {
    signInBtn.style.display = '';
    userMenu.style.display = 'none';
  }
}

// ============================================================
// AUTH STATE OBSERVER
// ============================================================
function initAuthObserver() {
  watchAuth((user) => {
    setupUserMenu(user);
    // If user is signed in AND modal is open, close it
    if (user) {
      const modal = document.getElementById('authModal');
      if (modal && modal.classList.contains('open')) {
        // Already shown success message, close after brief delay
      }
    }
  });
}

// ============================================================
// LOGOUT
// ============================================================
async function handleLogout() {
  await logOut();
  // Close user menu
  const userMenu = document.getElementById('userMenu');
  if (userMenu) userMenu.classList.remove('open');
}

// ============================================================
// CLICK OUTSIDE TO CLOSE
// ============================================================
function setupModalCloseHandlers() {
  const modal = document.getElementById('authModal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.auth-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

  const overlay = modal.querySelector('.auth-modal-overlay');
  if (overlay) overlay.addEventListener('click', closeAuthModal);

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeAuthModal();
    }
  });
}

// ============================================================
// USER MENU TOGGLE
// ============================================================
function setupUserMenuToggle() {
  const userMenu = document.getElementById('userMenu');
  const btn = userMenu?.querySelector('.user-menu-btn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.contains(e.target)) {
      userMenu.classList.remove('open');
    }
  });
}

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn) signInBtn.addEventListener('click', () => openAuthModal('signin'));

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const signinForm = document.getElementById('signinForm');
  if (signinForm) signinForm.addEventListener('submit', handleSignIn);

  const signupForm = document.getElementById('signupForm');
  if (signupForm) signupForm.addEventListener('submit', handleSignUp);

  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) googleBtn.addEventListener('click', handleGoogleSignIn);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  setupModalCloseHandlers();
  setupUserMenuToggle();
  initAuthObserver();

  console.log("[K&N] Auth UI initialized");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.__openAuthModal = openAuthModal;
window.__closeAuthModal = closeAuthModal;
