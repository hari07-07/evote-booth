/* ═══════════════════════════════════════════
   EVote Bridge — App Logic
   Module 2 Prototype: Cross-booth Voter Verification
═══════════════════════════════════════════ */

// ── State ──
let state = {
  boothId: '',
  officerName: '',
  botToken: '',
  chatId: '',
  voterHomeBooth: '',
  voterIdNumber: '',
  voterName: '',
  capturedImageDataURL: null,
  stream: null,
};

// ── Clock ──
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-IN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// Footer date
document.getElementById('date-footer').textContent = new Date().toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
});

// ── Step Navigation ──
function showSection(num) {
  [1, 2, 3, 4].forEach(i => {
    document.getElementById(`section-${i}`).classList.add('hidden');
    const dot = document.getElementById(`step-dot-${i}`);
    dot.classList.remove('active', 'done');
    if (i < num) dot.classList.add('done');
  });
  document.getElementById(`section-${num}`).classList.remove('hidden');
  document.getElementById(`step-dot-${num}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToStep1() {
  stopCamera();
  showSection(1);
}

function goToStep2() {
  // Validate Step 1
  const boothId = document.getElementById('booth-id').value.trim();
  const officerName = document.getElementById('officer-name').value.trim();
  const botToken = document.getElementById('bot-token').value.trim();
  const chatId = document.getElementById('chat-id').value.trim();

  if (!boothId || !officerName || !botToken || !chatId) {
    alert('Please fill in all booth configuration fields before proceeding.');
    return;
  }

  state.boothId = boothId;
  state.officerName = officerName;
  state.botToken = botToken;
  state.chatId = chatId;

  showSection(2);
}

function goToStep3() {
  const voterHomeBooth = document.getElementById('voter-home-booth').value.trim();
  const voterIdNumber = document.getElementById('voter-id-number').value.trim();
  const voterName = document.getElementById('voter-name').value.trim();

  if (!voterHomeBooth || !voterIdNumber || !voterName) {
    alert('Please fill in all voter details.');
    return;
  }

  if (!state.capturedImageDataURL) {
    alert('Please capture or upload the voter\'s ID card image.');
    return;
  }

  state.voterHomeBooth = voterHomeBooth;
  state.voterIdNumber = voterIdNumber;
  state.voterName = voterName;

  buildReview();
  showSection(3);
}

// ── Camera ──
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (tab === 'camera') {
    document.getElementById('camera-panel').classList.remove('hidden');
    document.getElementById('upload-panel').classList.add('hidden');
  } else {
    document.getElementById('camera-panel').classList.add('hidden');
    document.getElementById('upload-panel').classList.remove('hidden');
    stopCamera();
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    state.stream = stream;
    const video = document.getElementById('video');
    video.srcObject = stream;
    document.getElementById('video-overlay').style.display = 'none';
    document.getElementById('capture-btn').disabled = false;
  } catch (err) {
    alert('Camera access denied or not available. Please use the Upload tab instead.\n\nError: ' + err.message);
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    const video = document.getElementById('video');
    video.srcObject = null;
    document.getElementById('capture-btn').disabled = true;
    document.getElementById('video-overlay').style.display = 'flex';
  }
}

function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataURL = canvas.toDataURL('image/jpeg', 0.85);
  setPreviewImage(dataURL);
  stopCamera();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => setPreviewImage(e.target.result);
  reader.readAsDataURL(file);
}

function setPreviewImage(dataURL) {
  state.capturedImageDataURL = dataURL;
  document.getElementById('preview-img').src = dataURL;
  document.getElementById('preview-area').classList.remove('hidden');
  document.getElementById('camera-panel').classList.add('hidden');
  document.getElementById('upload-panel').classList.add('hidden');
}

function retakePhoto() {
  state.capturedImageDataURL = null;
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('preview-img').src = '';
  document.getElementById('camera-panel').classList.remove('hidden');
  document.getElementById('upload-panel').classList.add('hidden');
  // Reset tab buttons
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
}

// ── Review ──
function buildReview() {
  const timestamp = new Date().toLocaleString('en-IN', { hour12: false });

  const grid = document.getElementById('review-grid');
  grid.innerHTML = `
    <div class="review-item">
      <div class="r-label">Current Booth (Voting Here)</div>
      <div class="r-value">${state.boothId}</div>
    </div>
    <div class="review-item">
      <div class="r-label">Home Booth (Registered At)</div>
      <div class="r-value">${state.voterHomeBooth}</div>
    </div>
    <div class="review-item">
      <div class="r-label">Voter Name</div>
      <div class="r-value">${state.voterName}</div>
    </div>
    <div class="review-item">
      <div class="r-label">Voter ID Number</div>
      <div class="r-value">${state.voterIdNumber}</div>
    </div>
    <div class="review-item">
      <div class="r-label">Verified By</div>
      <div class="r-value">${state.officerName}</div>
    </div>
    <div class="review-item">
      <div class="r-label">Timestamp</div>
      <div class="r-value">${timestamp}</div>
    </div>
    <div class="review-item review-img-item">
      <div class="r-label">Captured ID Image</div>
      <img src="${state.capturedImageDataURL}" alt="Voter ID" />
    </div>
  `;

  const msgText = buildTelegramMessage();
  document.getElementById('message-preview').innerHTML = `
    <h4>📨 Telegram Message Preview (sent to Home Booth)</h4>
    <pre>${msgText}</pre>
  `;
}

function buildTelegramMessage() {
  const timestamp = new Date().toLocaleString('en-IN', { hour12: false });
  return `🗳️ EVOTE BRIDGE — CROSS-BOOTH VOTE NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ACTION REQUIRED: Mark voter as VOTED in your records.

👤 Voter Name     : ${state.voterName}
🪪 Voter ID       : ${state.voterIdNumber}
🏠 Home Booth     : ${state.voterHomeBooth}
📍 Voted At Booth : ${state.boothId}
🕐 Timestamp      : ${timestamp}
👮 Verified By    : ${state.officerName}

📸 Voter ID card photo attached below.
━━━━━━━━━━━━━━━━━━━━━━━━
This person has already cast their vote. Please ensure no duplicate vote is allowed at home booth.

— EVote Bridge Automated Alert`;
}

// ── Send to Telegram ──
async function sendNotification() {
  const sendBtn = document.getElementById('send-btn');
  const sendLabel = document.getElementById('send-label');
  const errorEl = document.getElementById('send-error');

  sendBtn.disabled = true;
  sendLabel.textContent = '⏳ Sending...';
  errorEl.classList.add('hidden');

  const caption = buildTelegramMessage();
  const token = state.botToken;
  const chatId = state.chatId;

  try {
    // Send image with caption via Telegram sendPhoto API
    const imageBlob = await dataURLtoBlob(state.capturedImageDataURL);

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', imageBlob, `voter_${state.voterIdNumber}.jpg`);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.ok) {
      showSuccess();
    } else {
      throw new Error(result.description || 'Telegram API error');
    }

  } catch (err) {
    sendBtn.disabled = false;
    sendLabel.textContent = '📡 Send Notification';
    errorEl.classList.remove('hidden');
    errorEl.textContent = `❌ Error: ${err.message}. Check your Bot Token and Chat ID.`;
  }
}

async function dataURLtoBlob(dataURL) {
  const res = await fetch(dataURL);
  return await res.blob();
}

// ── Success ──
function showSuccess() {
  const timestamp = new Date().toLocaleString('en-IN', { hour12: false });

  document.getElementById('sent-summary').innerHTML = `
    <span>👤 <strong>${state.voterName}</strong></span>
    <span>🪪 ID: ${state.voterIdNumber}</span>
    <span>📍 Voted at: ${state.boothId}</span>
    <span>🏠 Home Booth notified: ${state.voterHomeBooth}</span>
    <span>🕐 ${timestamp}</span>
  `;

  showSection(4);
}

// ── Next Voter ──
function nextVoter() {
  // Clear voter-specific state only
  state.voterHomeBooth = '';
  state.voterIdNumber = '';
  state.voterName = '';
  state.capturedImageDataURL = null;

  // Clear voter form fields
  document.getElementById('voter-home-booth').value = '';
  document.getElementById('voter-id-number').value = '';
  document.getElementById('voter-name').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('camera-panel').classList.remove('hidden');
  document.getElementById('capture-btn').disabled = true;
  document.getElementById('video-overlay').style.display = 'flex';

  // Reset send button
  document.getElementById('send-btn').disabled = false;
  document.getElementById('send-label').textContent = '📡 Send Notification';

  showSection(2);
}