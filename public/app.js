/* EVote Bridge — Final App Logic */

const ADMIN = { user: 'admin', pass: 'admin123' };
const RECEIVER = '25205012@nec.edu.in';

let S = {
  boothId:'', officerName:'',
  stream:null, image:null,
  voterName:'', voterId:'', homeBooth:'',
  rawOCR:'', timerInt:null
};

// ── Clock ──
setInterval(()=>{
  const el=document.getElementById('hdr-clock');
  if(el) el.textContent=new Date().toLocaleTimeString('en-IN',{hour12:false});
},1000);

// ══════════════════════════════
// LOGIN
// ══════════════════════════════
async function doLogin(){
  const u=document.getElementById('un').value.trim();
  const p=document.getElementById('pw').value.trim();
  const err=document.getElementById('login-err');

  if(u!==ADMIN.user||p!==ADMIN.pass){
    err.classList.remove('hidden'); return;
  }
  err.classList.add('hidden');

  // Send OTP via Twilio
  try{
    const btn=document.querySelector('#ls1 .btn-p');
    btn.disabled=true; btn.textContent='Sending OTP...';
    const r=await fetch('/api/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.success){
      document.getElementById('ls1').classList.add('hidden');
      document.getElementById('ls2').classList.remove('hidden');
      startOTPTimer();
      document.getElementById('otp-in').focus();
    } else {
      err.textContent='Failed to send OTP: '+d.error;
      err.classList.remove('hidden');
      btn.disabled=false; btn.textContent='Send OTP →';
    }
  } catch(e){
    err.textContent='Server error. Try again.';
    err.classList.remove('hidden');
    document.querySelector('#ls1 .btn-p').disabled=false;
    document.querySelector('#ls1 .btn-p').textContent='Send OTP →';
  }
}

function startOTPTimer(){
  clearInterval(S.timerInt);
  let sec=30;
  const fill=document.getElementById('tbar-fill');
  const txt=document.getElementById('tbar-txt');
  S.timerInt=setInterval(()=>{
    sec--;
    if(fill) fill.style.width=(sec/30*100)+'%';
    if(txt) txt.textContent=sec+'s';
    if(sec<=0){ clearInterval(S.timerInt); if(txt) txt.textContent='0s'; }
  },1000);
}

async function resendOTP(){
  await fetch('/api/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  startOTPTimer();
  document.getElementById('otp-in').value='';
  document.getElementById('otp-err').classList.add('hidden');
}

async function doVerify(){
  const code=document.getElementById('otp-in').value.trim();
  const err=document.getElementById('otp-err');

  if(code.length!==6){
    err.textContent='Enter the full 6-digit code.';
    err.classList.remove('hidden'); return;
  }

  try{
    const btn=document.querySelector('#ls2 .btn-p');
    btn.disabled=true; btn.textContent='Verifying...';
    const r=await fetch('/api/verify-otp',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code})
    });
    const d=await r.json();

    if(d.valid){
      clearInterval(S.timerInt);
      document.getElementById('screen-login').classList.add('hidden');
      document.getElementById('screen-app').classList.remove('hidden');
      document.getElementById('screen-app').classList.add('active');
    } else {
      err.textContent='Invalid OTP. Check your SMS and try again.';
      err.classList.remove('hidden');
      document.getElementById('otp-in').value='';
      document.getElementById('otp-in').focus();
      btn.disabled=false; btn.textContent='Verify & Login →';
    }
  } catch(e){
    err.textContent='Server error. Try again.';
    err.classList.remove('hidden');
    document.querySelector('#ls2 .btn-p').disabled=false;
    document.querySelector('#ls2 .btn-p').textContent='Verify & Login →';
  }
}

function backToLogin(){
  clearInterval(S.timerInt);
  document.getElementById('ls2').classList.add('hidden');
  document.getElementById('ls1').classList.remove('hidden');
  document.getElementById('otp-err').classList.add('hidden');
  document.getElementById('otp-in').value='';
  const btn=document.querySelector('#ls1 .btn-p');
  btn.disabled=false; btn.textContent='Send OTP →';
}

