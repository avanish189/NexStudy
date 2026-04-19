
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuTaF8bgt8Du7bcBOV48bLdTGYbosEnoE",
  authDomain: "nexai-ab22a.firebaseapp.com",
  projectId: "nexai-ab22a",
  storageBucket: "nexai-ab22a.appspot.com",
  messagingSenderId: "383101046063",
  appId: "1:383101046063:web:e3edc98ed31485dee065da"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.auth = auth;
window.db = db;

window.API = "https://api.anthropic.com/v1/messages";

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
window.FREE_LIMIT = 5;
window.state = {
  email: "",
  user: null,
  selClass: "10",
  selStream: "",
  selSubject: "Math",
  uploadedImg: null,
  ocrText: "",
  qHistory: [],
  loadStageTimer: null,
  selectedPlan: { id:'monthly', price:'₹99/mo' }
};

let isSignUpMode = false;

/* ──────────────────────────────────────────
   STORAGE HELPERS (Firebase)
   ────────────────────────────────────────── */
async function loadUserData(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error loading user data:", error);
  }
  return null;
}

async function saveUserData(uid, data) {
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Error saving user data:", error);
  }
}

async function getUsage() {
  if (!state.user) return 0;
  const data = await loadUserData(state.user.uid);
  return data?.usage || 0;
};

async function setUsage(n) {
  if (!state.user) return;
  await saveUserData(state.user.uid, { usage: n });
};

async function getHistory() {
  if (!state.user) return [];
  const data = await loadUserData(state.user.uid);
  return data?.history || [];
};

async function saveHistory(arr) {
  if (!state.user) return;
  await saveUserData(state.user.uid, { history: arr });
};

async function logout() {
  await signOut(auth);
  window.location.reload();
};

/* ──────────────────────────────────────────
   BOOT — check existing session
   ────────────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.user = user;
    state.email = user.email;
    const data = await loadUserData(user.uid);
    if (data && data.class) {
      state.selClass = data.class;
      state.selStream = data.stream || "";
      showPage('homePage');
      if (initHome) initHome();
    } else {
      showPage('setupPage');
    }
  } else {
    state.user = null;
    showPage('loginPage');
  }
});

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};

/* ──────────────────────────────────────────
   LOGIN / SIGNUP
   ────────────────────────────────────────── */
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('authTitle').innerText = isSignUpMode ? "Create Account ✨" : "Welcome Back 👋";
  document.getElementById('authSub').innerText = isSignUpMode ? "Sign up with email to continue" : "Sign in with email to continue";
  document.getElementById('authBtn').innerText = isSignUpMode ? "Create Account →" : "Sign In →";
  document.getElementById('authToggle').innerText = isSignUpMode ? "Already have an account? Sign In" : "Create an account instead";
};

async function handleAuth() {
  const email = document.getElementById('emailInput').value.trim();
  const pass = document.getElementById('passwordInput').value.trim();
  const err = document.getElementById('authErr');
  err.style.display = 'none';

  if (!email || !pass) {
    err.innerText = "Please enter both email and password.";
    err.style.display = 'block';
    return;
  }

  const btn = document.getElementById('authBtn');
  btn.disabled = true;
  btn.innerText = "Loading...";

  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, pass);
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (error) {
    err.innerText = error.message.replace("Firebase: ", "");
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerText = isSignUpMode ? "Create Account →" : "Sign In →";
  }
};

/* ──────────────────────────────────────────
   SETUP PAGE
   ────────────────────────────────────────── */
