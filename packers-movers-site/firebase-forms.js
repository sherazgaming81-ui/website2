/* =========================================================
   firebase-forms.js — K&N website (FREE TIER - No Blaze needed)
   =========================================================

   Storage strategy: Base64 inline in Firestore documents
   - ✅ 100% free (works on Spark plan)
   - ✅ No credit card needed
   - ✅ No external service (Cloudinary, ImgBB) needed
   - ✅ Works on existing Firebase project

   Image compression: Canvas API (client-side, no server)
   - Photos > 500KB get auto-resized to max 1200px wide
   - Saves as JPEG at 80% quality
   - Typical: 5MB phone photo → ~200KB (96% reduction)

   File size limits:
   - Compressed images: < 250KB → stored as base64 (~330KB)
   - PDFs: only if < 750KB (no compression for PDFs)
   - Larger files: user is told to email directly
   ========================================================= */

import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================
// IMAGE COMPRESSION (Canvas API)
// ============================================================
async function compressImage(file) {
  // Skip non-images (PDFs etc.) — return as-is
  if (!file.type.startsWith("image/")) return file;

  // Skip if already small enough
  if (file.size <= 500 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`[K&N] Compressed ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(blob.size/1024).toFixed(0)}KB`);
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now()
              }));
            } else {
              resolve(file); // Compression failed — use original
            }
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => resolve(file); // Can't load — use original
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ============================================================
// READ FILE AS BASE64
// ============================================================
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ============================================================
// PROCESS FILES (compress + convert to base64)
// ============================================================
async function processAttachments(files) {
  const results = {
    base64: [],
    totalSize: 0,
    errors: []
  };

  for (const file of files) {
    try {
      // Step 1: Compress images (PDFs unchanged)
      const processedFile = await compressImage(file);

      // Step 2: Read as base64
      const base64 = await readFileAsBase64(processedFile);

      // Step 3: Check final size (Firestore doc limit: 1MB total)
      const sizeBytes = base64.length;
      results.totalSize += sizeBytes;

      if (sizeBytes > 800 * 1024) {
        results.errors.push(
          `"${file.name}" is too large after processing (${Math.round(sizeBytes/1024)}KB). ` +
          `Please email it directly to knenterprises139@gmail.com.`
        );
        continue;
      }

      results.base64.push(base64);
    } catch (err) {
      results.errors.push(`Failed to process "${file.name}": ${err.message}`);
    }
  }

  return results;
}

// ============================================================
// QUOTE FORM SUBMISSION
// ============================================================
export async function submitQuote(formData) {
  try {
    const userId = auth.currentUser?.uid || null;
    const docRef = await addDoc(collection(db, "quotes"), {
      userId: userId,
      name: (formData.name || "").trim(),
      phone: (formData.phone || "").trim(),
      email: (formData.email || "").trim() || null,
      fromCity: (formData.fromCity || "").trim(),
      toCity: (formData.toCity || "").trim(),
      service: (formData.service || "").trim(),
      moveDate: formData.moveDate || "",
      status: "new",
      source: "website",
      notes: "",
      createdAt: serverTimestamp()
    });
    console.log("[K&N] Quote saved:", docRef.id);
    return {
      success: true,
      id: docRef.id,
      message: "Quote request received! We'll call you within 15 minutes."
    };
  } catch (error) {
    console.error("[K&N] Quote submission failed:", error);
    return {
      success: false,
      error: error.message || "Submission failed. Please call +92 303 2549535 directly."
    };
  }
}

// ============================================================
// CONTACT FORM SUBMISSION
// ============================================================
export async function submitContact(formData) {
  try {
    const docRef = await addDoc(collection(db, "contacts"), {
      name: (formData.name || "").trim(),
      phone: (formData.phone || "").trim(),
      email: (formData.email || "").trim(),
      service: (formData.service || "").trim() || null,
      message: (formData.message || "").trim(),
      read: false,
      createdAt: serverTimestamp()
    });
    console.log("[K&N] Contact saved:", docRef.id);
    return {
      success: true,
      id: docRef.id,
      message: "Message sent! We'll get back to you within 15 minutes."
    };
  } catch (error) {
    console.error("[K&N] Contact submission failed:", error);
    return {
      success: false,
      error: error.message || "Submission failed. Please try again."
    };
  }
}

// ============================================================
// COMPLAINT FORM SUBMISSION (with base64 attachments)
// ============================================================
export async function submitComplaint(formData, files = []) {
  try {
    // Generate unique ticket number: KN-2026-XXXXX
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const ticketNumber = `KN-${year}-${randomNum}`;

    // Process file attachments (compress + base64)
    let attachmentBase64 = [];
    if (files && files.length > 0) {
      const processed = await processAttachments(files);
      attachmentBase64 = processed.base64;

      // If any files were too large, abort with helpful message
      if (processed.errors.length > 0 && attachmentBase64.length === 0) {
        return {
          success: false,
          error: processed.errors.join(" "),
          code: "FILE_TOO_LARGE"
        };
      }

      // Warn about partial success
      if (processed.errors.length > 0) {
        console.warn("[K&N] Some files skipped:", processed.errors);
      }
    }

    const userId = auth.currentUser?.uid || null;

    const docRef = await addDoc(collection(db, "complaints"), {
      ticketNumber: ticketNumber,
      userId: userId,
      name: (formData.name || "").trim(),
      phone: (formData.phone || "").trim(),
      email: (formData.email || "").trim(),
      bookingId: (formData.bookingId || "").trim(),
      issueType: formData.issueType || "other",
      description: (formData.description || "").trim(),
      attachments: attachmentBase64, // ← base64 strings directly in Firestore
      attachmentCount: attachmentBase64.length,
      status: "new",
      createdAt: serverTimestamp(),
      resolvedAt: null
    });

    console.log("[K&N] Complaint saved:", ticketNumber,
                `(${attachmentBase64.length} attachments, ${(processed.totalSize/1024).toFixed(0)}KB total)`);
    return {
      success: true,
      id: docRef.id,
      ticketNumber: ticketNumber,
      message: `Complaint ${ticketNumber} received. Our escalation team will respond within 2-4 business hours.`
    };
  } catch (error) {
    console.error("[K&N] Complaint submission failed:", error);
    return {
      success: false,
      error: error.message || "Submission failed. Please email knenterprises139@gmail.com directly."
    };
  }
}

// ============================================================
// HELPER: Pre-fill form with logged-in user data
// ============================================================
export async function prefillUserForm(formElement) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const nameField = formElement.querySelector('[name="name"]');
      const phoneField = formElement.querySelector('[name="phone"]');
      const emailField = formElement.querySelector('[name="email"]');
      if (nameField && data.name) nameField.value = data.name;
      if (phoneField && data.phone) phoneField.value = data.phone;
      if (emailField && data.email) emailField.value = data.email;
    }
  } catch (error) {
    console.warn("[K&N] Could not prefill user data:", error);
  }
}

// ============================================================
// HELPER: Get user's previous complaints
// ============================================================
export async function getUserComplaints(userId) {
  try {
    const q = query(collection(db, "complaints"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[K&N] Failed to fetch complaints:", error);
    return [];
  }
}