function doLogout(){
  if(!confirm('Logout and end this session?')) return;
  stopCam();
  clearInterval(S.timerInt);
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('un').value='';
  document.getElementById('pw').value='';
  document.getElementById('otp-in').value='';
  document.getElementById('ls2').classList.add('hidden');
  document.getElementById('ls1').classList.remove('hidden');
  const btn=document.querySelector('#ls1 .btn-p');
  btn.disabled=false; btn.textContent='Send OTP →';
  goP(1);
}

// Enter key support
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter') return;
  if(!document.getElementById('ls1').classList.contains('hidden')) doLogin();
  else if(!document.getElementById('ls2').classList.contains('hidden')) doVerify();
});

// ══════════════════════════════
// STEP NAVIGATION
// ══════════════════════════════
function goP(n){
  [1,2,3,4,5].forEach(i=>{
    const p=document.getElementById('p'+i);
    if(p){p.classList.remove('active');p.classList.add('hidden');}
  });
  [1,2,3,4].forEach(i=>{
    const s=document.getElementById('si'+i);
    if(s){s.classList.remove('active','done');if(i<n)s.classList.add('done');}
  });
  const ap=document.getElementById('p'+n);
  if(ap){ap.classList.remove('hidden');ap.classList.add('active');}
  if(n<=4){const as=document.getElementById('si'+n);if(as)as.classList.add('active');}
  window.scrollTo({top:0,behavior:'smooth'});
}

// ══════════════════════════════
// STEP 1: Booth Setup
// ══════════════════════════════
function startBooth(){
  const bid=document.getElementById('booth-id').value.trim();
  const oname=document.getElementById('officer-name').value.trim();
  if(!bid||!oname){alert('Please fill in both fields.');return;}
  S.boothId=bid; S.officerName=oname;
  document.getElementById('hdr-booth').textContent='Booth: '+bid;
  goP(2);
}

// ══════════════════════════════
// STEP 2: Camera
// ══════════════════════════════
function switchTab(e,tab){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('tab-cam').classList.toggle('hidden',tab!=='cam');
  document.getElementById('tab-upl').classList.toggle('hidden',tab!=='upl');
  if(tab!=='cam') stopCam();
}

async function startCam(){
  try{
    // Stop any existing stream first
    stopCam();

    const constraints={
      video:{
        facingMode:{ideal:'environment'},
        width:{ideal:1280},
        height:{ideal:960}
      },
      audio:false
    };

    const stream=await navigator.mediaDevices.getUserMedia(constraints);
    S.stream=stream;
    const vid=document.getElementById('vid');
    vid.srcObject=stream;

    // Wait for video to be ready then play
    vid.onloadedmetadata=()=>{
      vid.play().catch(err=>console.error('Play error:',err));
    };

    document.getElementById('vover').style.display='none';
    document.getElementById('cap-btn').disabled=false;

  } catch(err){
    console.error('Camera error:',err);
    if(err.name==='NotAllowedError'){
      alert('Camera permission denied.\n\nPlease:\n1. Click the camera icon in your browser address bar\n2. Allow camera access\n3. Refresh the page and try again');
    } else if(err.name==='NotFoundError'){
      alert('No camera found. Please use the Upload tab instead.');
      document.getElementById('tab-upl-btn').click();
    } else {
      alert('Camera error: '+err.message+'\n\nTry the Upload tab instead.');
    }
  }
}

function stopCam(){
  if(S.stream){
    S.stream.getTracks().forEach(t=>t.stop());
    S.stream=null;
    const vid=document.getElementById('vid');
    vid.srcObject=null;
    document.getElementById('cap-btn').disabled=true;
    document.getElementById('vover').style.display='flex';
  }
}