function selectClass(el) {
  document.querySelectorAll('.setup-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.selClass = el.dataset.class;
  const needs = ['11','12'].includes(state.selClass);
  document.getElementById('streamSection').style.display = needs ? 'block' : 'none';
  if (!needs) state.selStream = '';
};

function selectStream(el) {
  document.querySelectorAll('.stream-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  state.selStream = el.dataset.stream;
};

async function finishSetup() {
  if (!state.selClass) { showToast('⚠️ Please select your class'); return; }
  if (['11','12'].includes(state.selClass) && !state.selStream) { showToast('⚠️ Please select your stream'); return; }
  
  const btn = document.getElementById('continueBtn');
  btn.disabled = true;
  btn.innerText = "Saving...";

  const u = { class: state.selClass, stream: state.selStream, premium: false, joinedAt: Date.now(), usage: 0, history: [] };
  await window.saveUserData(state.user.uid, u);
  
  btn.disabled = false;
  btn.innerText = "Continue to StudyAI →";

  showPage('homePage'); 
  initHome();
  showToast('🎉 Welcome to StudyAI!');
};

/* ──────────────────────────────────────────
   HOME INIT
   ────────────────────────────────────────── */
async function initHome() {
  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  // Avatar
  document.getElementById('navAvatar').textContent = state.email.slice(0,2).toUpperCase();
  document.getElementById('userInfo').innerHTML = `📧 ${state.email}<br><span style="color:var(--teal)">${isPremium?'💎 Premium':'Free Plan'}</span>`;

  // Class chips
  const wrap = document.getElementById('classChips');
  wrap.innerHTML = '';
  ['6','7','8','9','10','11','12'].forEach(c => {
    const d = document.createElement('div');
    d.className = 'class-chip' + (c === state.selClass ? ' active' : '');
    d.textContent = 'Class ' + c;
    d.onclick = () => {
      document.querySelectorAll('.class-chip').forEach(x=>x.classList.remove('active'));
      d.classList.add('active'); state.selClass = c;
    };
    wrap.appendChild(d);
  });

  // Subject chips
  document.getElementById('subjectChips').addEventListener('click', e => {
    const s = e.target.closest('.subj-chip'); if(!s) return;
    document.querySelectorAll('.subj-chip').forEach(x=>x.classList.remove('active'));
    s.classList.add('active'); state.selSubject = s.dataset.sub;
  });

  updateUsageUI();
  loadHistory();

  // Examples
  document.querySelectorAll('.ex-card').forEach(c => {
    c.addEventListener('click', () => {
      document.getElementById('mainInput').value = c.dataset.q;
      document.getElementById('taChar').textContent = c.dataset.q.length + '/2000';
      if (c.dataset.sub) {
        document.querySelectorAll('.subj-chip').forEach(s => s.classList.toggle('active', s.dataset.sub === c.dataset.sub));
        state.selSubject = c.dataset.sub;
      }
      document.getElementById('mainInput').focus();
      document.getElementById('mainInput').scrollIntoView({behavior:'smooth',block:'center'});
    });
  });

  // Textarea
  document.getElementById('mainInput').addEventListener('input', e => {
    document.getElementById('taChar').textContent = e.target.value.length + '/2000';
  });
  document.getElementById('mainInput').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') solve();
  });

  // File upload
  document.getElementById('fileUpload').addEventListener('change', handleImageUpload);

  // Remove img
  document.getElementById('removeImg').addEventListener('click', () => {
    state.uploadedImg = null; state.ocrText = '';
    document.getElementById('imgStrip').style.display = 'none';
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('fileUpload').value = '';
  });

  // Voice
  document.getElementById('voiceBtn').addEventListener('click', doVoice);

  // Clear
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('mainInput').value = '';
    document.getElementById('taChar').textContent = '0/2000';
    state.uploadedImg = null; state.ocrText = '';
    document.getElementById('imgStrip').style.display = 'none';
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('fileUpload').value = '';
    document.getElementById('answerSection').style.display = 'none';
    document.getElementById('errorBar').style.display = 'none';
  });

  // Copy btn
  document.getElementById('copyBtn').addEventListener('click', () => {
    const txt = document.getElementById('examPaper').innerText;
    navigator.clipboard.writeText(txt).then(() => showToast('✅ Copied!'));
  });

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-menu-dropdown')) closeDropdown();
  });
}

