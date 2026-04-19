const fs = require('fs');
let html = fs.readFileSync('studyai.html', 'utf8');

// Revert the `window.fn = function()` modifications from my failed patches.
html = html.replace(/window\.initHome = async function\(\)/g, "async function initHome()");
html = html.replace(/window\.updateUsageUI = async function\(\)/g, "async function updateUsageUI()");
html = html.replace(/window\.loadHistory = async function\(\)/g, "async function loadHistory()");
html = html.replace(/window\.addToHistory = async function\(q\)/g, "async function addToHistory(q)");
html = html.replace(/window\.renderHistory = function\(\)/g, "function renderHistory()");
html = html.replace(/window\.solve = async function\(\)/g, "async function solve()");

// Notice that the other functions I hadn't patched yet, they are still 'function'
// So I don't need to revert them.

// Now let's carefully replace internal logic that referenced `phone`
// Inside initHome:
html = html.replace(
  `async function initHome() {
  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  // Avatar
  document.getElementById('navAvatar').textContent = state.email.slice(0,2).toUpperCase();
  document.getElementById('userInfo').innerHTML = \\\`📧 \${state.email}<br><span style="color:var(--teal)">\${isPremium?'💎 Premium':'Free Plan'}</span>\\\`;`,
  `async function initHome() {
  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  // Avatar
  document.getElementById('navAvatar').textContent = state.email.slice(0,2).toUpperCase();
  document.getElementById('userInfo').innerHTML = \`📧 \${state.email}<br><span style="color:var(--teal)">\${isPremium?'💎 Premium':'Free Plan'}</span>\`;`
);

// updateUsageUI
html = html.replace(
  `async function updateUsageUI() {
  if (!state.user) return;
  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await window.getUsage();
  const rem  = isPremium ? Infinity : Math.max(0, window.FREE_LIMIT - used);`,
  `async function updateUsageUI() {
  if (!state.user) return;
  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await getUsage();
  const rem  = isPremium ? Infinity : Math.max(0, window.FREE_LIMIT - used);`
);

// loadHistory
html = html.replace(
  `async function loadHistory() {
  state.qHistory = await window.getHistory();
  window.renderHistory();
}`,
  `async function loadHistory() {
  state.qHistory = await getHistory();
  renderHistory();
}`
);

// addToHistory
html = html.replace(
  `async function addToHistory(q) {
  state.qHistory.unshift(q);
  if (state.qHistory.length > 8) state.qHistory.pop();
  await window.saveHistory(state.qHistory);
  window.renderHistory();
}`,
  `async function addToHistory(q) {
  state.qHistory.unshift(q);
  if (state.qHistory.length > 8) state.qHistory.pop();
  await saveHistory(state.qHistory);
  renderHistory();
}`
);

// solve
html = html.replace(
  `async function solve() {
  const q = document.getElementById('mainInput').value.trim();
  if (!q && !state.uploadedImg) { window.showError('Please type a question or upload an image.'); return; }

  const data = await window.loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await window.getUsage();

  // Check limit
  if (!isPremium && used >= window.FREE_LIMIT) {`,
  `async function solve() {
  const q = document.getElementById('mainInput').value.trim();
  if (!q && !state.uploadedImg) { showError('Please type a question or upload an image.'); return; }

  const data = await loadUserData(state.user.uid);
  const isPremium = data?.premium || false;
  const used = await getUsage();

  // Check limit
  if (!isPremium && used >= window.FREE_LIMIT) {`
);

html = html.replace(
  `    // Increment usage
    await window.setUsage(used + 1);
    await window.updateUsageUI();

    // History
    await window.addToHistory(q || '📷 Image question');

    // Check if this was last free question
    if (!isPremium && used + 1 >= window.FREE_LIMIT) {
      window.showToast('⚡ Last free question used! Upgrade for unlimited access.');
      setTimeout(window.openUpgrade, 3000);
    }

    renderAnswer(parsed, q);
    window.showToast('🎉 Solution ready!');

  } catch(err) {
    setLoading(false);
    window.showError('Error: ' + err.message);
  } finally {
    setLoading(false);
  }`,
  `    // Increment usage
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
  }`
);

// finishSetup
html = html.replace(
  `window.selectClass = function(el)`, `function selectClass(el)`
);
html = html.replace(
  `window.selectStream = function(el)`, `function selectStream(el)`
);
html = html.replace(
  `window.finishSetup = async function()`, `async function finishSetup()`
);
html = html.replace(
  /window\.showToast/g, `showToast`
);
html = html.replace(
  /window\.showPage/g, `showPage`
);
html = html.replace(
  /window\.initHome/g, `initHome`
);

// Add the window exports at the bottom
const exportsStr = `
Object.assign(window, {
  selectClass,
  selectStream,
  finishSetup,
  initHome,
  handleImageUpload,
  doVoice,
  solve,
  toggleDropdown,
  closeDropdown,
  openHistory,
  openUpgrade,
  closeUpgrade,
  selectPlan,
  goToPayment,
  closePayment,
  formatCard,
  formatExp,
  processPayment,
  closeSuccess,
  showToast,
  showError,
  newQuestion,
  loadUserData,
  renderHistory
});
`;

if (!html.includes('Object.assign(window,')) {
    html = html.replace('</script>', exportsStr + '\\n</script>');
}

fs.writeFileSync('studyai.html', html, 'utf8');
console.log("Fixes applied successfully.");
