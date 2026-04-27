/* EVote Bridge — Complete Clean Logic */

const ADMIN = { user: 'admin', pass: 'admin123' };
const RECEIVER = '25205012@nec.edu.in';

let state = {
  boothId: '', officerName: '',
  stream: null, image: null,
  voterName: '', voterId: '', homeBooth: '',
  timerInt: null
};

// Clock
setInterval(() => {
  const el = document.getElementById('clockEl');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}, 1000);

// ══════════════════════════════
// PAGE SWITCH
// ══════════════════════════════
function showLogin() {
  document.getElementById('APP').style.display = 'none';
  document.getElementById('LOGIN').style.display = 'flex';
}

function showApp() {
  document.getElementById('LOGIN').style.display = 'none';
  document.getElementById('APP').style.display = 'flex';
  document.getElementById('APP').style.flexDirection = 'column';
  document.getElementById('APP').style.minHeight = '100vh';
}

// ══════════════════════════════
// LOGIN
// ══════════════════════════════
async function sendOTP() {
  const user = document.getElementById('iUser').value.trim();
  const pass = document.getElementById('iPass').value.trim();
  const errEl = document.getElementById('errCred');
  const btn = document.getElementById('btnSend');

  if (user !== ADMIN.user || pass !== ADMIN.pass) {
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending OTP...';

  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('C1').style.display = 'none';
      document.getElementById('C2').style.display = 'block';
      document.getElementById('iOtp').focus();
      startTimer();
    } else {
      errEl.textContent = 'Failed to send OTP: ' + (data.error || 'Unknown error');
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Send OTP →';
    }
  } catch (err) {
    errEl.textContent = 'Server error. Check connection.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send OTP →';
  }
}

function startTimer() {
  clearInterval(state.timerInt);
  let sec = 30;
  const fill = document.getElementById('timerFill');
  const num = document.getElementById('timerNum');
  state.timerInt = setInterval(() => {
    sec--;
    if (fill) fill.style.width = (sec / 30 * 100) + '%';
    if (num) num.textContent = sec + 's';
    if (sec <= 0) clearInterval(state.timerInt);
  }, 1000);
}

async function resendOTP() {
  try {
    await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    document.getElementById('iOtp').value = '';
    document.getElementById('errOtp').style.display = 'none';
    startTimer();
  } catch (e) { }
}

async function verifyOTP() {
  const code = document.getElementById('iOtp').value.trim();
  const errEl = document.getElementById('errOtp');
  const btn = document.getElementById('btnVerify');

  if (code.length !== 6) {
    errEl.textContent = 'Please enter the full 6-digit code.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (data.valid) {
      clearInterval(state.timerInt);
      showApp(); // ← LOGIN COMPLETELY GONE
    } else {
      errEl.textContent = 'Invalid OTP. Check SMS and try again.';
      errEl.style.display = 'block';
      document.getElementById('iOtp').value = '';
      document.getElementById('iOtp').focus();
      btn.disabled = false;
      btn.textContent = 'Verify & Login →';
    }
  } catch (err) {
    errEl.textContent = 'Server error. Try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify & Login →';
  }
}

function backToLogin() {
  clearInterval(state.timerInt);
  document.getElementById('C2').style.display = 'none';
  document.getElementById('C1').style.display = 'block';
  document.getElementById('errOtp').style.display = 'none';
  document.getElementById('iOtp').value = '';
  const btn = document.getElementById('btnSend');
  btn.disabled = false;
  btn.textContent = 'Send OTP →';
}

function logout() {
  if (!confirm('Logout and end this session?')) return;
  stopCam();
  clearInterval(state.timerInt);
  state = { boothId: '', officerName: '', stream: null, image: null, voterName: '', voterId: '', homeBooth: '', timerInt: null };

  // Reset login
  document.getElementById('iUser').value = '';
  document.getElementById('iPass').value = '';
  document.getElementById('iOtp').value = '';
  document.getElementById('C1').style.display = 'block';
  document.getElementById('C2').style.display = 'none';
  document.getElementById('errCred').style.display = 'none';
  document.getElementById('errOtp').style.display = 'none';
  document.getElementById('btnSend').disabled = false;
  document.getElementById('btnSend').textContent = 'Send OTP →';

  goP(1);
  showLogin();
}

// Enter key
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('C1').style.display !== 'none') sendOTP();
  else if (document.getElementById('C2').style.display !== 'none') verifyOTP();
});