/* ──────────────────────────────────────────
   USAGE UI
   ────────────────────────────────────────── */
async function updateUsageUI() {
  if (!state.user) return;
  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await getUsage();
  const rem  = isPremium ? Infinity : Math.max(0, window.FREE_LIMIT - used);

  const pipsEl = document.getElementById('usagePips');
  pipsEl.innerHTML = '';
  const textEl = document.getElementById('usageText');

  if (u.premium) {
    pipsEl.innerHTML = '<span style="font-size:14px;">♾️</span>';
    textEl.textContent = '∞';
    textEl.style.color = 'var(--gold)';
    document.getElementById('navUsage').style.borderColor = 'rgba(245,200,66,0.3)';
  } else {
    for (let i = 0; i < FREE_LIMIT; i++) {
      const pip = document.createElement('div');
      pip.className = 'usage-pip ' + (i < used ? 'empty' : 'filled');
      pipsEl.appendChild(pip);
    }
    textEl.textContent = rem;
    textEl.style.color = rem <= 1 ? 'var(--rose)' : rem <= 2 ? 'var(--gold)' : 'var(--teal)';
  }
}

/* ──────────────────────────────────────────
   HISTORY
   ────────────────────────────────────────── */
async function loadHistory() {
  state.qHistory = await getHistory();
  renderHistory();
}

async function addToHistory(q) {
  state.qHistory.unshift(q);
  if (state.qHistory.length > 8) state.qHistory.pop();
  await saveHistory(state.qHistory);
  renderHistory();
}

function renderHistory() {
  const row = document.getElementById('historyRow');
  if (!state.qHistory.length) { row.style.display='none'; return; }
  row.style.display = 'flex';
  const label = document.createElement('span');
  label.className = 'hist-label'; label.textContent = 'Recent:';
  row.innerHTML = ''; row.appendChild(label);
  state.qHistory.forEach((h, i) => {
    const c = document.createElement('div');
    c.className = 'hist-chip'; c.title = h;
    c.textContent = h.substring(0, 36) + (h.length > 36 ? '…' : '');
    c.onclick = () => {
      document.getElementById('mainInput').value = h;
      document.getElementById('taChar').textContent = h.length + '/2000';
    };
    row.appendChild(c);
  });
}

/* ──────────────────────────────────────────
   IMAGE / OCR
   ────────────────────────────────────────── */
async function handleImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 6*1024*1024) { showError('Image must be under 6MB'); return; }

  const reader = new FileReader();
  reader.onload = async ev => {
    state.uploadedImg = { base64: ev.target.result.split(',')[1], type: file.type };
    document.getElementById('prevImg').src = ev.target.result;
    document.getElementById('prevName').textContent = file.name;
    document.getElementById('imgStrip').style.display = 'flex';

    // OCR
    const ocrEl = document.getElementById('ocrStatus');
    ocrEl.style.display = 'flex';
    document.getElementById('ocrStatusText').textContent = 'Extracting text from image…';

    try {
      const result = await Tesseract.recognize(ev.target.result, 'eng', {
        logger: m => { if (m.status === 'recognizing text') document.getElementById('ocrStatusText').textContent = 'OCR progress: ' + Math.round(m.progress*100) + '%'; }
      });
      state.ocrText = result.data.text.trim();
      ocrEl.style.display = 'none';
      if (state.ocrText) {
        document.getElementById('mainInput').value = state.ocrText;
        document.getElementById('taChar').textContent = state.ocrText.length + '/2000';
        showToast('✅ Text extracted from image!');
      } else {
        showToast('⚠️ Could not read text clearly. Type your question manually.');
      }
    } catch {
      ocrEl.style.display = 'none';
      showToast('⚠️ OCR failed. Please type your question.');
    }
  };
  reader.readAsDataURL(file);
}

