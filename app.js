/* EVote Bridge V2 — App Logic with Real TOTP */

const CREDENTIALS = { username: 'admin', password: 'admin123' };
const RECEIVER_EMAIL = '25205012@nec.edu.in';

let state = {
  officerName: '',
  boothId: '',
  capturedImage: null,
  stream: null,
  voterName: '',
  voterIdNumber: '',
  homeBooth: '',
  rawOCR: '',
  timerInterval: null,
};

// ── Clock ──
setInterval(() => {
  const el = document.getElementById('app-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}, 1000);

// ══════════════════════════════
// LOGIN — Step 1
// ══════════════════════════════
function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errEl = document.getElementById('login-error');

  if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
    errEl.classList.add('hidden');
    document.getElementById('login-step-1').classList.add('hidden');
    document.getElementById('login-step-2a').classList.remove('hidden');
    loadQRCode();
  } else {
    errEl.classList.remove('hidden');
  }
}

// ══════════════════════════════
// QR CODE — Step 2A
// ══════════════════════════════
async function loadQRCode() {
  try {
    const res = await fetch('/api/setup-totp');
    const data = await res.json();

    if (data.success) {
      const img = document.getElementById('qr-img');
      img.src = data.qrCode;
      img.classList.remove('hidden');
      document.getElementById('qr-loading').style.display = 'none';
      document.getElementById('totp-secret-display').textContent = data.secret;
    }
  } catch (err) {
    document.getElementById('qr-loading').innerHTML = '<p style="color:#ff4757">Failed to load QR. Check server.</p>';
  }
}

function toggleSecret() {
  document.getElementById('secret-wrap').classList.toggle('hidden');
}

function goToVerify() {
  document.getElementById('login-step-2a').classList.add('hidden');
  document.getElementById('login-step-2').classList.remove('hidden');
  document.getElementById('totp-input').focus();
  startTOTPTimer();
}

function showQRSetup() {
  clearInterval(state.timerInterval);
  document.getElementById('login-step-2').classList.add('hidden');
  document.getElementById('login-step-2a').classList.remove('hidden');
}

function backToLogin() {
  clearInterval(state.timerInterval);
  document.getElementById('login-step-2a').classList.add('hidden');
  document.getElementById('login-step-2').classList.add('hidden');
  document.getElementById('login-step-1').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('totp-error').classList.add('hidden');
}

// ── TOTP Timer countdown bar ──
function startTOTPTimer() {
  clearInterval(state.timerInterval);

  function update() {
    const seconds = Math.floor(Date.now() / 1000);
    const remaining = 30 - (seconds % 30);
    const progress = (remaining / 30) * 100;
    const bar = document.getElementById('timer-bar');
    const txt = document.getElementById('timer-text');
    if (bar) bar.style.setProperty('--progress', progress + '%');
    if (txt) txt.textContent = remaining + 's';
  }

  update();
  state.timerInterval = setInterval(update, 1000);
}

// ══════════════════════════════
// TOTP VERIFY — Step 2B
// ══════════════════════════════
async function handleTOTP() {
  const code = document.getElementById('totp-input').value.trim();
  const errEl = document.getElementById('totp-error');

  if (code.length !== 6) {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Please enter the full 6-digit code.';
    return;
  }

  try {
    const res = await fetch('/api/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: code })
    });

    const data = await res.json();

    if (data.valid) {
      clearInterval(state.timerInterval);
      errEl.classList.add('hidden');
      document.getElementById('screen-login').classList.add('hidden');
      document.getElementById('screen-app').classList.remove('hidden');
    } else {
      errEl.classList.remove('hidden');
      errEl.textContent = 'Invalid code. Check your Authenticator app and try again.';
      document.getElementById('totp-input').value = '';
      document.getElementById('totp-input').focus();
    }
  } catch (err) {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Server error. Try again.';
  }
}

function logout() {
  if (!confirm('Logout and end verification session?')) return;
  stopCam();
  clearInterval(state.timerInterval);
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('totp-input').value = '';
  document.getElementById('login-step-2').classList.add('hidden');
  document.getElementById('login-step-2a').classList.add('hidden');
  document.getElementById('login-step-1').classList.remove('hidden');
  goStep(1);
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!document.getElementById('login-step-1').classList.contains('hidden')) handleLogin();
  else if (!document.getElementById('login-step-2').classList.contains('hidden')) handleTOTP();
});

