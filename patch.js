const fs = require('fs');

let html = fs.readFileSync('studyai.html', 'utf8');

// initHome
html = html.replace(
  /function initHome\(\) \{\s*const u = state.user;\s*\/\/ Avatar\s*document.getElementById\('navAvatar'\).textContent = u.phone.slice\(-2\).toUpperCase\(\);\s*document.getElementById\('userInfo'\).innerHTML = `[^`]+`;/,
  `window.initHome = async function() {
  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  // Avatar
  document.getElementById('navAvatar').textContent = state.email.slice(0,2).toUpperCase();
  document.getElementById('userInfo').innerHTML = \\\`📧 \${state.email}<br><span style="color:var(--teal)">\${isPremium?'💎 Premium':'Free Plan'}</span>\\\`;`
);

// updateUsageUI
html = html.replace(
  /function updateUsageUI\(\) \{\s*const u = state\.user;\s*const used = getUsage\(u\.phone\);\s*const rem  = u\.premium \? Infinity : Math\.max\(0, FREE_LIMIT - used\);/,
  `window.updateUsageUI = async function() {
  if (!state.user) return;
  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await window.getUsage();
  const rem  = isPremium ? Infinity : Math.max(0, window.FREE_LIMIT - used);`
);

// loadHistory and addToHistory
html = html.replace(
  /function loadHistory\(\) \{\s*state.qHistory = getHistory\(state.user.phone\);\s*renderHistory\(\);\s*}\s*function addToHistory\(q\) \{\s*state.qHistory.unshift\(q\);\s*if \(state.qHistory.length > 8\) state.qHistory.pop\(\);\s*saveHistory\(state.user.phone, state.qHistory\);\s*renderHistory\(\);\s*}\s*function renderHistory\(\) \{/,
  `window.loadHistory = async function() {
  state.qHistory = await window.getHistory();
  window.renderHistory();
}

window.addToHistory = async function(q) {
  state.qHistory.unshift(q);
  if (state.qHistory.length > 8) state.qHistory.pop();
  await window.saveHistory(state.qHistory);
  window.renderHistory();
}

window.renderHistory = function() {`
);

// solve
html = html.replace(
  /async function solve\(\) \{\s*const q = document\.getElementById\('mainInput'\)\.value\.trim\(\);\s*if \(\!q && \!state\.uploadedImg\) \{ showError\('Please type a question or upload an image\.'\); return; \}\s*const u = state\.user;\s*const used = getUsage\(u\.phone\);\s*\/\/ Check limit\s*if \(\!u\.premium && used >= FREE_LIMIT\) \{/,
  `window.solve = async function() {
  const q = document.getElementById('mainInput').value.trim();
  if (!q && !state.uploadedImg) { window.showError('Please type a question or upload an image.'); return; }

  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await window.getUsage();

  // Check limit
  if (!isPremium && used >= window.FREE_LIMIT) {`
);

html = html.replace(
  /    \/\/ Increment usage\s*setUsage\(u.phone, used \+ 1\);\s*updateUsageUI\(\);\s*\/\/ History\s*addToHistory\(q \|\| '[^']+'\);\s*\/\/ Check if this was last free question\s*if \(\!u\.premium && used \+ 1 >= FREE_LIMIT\) \{/,
  `    // Increment usage
    await window.setUsage(used + 1);
    await window.updateUsageUI();

    // History
    await window.addToHistory(q || '📷 Image question');

    // Check if this was last free question
    if (!isPremium && used + 1 >= window.FREE_LIMIT) {`
);

fs.writeFileSync('studyai.html', html, 'utf8');
console.log("Regex patch applied.");