// ══════════════════════════════
// PANEL NAVIGATION
// ══════════════════════════════
function goP(n) {
  [1, 2, 3, 4, 5].forEach(i => {
    const p = document.getElementById('P' + i);
    if (p) p.style.display = 'none';
  });
  [1, 2, 3, 4].forEach(i => {
    const s = document.getElementById('ST' + i);
    if (s) {
      s.classList.remove('active', 'done');
      if (i < n) s.classList.add('done');
    }
  });

  const activeP = document.getElementById('P' + n);
  if (activeP) activeP.style.display = 'block';

  if (n <= 4) {
    const activeS = document.getElementById('ST' + n);
    if (activeS) activeS.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════
// STEP 1: Booth Setup
// ══════════════════════════════
function startBooth() {
  const bid = document.getElementById('boothId').value.trim();
  const oname = document.getElementById('officerName').value.trim();
  if (!bid || !oname) { alert('Please fill in both Booth ID and Officer Name.'); return; }
  state.boothId = bid;
  state.officerName = oname;
  document.getElementById('boothPill').textContent = 'Booth: ' + bid;
  goP(2);
}

// ══════════════════════════════
// STEP 2: Camera
// ══════════════════════════════
function switchTab(e, tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('tabCam').style.display = tab === 'cam' ? 'block' : 'none';
  document.getElementById('tabUpl').style.display = tab === 'upl' ? 'block' : 'none';
  if (tab !== 'cam') stopCam();
}

async function startCam() {
  stopCam();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false
    });
    state.stream = stream;
    const vid = document.getElementById('vid');
    vid.srcObject = stream;
    await new Promise(r => vid.onloadedmetadata = r);
    await vid.play();
    document.getElementById('camCover').style.display = 'none';
    document.getElementById('btnCapture').disabled = false;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      alert('Camera permission denied!\n\nClick the camera icon in your browser address bar → Allow → Refresh page.');
    } else {
      alert('Camera error: ' + err.message + '\n\nUse Upload tab instead.');
    }
  }
}

function stopCam() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    const vid = document.getElementById('vid');
    vid.srcObject = null;
    document.getElementById('btnCapture').disabled = true;
    document.getElementById('camCover').style.display = 'flex';
  }
}

function takePhoto() {
  const vid = document.getElementById('vid');
  const canvas = document.getElementById('snapCanvas');
  if (!vid.videoWidth || vid.readyState < 2) {
    alert('Camera not ready yet. Wait a moment.');
    return;
  }
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  canvas.getContext('2d').drawImage(vid, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.92);
  setPreview(url);
  stopCam();
}

function fileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => setPreview(ev.target.result);
  reader.readAsDataURL(file);
}

function setPreview(url) {
  state.image = url;
  document.getElementById('previewImg').src = url;
  document.getElementById('previewBox').style.display = 'block';
  document.getElementById('tabCam').style.display = 'none';
  document.getElementById('tabUpl').style.display = 'none';
}

function retake() {
  state.image = null;
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('previewImg').src = '';
  document.getElementById('tabCam').style.display = 'block';
  document.getElementById('tabUpl').style.display = 'none';
  document.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('active', i === 0));
}

function goScan() {
  if (!state.image) { alert('Please capture or upload the Voter ID first.'); return; }
  goP(3);
  runOCR();
}

// ══════════════════════════════
// STEP 3: OCR
// ══════════════════════════════
async function runOCR() {
  document.getElementById('scanLoader').style.display = 'flex';
  document.getElementById('scanForm').style.display = 'none';
  document.getElementById('btnConfirm').disabled = true;

  const msgEl = document.getElementById('scanMsg');

  try {
    msgEl.textContent = 'Loading OCR engine...';
    const { createWorker } = Tesseract;
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          msgEl.textContent = 'Scanning... ' + Math.round(m.progress * 100) + '%';
        }
      }
    });

    const { data: { text } } = await worker.recognize(state.image);
    await worker.terminate();

    document.getElementById('rawOcr').textContent = text;

    const parsed = parseVoterID(text);
    document.getElementById('fName').value = parsed.name;
    document.getElementById('fId').value = parsed.id;
    document.getElementById('fBooth').value = '';

    document.getElementById('scanLoader').style.display = 'none';
    document.getElementById('scanForm').style.display = 'block';
    document.getElementById('btnConfirm').disabled = false;

  } catch (err) {
    msgEl.textContent = 'Scan done. Fill details manually if needed.';
    document.getElementById('scanLoader').style.display = 'none';
    document.getElementById('scanForm').style.display = 'block';
    document.getElementById('btnConfirm').disabled = false;
  }
}

