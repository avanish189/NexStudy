const fs = require('fs');
let html = fs.readFileSync('studyai.html', 'utf8');

const missingFns = [
  'handleImageUpload',
  'doVoice',
  'toggleDropdown',
  'closeDropdown',
  'openHistory',
  'openUpgrade',
  'closeUpgrade',
  'selectPlan',
  'goToPayment',
  'closePayment',
  'formatCard',
  'formatExp',
  'processPayment',
  'closeSuccess',
  'showToast',
  'showError',
  'newQuestion'
];

let exportStrs = [];
for (const fn of missingFns) {
  exportStrs.push(`  if (typeof ${fn} === 'function') window.${fn} = ${fn};`);
}

const safeExportBlock = `
${exportStrs.join('\\n')}
`;

html = html.replace('// Expose all functions to window', '// Expose all functions to window\\n' + safeExportBlock);

fs.writeFileSync('studyai.html', html);
console.log('Fixed missing exports');