// ══════════════════════════════
// STEP NAVIGATION
// ══════════════════════════════
function goStep(num) {
  [1,2,3,4,5].forEach(i => {
    const p = document.getElementById('panel-' + i);
    if (p) { p.classList.remove('active'); p.classList.add('hidden'); }
  });
  [1,2,3,4].forEach(i => {
    const s = document.getElementById('s' + i);
    if (s) { s.classList.remove('active','done'); if (i < num) s.classList.add('done'); }
  });
  const ap = document.getElementById('panel-' + num);
  if (ap) { ap.classList.remove('hidden'); ap.classList.add('active'); }
  if (num <= 4) { const as = document.getElementById('s' + num); if (as) as.classList.add('active'); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Step 1: Booth Setup ──
function startSession() {
  const boothId = document.getElementById('booth-id').value.trim();
  const officerName = document.getElementById('officer-name').value.trim();
  if (!boothId || !officerName) { alert('Please fill in both fields.'); return; }
  state.boothId = boothId;
  state.officerName = officerName;
  document.getElementById('header-booth').textContent = 'Booth: ' + boothId;
  goStep(2);
}

// ── Step 2: Camera/Upload ──
function switchTab(e, tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('tab-camera').classList.toggle('hidden', tab !== 'camera');
  document.getElementById('tab-upload').classList.toggle('hidden', tab !== 'upload');
  if (tab !== 'camera') stopCam();
}

async function startCam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
    state.stream = stream;
    const video = document.getElementById('video');
    video.srcObject = stream;
    document.getElementById('video-placeholder').style.display = 'none';
    document.getElementById('cap-btn').disabled = false;
  } catch (err) {
    alert('Camera access denied. Use Upload tab.\n' + err.message);
  }
}

function stopCam() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    document.getElementById('video').srcObject = null;
    document.getElementById('cap-btn').disabled = true;
    document.getElementById('video-placeholder').style.display = 'flex';
  }
}

function captureImg() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  setPreview(canvas.toDataURL('image/jpeg', 0.9));
  stopCam();
}

function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => setPreview(ev.target.result);
  reader.readAsDataURL(file);
}

function setPreview(dataURL) {
  state.capturedImage = dataURL;
  document.getElementById('preview-img').src = dataURL;
  document.getElementById('preview-wrap').classList.remove('hidden');
  document.getElementById('tab-camera').classList.add('hidden');
  document.getElementById('tab-upload').classList.add('hidden');
}

function retake() {
  state.capturedImage = null;
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('tab-camera').classList.remove('hidden');
}

function goScan() {
  if (!state.capturedImage) { alert('Please capture or upload the Voter ID first.'); return; }
  goStep(3);
  runOCR();
}

// ── Step 3: OCR ──
async function runOCR() {
  const statusEl = document.getElementById('scan-status');
  const reviewForm = document.getElementById('review-form');
  const msgEl = document.getElementById('scan-msg');
  const reviewBtn = document.getElementById('review-btn');

  statusEl.style.display = 'flex';
  reviewForm.classList.add('hidden');
  reviewBtn.disabled = true;

  try {
    msgEl.textContent = 'Initializing OCR engine...';
    const { createWorker } = Tesseract;
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          msgEl.textContent = 'Scanning... ' + Math.round(m.progress * 100) + '%';
        }
      }
    });
    const { data: { text } } = await worker.recognize(state.capturedImage);
    await worker.terminate();

    state.rawOCR = text;
    document.getElementById('raw-ocr').textContent = text;
    const parsed = parseVoterID(text);
    document.getElementById('r-name').value = parsed.name;
    document.getElementById('r-id').value = parsed.idNumber;
    document.getElementById('r-home-booth').value = '';
    statusEl.style.display = 'none';
    reviewForm.classList.remove('hidden');
    reviewBtn.disabled = false;
  } catch (err) {
    msgEl.textContent = 'Scan complete. Please fill details manually.';
    statusEl.style.display = 'none';
    reviewForm.classList.remove('hidden');
    reviewBtn.disabled = false;
  }
}