function captureFrame(){
  const vid=document.getElementById('vid');
  const cv=document.getElementById('cv');

  if(!vid.videoWidth||vid.readyState<2){
    alert('Camera not ready yet. Wait a moment and try again.');
    return;
  }

  cv.width=vid.videoWidth;
  cv.height=vid.videoHeight;
  const ctx=cv.getContext('2d');
  ctx.drawImage(vid,0,0,cv.width,cv.height);

  const dataURL=cv.toDataURL('image/jpeg',0.92);
  if(!dataURL||dataURL==='data:,'){
    alert('Capture failed. Please try again.');
    return;
  }

  setPreview(dataURL);
  stopCam();
}

function handleFile(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    if(ev.target.result) setPreview(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function setPreview(dataURL){
  S.image=dataURL;
  document.getElementById('prev-img').src=dataURL;
  document.getElementById('prev-wrap').classList.remove('hidden');
  document.getElementById('tab-cam').classList.add('hidden');
  document.getElementById('tab-upl').classList.add('hidden');
}

function retake(){
  S.image=null;
  document.getElementById('prev-wrap').classList.add('hidden');
  document.getElementById('prev-img').src='';
  document.getElementById('tab-cam').classList.remove('hidden');
  document.getElementById('tab-upl').classList.add('hidden');
  // Reset tab button state
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',i===0));
}

function goScan(){
  if(!S.image){alert('Please capture or upload the Voter ID card first.');return;}
  goP(3);
  runOCR();
}

// ══════════════════════════════
// STEP 3: OCR
// ══════════════════════════════
async function runOCR(){
  const statusEl=document.getElementById('scan-status');
  const form=document.getElementById('review-form');
  const msgEl=document.getElementById('scan-msg');
  const revBtn=document.getElementById('rev-btn');

  statusEl.style.display='flex';
  form.classList.add('hidden');
  revBtn.disabled=true;

  try{
    msgEl.textContent='Loading OCR engine...';
    const {createWorker}=Tesseract;
    const worker=await createWorker('eng',1,{
      logger:m=>{
        if(m.status==='recognizing text'){
          msgEl.textContent='Scanning... '+Math.round(m.progress*100)+'%';
        }
      }
    });

    msgEl.textContent='Reading Voter ID...';
    const {data:{text}}=await worker.recognize(S.image);
    await worker.terminate();

    S.rawOCR=text;
    document.getElementById('raw-txt').textContent=text;

    const parsed=parseID(text);
    document.getElementById('rv-name').value=parsed.name;
    document.getElementById('rv-id').value=parsed.idNumber;
    document.getElementById('rv-booth').value='';

    statusEl.style.display='none';
    form.classList.remove('hidden');
    revBtn.disabled=false;

  } catch(err){
    console.error('OCR error:',err);
    msgEl.textContent='Scan complete. Fill details manually if needed.';
    statusEl.style.display='none';
    document.getElementById('review-form').classList.remove('hidden');
    revBtn.disabled=false;
  }
}

function parseID(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  let name='',idNumber='';

  // Indian EPIC Voter ID pattern: 3 capital letters + 7 digits
  const idMatch=text.match(/[A-Z]{3}[0-9]{7}/);
  if(idMatch) idNumber=idMatch[0];

  // Find name after keywords
  for(let i=0;i<lines.length;i++){
    const low=lines[i].toLowerCase();
    if((low.includes('name')||low.includes('voter')||low.includes('elector'))&&lines[i+1]){
      const candidate=lines[i+1].replace(/[^a-zA-Z\s]/g,'').trim();
      if(candidate.length>2){name=candidate;break;}
    }
  }

  // Fallback: longest ALL CAPS line
  if(!name){
    const caps=lines.filter(l=>/^[A-Z][A-Z\s]{3,}$/.test(l));
    if(caps.length) name=caps.sort((a,b)=>b.length-a.length)[0];
  }

  return{name:name||'',idNumber:idNumber||''};
}

function toggleRaw(){
  document.getElementById('raw-txt').classList.toggle('hidden');
}

function goConfirm(){
  const name=document.getElementById('rv-name').value.trim();
  const idNum=document.getElementById('rv-id').value.trim();
  const homeBooth=document.getElementById('rv-booth').value.trim();
  if(!name||!idNum||!homeBooth){alert('Please fill in all three fields.');return;}
  S.voterName=name; S.voterId=idNum; S.homeBooth=homeBooth;
  buildConfirm();
  goP(4);
}

// ══════════════════════════════
// STEP 4: Confirm & Send
// ══════════════════════════════
function buildConfirm(){
  const ts=new Date().toLocaleString('en-IN',{hour12:true,timeZone:'Asia/Kolkata'});
  document.getElementById('cgrid').innerHTML=`
    <div class="ci"><div class="cl">Voter Name</div><div class="cv">${S.voterName}</div></div>
    <div class="ci"><div class="cl">Voter ID</div><div class="cv">${S.voterId}</div></div>
    <div class="ci"><div class="cl">Home Booth</div><div class="cv">${S.homeBooth}</div></div>
    <div class="ci"><div class="cl">Voted At Booth</div><div class="cv">${S.boothId}</div></div>
    <div class="ci"><div class="cl">Verified By</div><div class="cv">${S.officerName}</div></div>
    <div class="ci"><div class="cl">Timestamp</div><div class="cv">${ts}</div></div>
  `;
  document.getElementById('email-dest').textContent=RECEIVER;
}

async function doSend(){
  const btn=document.getElementById('send-btn');
  const lbl=document.getElementById('send-lbl');
  const err=document.getElementById('send-err');
  btn.disabled=true; lbl.textContent='Sending...'; err.classList.add('hidden');

  try{
    const r=await fetch('/api/notify',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        voter_name:S.voterName,
        voter_id_number:S.voterId,
        home_booth:S.homeBooth,
        voted_at_booth:S.boothId,
        officer_name:S.officerName,
        timestamp:new Date().toISOString()
      })
    });
    const d=await r.json();
    if(d.success){
      showSuccess();
    } else {
      throw new Error(d.error||'Unknown server error');
    }
  } catch(e){
    btn.disabled=false; lbl.textContent='Send & Save';
    err.classList.remove('hidden');
    err.textContent='Error: '+e.message;
  }
}