function parseVoterID(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let name = '', id = '';

  // Indian EPIC ID: 3 capital letters + 7 digits
  const idMatch = text.match(/[A-Z]{3}[0-9]{7}/);
  if (idMatch) id = idMatch[0];

  // Find name after keywords
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if ((low.includes('name') || low.includes('voter') || low.includes('elector')) && lines[i + 1]) {
      const candidate = lines[i + 1].replace(/[^a-zA-Z\s]/g, '').trim();
      if (candidate.length > 2) { name = candidate; break; }
    }
  }

  // Fallback: longest ALL CAPS line
  if (!name) {
    const caps = lines.filter(l => /^[A-Z][A-Z\s]{3,}$/.test(l));
    if (caps.length) name = caps.sort((a, b) => b.length - a.length)[0];
  }

  return { name, id };
}

function toggleRaw() {
  const el = document.getElementById('rawOcr');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function goConfirm() {
  const name = document.getElementById('fName').value.trim();
  const id = document.getElementById('fId').value.trim();
  const booth = document.getElementById('fBooth').value.trim();
  if (!name || !id || !booth) { alert('Please fill in all three fields before confirming.'); return; }
  state.voterName = name;
  state.voterId = id;
  state.homeBooth = booth;
  buildConfirm();
  goP(4);
}

// ══════════════════════════════
// STEP 4: Confirm & Send
// ══════════════════════════════
function buildConfirm() {
  const ts = new Date().toLocaleString('en-IN', { hour12: true, timeZone: 'Asia/Kolkata' });
  document.getElementById('confirmGrid').innerHTML = `
    <div class="ci"><div class="ci-lbl">Voter Name</div><div class="ci-val">${state.voterName}</div></div>
    <div class="ci"><div class="ci-lbl">Voter ID</div><div class="ci-val">${state.voterId}</div></div>
    <div class="ci"><div class="ci-lbl">Home Booth</div><div class="ci-val">${state.homeBooth}</div></div>
    <div class="ci"><div class="ci-lbl">Voted At</div><div class="ci-val">${state.boothId}</div></div>
    <div class="ci"><div class="ci-lbl">Verified By</div><div class="ci-val">${state.officerName}</div></div>
    <div class="ci"><div class="ci-lbl">Timestamp</div><div class="ci-val">${ts}</div></div>
  `;
  document.getElementById('emailDest').textContent = RECEIVER;
}

async function sendData() {
  const btn = document.getElementById('btnSendData');
  const txt = document.getElementById('sendTxt');
  const err = document.getElementById('sendErr');

  btn.disabled = true;
  txt.textContent = '⏳ Sending...';
  err.style.display = 'none';

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voter_name: state.voterName,
        voter_id_number: state.voterId,
        home_booth: state.homeBooth,
        voted_at_booth: state.boothId,
        officer_name: state.officerName,
        voted_at: new Date().toISOString()
      })
    });

    const data = await res.json();

    if (data.success) {
      showSuccess();
    } else {
      throw new Error(data.error || 'Unknown server error');
    }
  } catch (e) {
    btn.disabled = false;
    txt.textContent = '📡 Send & Save';
    err.textContent = '❌ Error: ' + e.message;
    err.style.display = 'block';
  }
}

// ══════════════════════════════
// STEP 5: Success
// ══════════════════════════════
function showSuccess() {
  document.getElementById('sumBox').innerHTML = `
    <span>👤 ${state.voterName}</span>
    <span>🪪 ID: ${state.voterId}</span>
    <span>📍 Voted at: ${state.boothId}</span>
    <span>🏠 Home booth: ${state.homeBooth}</span>
    <span>📧 Email sent to: ${RECEIVER}</span>
    <span>✅ Saved to database</span>
  `;
  [1, 2, 3, 4].forEach(i => {
    const s = document.getElementById('ST' + i);
    if (s) { s.classList.remove('active'); s.classList.add('done'); }
  });
  goP(5);
}

function nextVoter() {
  state.image = null; state.voterName = ''; state.voterId = ''; state.homeBooth = '';
  document.getElementById('previewImg').src = '';
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('tabCam').style.display = 'block';
  document.getElementById('tabUpl').style.display = 'none';
  document.getElementById('fName').value = '';
  document.getElementById('fId').value = '';
  document.getElementById('fBooth').value = '';
  document.getElementById('rawOcr').textContent = '';
  document.getElementById('rawOcr').style.display = 'none';
  document.getElementById('btnSendData').disabled = false;
  document.getElementById('sendTxt').textContent = '📡 Send & Save';
  document.getElementById('btnCapture').disabled = true;
  document.getElementById('camCover').style.display = 'flex';
  document.getElementById('fileIn').value = '';
  document.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('active', i === 0));
  goP(2);
}