function parseVoterID(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let name = '', idNumber = '';
  const idMatch = text.match(/[A-Z]{3}[0-9]{7}/);
  if (idMatch) idNumber = idMatch[0];
  const nameKeywords = ['name', 'voter', 'elector'];
  for (let i = 0; i < lines.length; i++) {
    if (nameKeywords.some(k => lines[i].toLowerCase().includes(k)) && lines[i+1]) {
      name = lines[i+1].replace(/[^a-zA-Z\s]/g, '').trim();
      break;
    }
  }
  if (!name) {
    const capsLines = lines.filter(l => /^[A-Z\s]{4,}$/.test(l));
    if (capsLines.length) name = capsLines[0];
  }
  return { name, idNumber };
}

function toggleRaw() {
  document.getElementById('raw-ocr').classList.toggle('hidden');
}

function goReview() {
  const name = document.getElementById('r-name').value.trim();
  const idNum = document.getElementById('r-id').value.trim();
  const homeBooth = document.getElementById('r-home-booth').value.trim();
  if (!name || !idNum || !homeBooth) { alert('Please fill in all fields.'); return; }
  state.voterName = name;
  state.voterIdNumber = idNum;
  state.homeBooth = homeBooth;
  buildConfirmScreen();
  goStep(4);
}

// ── Step 4: Confirm & Send ──
function buildConfirmScreen() {
  const timestamp = new Date().toLocaleString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });
  document.getElementById('confirm-grid').innerHTML = `
    <div class="confirm-item"><div class="confirm-label">Voter Name</div><div class="confirm-value">${state.voterName}</div></div>
    <div class="confirm-item"><div class="confirm-label">Voter ID</div><div class="confirm-value">${state.voterIdNumber}</div></div>
    <div class="confirm-item"><div class="confirm-label">Home Booth</div><div class="confirm-value">${state.homeBooth}</div></div>
    <div class="confirm-item"><div class="confirm-label">Voting At</div><div class="confirm-value">${state.boothId}</div></div>
    <div class="confirm-item"><div class="confirm-label">Verified By</div><div class="confirm-value">${state.officerName}</div></div>
    <div class="confirm-item"><div class="confirm-label">Timestamp</div><div class="confirm-value">${timestamp}</div></div>
  `;
  document.getElementById('email-to').textContent = RECEIVER_EMAIL;
}

async function sendAndSave() {
  const btn = document.getElementById('send-btn');
  const label = document.getElementById('send-label');
  const errEl = document.getElementById('send-error');
  btn.disabled = true;
  label.textContent = 'Sending...';
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voter_name: state.voterName,
        voter_id_number: state.voterIdNumber,
        home_booth: state.homeBooth,
        voted_at_booth: state.boothId,
        officer_name: state.officerName,
        timestamp: new Date().toISOString()
      })
    });
    const result = await res.json();
    if (result.success) {
      showSuccess();
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (err) {
    btn.disabled = false;
    label.textContent = 'Send & Save';
    errEl.classList.remove('hidden');
    errEl.textContent = 'Error: ' + err.message;
  }
}

// ── Step 5: Success ──
function showSuccess() {
  document.getElementById('success-summary').innerHTML = `
    <span>Voter: ${state.voterName}</span>
    <span>ID: ${state.voterIdNumber}</span>
    <span>Voted at: ${state.boothId}</span>
    <span>Home booth notified: ${state.homeBooth}</span>
    <span>Email sent to: ${RECEIVER_EMAIL}</span>
    <span>Saved to database</span>
  `;
  [1,2,3,4].forEach(i => { const s = document.getElementById('s'+i); if(s) s.classList.add('done'); });
  goStep(5);
}

function nextVoter() {
  state.capturedImage = null;
  state.voterName = state.voterIdNumber = state.homeBooth = state.rawOCR = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('tab-camera').classList.remove('hidden');
  document.getElementById('r-name').value = '';
  document.getElementById('r-id').value = '';
  document.getElementById('r-home-booth').value = '';
  document.getElementById('raw-ocr').textContent = '';
  document.getElementById('raw-ocr').classList.add('hidden');
  document.getElementById('send-btn').disabled = false;
  document.getElementById('send-label').textContent = 'Send & Save';
  document.getElementById('cap-btn').disabled = true;
  document.getElementById('video-placeholder').style.display = 'flex';
  document.getElementById('file-in').value = '';
  goStep(2);
}