// ══════════════════════════════
// STEP 5: Success
// ══════════════════════════════
function showSuccess(){
  document.getElementById('sum-box').innerHTML=`
    <span>&#128100; ${S.voterName}</span>
    <span>&#128268; ID: ${S.voterId}</span>
    <span>&#128205; Voted at: ${S.boothId}</span>
    <span>&#127968; Home booth notified: ${S.homeBooth}</span>
    <span>&#128231; Email sent to: ${RECEIVER}</span>
    <span>&#10003; Saved to Supabase</span>
  `;
  [1,2,3,4].forEach(i=>{const s=document.getElementById('si'+i);if(s)s.classList.add('done');});
  goP(5);
}

function nextVoter(){
  S.image=null; S.voterName=''; S.voterId=''; S.homeBooth=''; S.rawOCR='';
  document.getElementById('prev-img').src='';
  document.getElementById('prev-wrap').classList.add('hidden');
  document.getElementById('tab-cam').classList.remove('hidden');
  document.getElementById('tab-upl').classList.add('hidden');
  document.getElementById('rv-name').value='';
  document.getElementById('rv-id').value='';
  document.getElementById('rv-booth').value='';
  document.getElementById('raw-txt').textContent='';
  document.getElementById('raw-txt').classList.add('hidden');
  document.getElementById('send-btn').disabled=false;
  document.getElementById('send-lbl').textContent='Send & Save';
  document.getElementById('cap-btn').disabled=true;
  document.getElementById('vover').style.display='flex';
  document.getElementById('file-in').value='';
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',i===0));
  goP(2);
}
