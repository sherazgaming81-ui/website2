/* =========================================================
   K&N Complaint Page — Firebase-Integrated Handler (Base64)
   =========================================================
   Now uses base64 inline storage (no Firebase Storage needed!)
   Works on free Spark plan — no credit card required.
   ========================================================= */

import { submitComplaint } from './firebase-forms.js';

// ============== File handling ==============
const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB upload limit (will be compressed)
let selectedFiles = [];

const fileInput = document.getElementById('fileInput');
const fileDrop = document.getElementById('fileDrop');
const fileList = document.getElementById('fileList');

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function renderFiles() {
  if (!fileList) return;
  fileList.innerHTML = '';
  selectedFiles.forEach((f, idx) => {
    const chip = document.createElement('span');
    chip.className = 'file-chip';
    chip.innerHTML = `📎 ${f.name} <span style="opacity:.7">(${formatSize(f.size)})</span> <button type="button" data-idx="${idx}" aria-label="Remove">×</button>`;
    fileList.appendChild(chip);
  });
  fileList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = parseInt(btn.dataset.idx, 10);
      selectedFiles.splice(i, 1);
      renderFiles();
    });
  });
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const incoming = Array.from(e.target.files);
    for (const f of incoming) {
      if (selectedFiles.length >= MAX_FILES) {
        alert(`Maximum ${MAX_FILES} files allowed.`);
        break;
      }
      if (f.size > MAX_SIZE) {
        alert(`"${f.name}" exceeds the 10MB upload limit and was skipped.`);
        continue;
      }
      const ext = f.name.split('.').pop().toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
        alert(`"${f.name}" is not a supported format (JPG, PNG, PDF only).`);
        continue;
      }
      if (!selectedFiles.some(x => x.name === f.name && x.size === f.size)) {
        selectedFiles.push(f);
      }
    }
    renderFiles();
  });
}

// Drag-and-drop
if (fileDrop) {
  ['dragenter', 'dragover'].forEach(evt => {
    fileDrop.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      fileDrop.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    fileDrop.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      fileDrop.classList.remove('drag');
    });
  });
  fileDrop.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length && fileInput) {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
}

// ============== Form validation ==============
function setError(fieldName, message) {
  const input = document.querySelector(`[name="${fieldName}"]`);
  const msg = document.querySelector(`[data-for="${fieldName}"]`);
  if (input) input.classList.add('invalid');
  if (msg) { msg.textContent = message; msg.classList.add('show'); }
}

function clearError(fieldName) {
  const input = document.querySelector(`[name="${fieldName}"]`);
  const msg = document.querySelector(`[data-for="${fieldName}"]`);
  if (input) input.classList.remove('invalid');
  if (msg) { msg.textContent = ''; msg.classList.remove('show'); }
}

function clearAllErrors() {
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; el.classList.remove('show'); });
}

function validate(data) {
  let valid = true;

  if (!data.name || data.name.trim().length < 2) {
    setError('name', 'Please enter your full name.');
    valid = false;
  } else clearError('name');

  const phoneClean = (data.phone || '').replace(/[^0-9]/g, '');
  if (!phoneClean || phoneClean.length < 10) {
    setError('phone', 'Please enter a valid Pakistani phone number.');
    valid = false;
  } else clearError('phone');

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRe.test(data.email)) {
    setError('email', 'Please enter a valid email address.');
    valid = false;
  } else clearError('email');

  if (!data.bookingId || data.bookingId.trim().length < 3) {
    setError('booking_id', 'Booking / Consignment number is required for tracking.');
    valid = false;
  } else clearError('booking_id');

  if (!data.issue_type) {
    setError('issue_type', 'Please select an issue type.');
    valid = false;
  } else clearError('issue_type');

  if (!data.description || data.description.trim().length < 10) {
    setError('description', 'Please describe the issue in at least 10 characters.');
    valid = false;
  } else clearError('description');

  if (!data.consent) {
    const cb = document.querySelector('[name="consent"]');
    if (cb) cb.classList.add('invalid');
    valid = false;
  } else {
    const cb = document.querySelector('[name="consent"]');
    if (cb) cb.classList.remove('invalid');
  }

  return valid;
}

// Clear errors on input
document.querySelectorAll('input, select, textarea').forEach(el => {
  el.addEventListener('input', () => clearError(el.name));
  el.addEventListener('change', () => clearError(el.name));
});

// ============== Submit to Firebase ==============
const form = document.getElementById('complaintForm');
const submitBtn = document.getElementById('submitBtn');
const successEl = document.getElementById('complaintSuccess');
const complaintIdEl = document.getElementById('complaintId');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const fd = new FormData(form);
    const data = {
      name: fd.get('name') || '',
      phone: fd.get('phone') || '',
      email: fd.get('email') || '',
      bookingId: fd.get('booking_id') || '',
      issueType: fd.get('issue_type') || '',
      description: fd.get('description') || '',
      consent: fd.get('consent') === 'on'
    };

    if (!validate(data)) {
      const firstError = form.querySelector('.invalid');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Disable button & show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.querySelector('.btn-text').textContent;
    submitBtn.querySelector('.btn-text').textContent = 'Submitting...';

    try {
      // Submit to Firebase (compresses + converts to base64)
      const result = await submitComplaint(data, selectedFiles);

      if (result.success) {
        // Hide form, show success card with real ticket number
        form.hidden = true;
        successEl.hidden = false;
        complaintIdEl.textContent = '#' + result.ticketNumber;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // If file too large, show specific message
        if (result.code === 'FILE_TOO_LARGE') {
          alert(`⚠️ File too large\n\n${result.error}\n\nPlease email the file directly to:\n📧 knenterprises139@gmail.com`);
        } else {
          alert('❌ Submission failed: ' + (result.error || 'Unknown error. Please try again or email knenterprises139@gmail.com directly.'));
        }
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = originalText;
      }
    } catch (error) {
      console.error('[K&N] Complaint submission error:', error);
      alert('❌ Submission failed: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = originalText;
    }
  });
}