/* ──────────────────────────────────────────
   VOICE INPUT
   ────────────────────────────────────────── */
function doVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showError('Voice input requires Chrome browser.'); return; }
  const rec = new SR(); rec.lang = 'en-IN';
  const btn = document.getElementById('voiceBtn');
  rec.onstart = () => { btn.classList.add('on'); btn.innerHTML = '<span class="ic">🔴</span> Listening…'; };
  rec.onresult = e => {
    const txt = e.results[0][0].transcript;
    document.getElementById('mainInput').value = txt;
    document.getElementById('taChar').textContent = txt.length + '/2000';
  };
  rec.onend = () => { btn.classList.remove('on'); btn.innerHTML = '<span class="ic">🎤</span> Voice'; };
  rec.start();
}

/* ──────────────────────────────────────────
   SOLVE
   ────────────────────────────────────────── */
async function solve() {
  const q = document.getElementById('mainInput').value.trim();
  if (!q && !state.uploadedImg) { showError('Please type a question or upload an image.'); return; }

  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await getUsage();

  // Check limit
  if (!isPremium && used >= window.FREE_LIMIT) {
    window.openUpgrade(); return;
  }

  hideAnswerArea();
  setLoading(true);
  startLoadStages();

  const prompt = buildPrompt(q || 'Solve the question in this image.');
  let content = state.uploadedImg
    ? [{ type:'image', source:{type:'base64', media_type:state.uploadedImg.type, data:state.uploadedImg.base64}},
       { type:'text', text:(q?q+'\n\n':'')+prompt }]
    : [{ type:'text', text:prompt }];

  try {
    const res = await fetch(API, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        system:'You are an expert teacher for Class '+state.selClass+' students. Respond ONLY with valid JSON — no markdown, no text outside JSON.',
        messages:[{role:'user', content}]
      })
    });

    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message||'API Error '+res.status); }

    const data = await res.json();
    const raw = data.content.filter(b=>b.type==='text').map(b=>b.text).join('').trim();

    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim()); }
    catch { const m=raw.match(/\{[\s\S]*\}/); if(m) parsed=JSON.parse(m[0]); else throw new Error('Could not parse response.'); }

    // Increment usage
    await setUsage(used + 1);
    await updateUsageUI();

    // History
    await addToHistory(q || '📷 Image question');

    // Check if this was last free question
    if (!isPremium && used + 1 >= window.FREE_LIMIT) {
      showToast('⚡ Last free question used! Upgrade for unlimited access.');
      setTimeout(openUpgrade, 3000);
    }

    renderAnswer(parsed, q);
    showToast('🎉 Solution ready!');

  } catch(err) {
    setLoading(false);
    showError('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

/* ──────────────────────────────────────────
   PROMPT
   ────────────────────────────────────────── */
function buildPrompt(q) {
  return `You are a brilliant, patient teacher helping a Class ${state.selClass} student with ${state.selSubject}.

Student's question: ${q}

Give a complete exam-style answer. Respond ONLY with this JSON (no text outside, no markdown):
{
  "question_clean": "The question in one clear sentence",
  "marks": "3 or 5 or 10 (estimate based on question complexity)",
  "steps": [
    {
      "title": "Step name (e.g. 'Given Information', 'Formula', 'Calculation', 'Conclusion')",
      "content": "Full step content shown exactly as written in an exam. Show all working.",
      "annotation": "A bracket note explaining WHY this step was done — as if a teacher is whispering to the student"
    }
  ],
  "final_answer": "The conclusive final answer clearly stated (use ∴ Therefore... format if applicable)",
  "simple_english": "2-3 sentences explaining the whole concept in very simple language a Class 6 student would understand",
  "key_concepts": ["concept1", "concept2", "concept3"],
  "annotations": [
    { "type": "formula",   "text": "Important formula used" },
    { "type": "remember",  "text": "Key thing to remember for exams" },
    { "type": "tip",       "text": "Smart exam technique" },
    { "type": "warning",   "text": "Common mistake students make" },
    { "type": "exam",      "text": "How this topic typically appears in exams" }
  ]
}

Rules:
- Minimum 3, maximum 8 steps
- For math/science: show EVERY calculation, every substitution
- For theory: use numbered points with brief explanations  
- Keep language simple and clear for Class ${state.selClass}
- annotations: provide 3–5 useful margin notes
- ONLY valid JSON`;
}

/* ──────────────────────────────────────────
   RENDER ANSWER
   ────────────────────────────────────────── */
function renderAnswer(d, origQ) {
  document.getElementById('ansBadgeSubj').textContent = state.selSubject;
  document.getElementById('ansBadgeCls').textContent  = 'Class ' + state.selClass;
  document.getElementById('paperTitle').textContent   = state.selSubject + ' · Class ' + state.selClass;
  document.getElementById('paperSub').textContent     = d.question_clean || origQ || 'Solution';
  document.getElementById('paperMarks').textContent   = d.marks || '—';

  /* MAIN COLUMN */
  const mc = document.getElementById('mainCol');
  const qBox = `<div class="q-box"><div class="q-box-label">📘 Question</div><div class="q-box-text">${esc(d.question_clean||origQ||'—')}</div></div>`;

  const steps = (d.steps||[]).map((s,i) => {
    const isLast = i === (d.steps.length-1);
    return `<div class="s-row">
      <div class="s-marker">
        <div class="s-circle">${i+1}</div>
        ${!isLast?'<div class="s-line"></div>':''}
      </div>
      <div class="s-body">
        <div class="s-title">${esc(s.title||'Step '+(i+1))}</div>
        <div class="s-content">${esc(s.content||'')}</div>
        ${s.annotation?`<div class="s-annotation"><div class="s-ann-arrow">⟵</div><div class="s-ann-text">${esc(s.annotation)}</div></div>`:''}
      </div>
    </div>`;
  }).join('');

  const finalBox = `<div class="final-box">
    <div class="final-ic">✅</div>
    <div>
      <div class="final-lbl">∴ Therefore — Final Answer</div>
      <div class="final-val">${esc(d.final_answer||'—')}</div>
    </div>
  </div>`;

  mc.innerHTML = qBox + `<div class="steps-list">${steps}</div>` + finalBox;

  if (d.simple_english) {
    mc.insertAdjacentHTML('beforeend',`<div class="explain-row"><div class="explain-ic">💡</div><div><div class="explain-lbl">Simple Explanation</div><div class="explain-txt">${esc(d.simple_english)}</div></div></div>`);
  }
  if (d.key_concepts?.length) {
    const tags = d.key_concepts.map(c=>`<span class="concept-tag">${esc(c)}</span>`).join('');
    mc.insertAdjacentHTML('beforeend',`<div class="concepts-row"><span class="concepts-lbl">🔑 Key Concepts:</span>${tags}</div>`);
  }

  /* MARGIN COLUMN */
  const mgn = document.getElementById('marginCol');
  mgn.innerHTML = '<div class="margin-head">📝 <span>Margin Notes</span></div>';
  (d.annotations||[]).forEach(a => {
    const t = (a.type||'').toLowerCase();
    let html = '';
    if (t==='formula')  html = `<div class="ann-formula">${esc(a.text)}</div>`;
    else if (t==='tip') html = `<div class="ann-tip">${esc(a.text)}</div>`;
    else if (t==='remember') html = `<div class="ann-remember">${esc(a.text)}</div>`;
    else if (t==='warning')  html = `<div class="ann-warning">${esc(a.text)}</div>`;
    else if (t==='exam')     html = `<div class="ann-exam">${esc(a.text)}</div>`;
    else html = `<div class="ann-tip">${esc(a.text)}</div>`;
    mgn.insertAdjacentHTML('beforeend', html);
  });
  if (!(d.annotations?.length)) {
    mgn.insertAdjacentHTML('beforeend','<div class="ann-tip">Read each step carefully and try solving a similar problem on your own!</div>');
  }

  document.getElementById('answerSection').style.display = 'block';
  document.getElementById('answerSection').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ──────────────────────────────────────────
   LOADING STAGES
   ────────────────────────────────────────── */
function startLoadStages() {
  let i = 0;
  const ids = ['ls1','ls2','ls3','ls4'];
  ids.forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(ids[0]).classList.add('active');
  state.loadStageTimer = setInterval(() => {
    i = (i+1) % ids.length;
    ids.forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById(ids[i]).classList.add('active');
  }, 900);
}

function setLoading(on) {
  document.getElementById('loadingCard').style.display = on ? 'block' : 'none';
  document.getElementById('solveBtn').disabled = on;
  document.getElementById('solveBtn').textContent = on ? '⏳ Solving…' : '✨ Solve Now →';
  if (!on && state.loadStageTimer) { clearInterval(state.loadStageTimer); state.loadStageTimer=null; }
}

function hideAnswerArea() {
  document.getElementById('answerSection').style.display = 'none';
  document.getElementById('errorBar').style.display = 'none';
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorBar').style.display = 'flex';
  setTimeout(()=>document.getElementById('errorBar').style.display='none', 6000);
}

function newQuestion() {
  document.getElementById('answerSection').style.display = 'none';
  document.getElementById('mainInput').value = '';
  document.getElementById('taChar').textContent = '0/2000';
  document.getElementById('mainInput').focus();
}

/* ──────────────────────────────────────────
   DROPDOWN MENU
   ────────────────────────────────────────── */
function toggleDropdown() {
  document.getElementById('dropdownMenu').classList.toggle('open');
}
function closeDropdown() { document.getElementById('dropdownMenu').classList.remove('open'); }
function openHistory() { window.closeDropdown(); showToast('📋 ' + state.qHistory.length + ' questions in history'); }
/* logout already on window early in the module */

/* ──────────────────────────────────────────
   PREMIUM MODALS
   ────────────────────────────────────────── */
function openUpgrade() {
  window.closeDropdown();
  document.getElementById('upgradeModal').classList.add('open');
}
function closeUpgrade() { document.getElementById('upgradeModal').classList.remove('open'); }

function selectPlan(el, id, price) {
  document.querySelectorAll('.plan-card').forEach(c=>c.style.outline='none');
  el.style.outline = '2px solid var(--gold)';
  state.selectedPlan = { id, price };
}

function goToPayment() {
  document.getElementById('upgradeModal').classList.remove('open');
  document.getElementById('payAmount').textContent = state.selectedPlan.price;
  document.getElementById('payPlan').textContent   = state.selectedPlan.id === 'monthly' ? 'Monthly Plan' : 'Yearly Plan';
  document.getElementById('paymentModal').classList.add('open');
}
function closePayment() {
  document.getElementById('paymentModal').classList.remove('open');
  document.getElementById('upgradeModal').classList.add('open');
}

function formatCard(el) {
  let v = el.value.replace(/\D/g,'').substring(0,16);
  el.value = v.replace(/(.{4})/g,'$1 ').trim();
}
function formatExp(el) {
  let v = el.value.replace(/\D/g,'');
  if (v.length >= 2) v = v.substring(0,2)+'/'+v.substring(2,4);
  el.value = v;
}

function processPayment() {
  const name = document.querySelector('.pay-input').value.trim();
  const card = document.getElementById('cardNum').value.replace(/\s/g,'');
  if (!name) { showToast('⚠️ Please enter cardholder name'); return; }
  if (card.length < 16) { showToast('⚠️ Please enter a valid card number'); return; }

  const btn = document.querySelector('.payment-box .btn-gold');
  btn.textContent = '⏳ Processing…'; btn.disabled = true;
  setTimeout(async () => {
    btn.textContent = 'Pay Now →'; btn.disabled = false;
    await window.saveUserData(state.user.uid, { premium: true });
    await window.updateUsageUI();
    document.getElementById('paymentModal').classList.remove('open');
    document.getElementById('successModal').classList.add('open');
  }, 2000);
}

function closeSuccess() {
  document.getElementById('successModal').classList.remove('open');
  showToast('🎉 Premium activated! Unlimited questions unlocked!');
}

/* ──────────────────────────────────────────
   UTILS
   ────────────────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

// Expose all functions to window\n
  if (typeof handleImageUpload === 'function') window.handleImageUpload = handleImageUpload;\n  if (typeof doVoice === 'function') window.doVoice = doVoice;\n  if (typeof toggleDropdown === 'function') window.toggleDropdown = toggleDropdown;\n  if (typeof closeDropdown === 'function') window.closeDropdown = closeDropdown;\n  if (typeof openHistory === 'function') window.openHistory = openHistory;\n  if (typeof openUpgrade === 'function') window.openUpgrade = openUpgrade;\n  if (typeof closeUpgrade === 'function') window.closeUpgrade = closeUpgrade;\n  if (typeof selectPlan === 'function') window.selectPlan = selectPlan;\n  if (typeof goToPayment === 'function') window.goToPayment = goToPayment;\n  if (typeof closePayment === 'function') window.closePayment = closePayment;\n  if (typeof formatCard === 'function') window.formatCard = formatCard;\n  if (typeof formatExp === 'function') window.formatExp = formatExp;\n  if (typeof processPayment === 'function') window.processPayment = processPayment;\n  if (typeof closeSuccess === 'function') window.closeSuccess = closeSuccess;\n  if (typeof showToast === 'function') window.showToast = showToast;\n  if (typeof showError === 'function') window.showError = showError;\n  if (typeof newQuestion === 'function') window.newQuestion = newQuestion;

  if (typeof selectClass === 'function') window.selectClass = selectClass;
  if (typeof selectStream === 'function') window.selectStream = selectStream;
  if (typeof finishSetup === 'function') window.finishSetup = finishSetup;
  if (typeof initHome === 'function') window.initHome = initHome;
  if (typeof updateUsageUI === 'function') window.updateUsageUI = updateUsageUI;
  if (typeof loadHistory === 'function') window.loadHistory = loadHistory;
  if (typeof addToHistory === 'function') window.addToHistory = addToHistory;
  if (typeof renderHistory === 'function') window.renderHistory = renderHistory;
  if (typeof solve === 'function') window.solve = solve;
  if (typeof buildPrompt === 'function') window.buildPrompt = buildPrompt;
  if (typeof renderAnswer === 'function') window.renderAnswer = renderAnswer;
  if (typeof startLoadStages === 'function') window.startLoadStages = startLoadStages;
  if (typeof setLoading === 'function') window.setLoading = setLoading;
  if (typeof hideAnswerArea === 'function') window.hideAnswerArea = hideAnswerArea;
  if (typeof esc === 'function') window.esc = esc;
  if (typeof toggleAuthMode === 'function') window.toggleAuthMode = toggleAuthMode;
  if (typeof handleAuth === 'function') window.handleAuth = handleAuth;
  if (typeof loadUserData === 'function') window.loadUserData = loadUserData;
  if (typeof getUsage === 'function') window.getUsage = getUsage;
  if (typeof setUsage === 'function') window.setUsage = setUsage;
  if (typeof getHistory === 'function') window.getHistory = getHistory;
  if (typeof saveHistory === 'function') window.saveHistory = saveHistory;
  if (typeof logout === 'function') window.logout = logout;
  if (typeof saveUserData === 'function') window.saveUserData = saveUserData;
  if (typeof showPage === 'function') window.showPage = showPage;
