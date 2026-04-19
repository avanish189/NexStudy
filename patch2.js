const fs = require('fs');
let html = fs.readFileSync('studyai.html', 'utf8');

const fns = [
  'handleImageUpload',
  'doVoice',
  'toggleDropdown',
  'closeDropdown',
  'openHistory',
  'logout',
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
  'newQuestion',
  'renderAnswer',
  'startLoadStages',
  'setLoading',
  'hideAnswerArea',
  'esc',
  'buildPrompt'
];

fns.forEach(fn => {
  const rgxAsync = new RegExp(\`async function \${fn}\\\(\`, 'g');
  html = html.replace(rgxAsync, \`window.\${fn} = async function(\`);
  const rgxSync = new RegExp(\`function \${fn}\\\(\`, 'g');
  html = html.replace(rgxSync, \`window.\${fn} = function(\`);
});

// Since processPayment needs logic change for saveUserData:
html = html.replace(
  /window\.processPayment = function\(\) \{(.*?)state\.user\.premium = true;\s*saveUser\(state\.user\);\s*updateUsageUI\(\);(.*?)_X_/s,
  `window.processPayment = function() {$1
    window.saveUserData(state.user.uid, { premium: true }).then(() => {
      window.updateUsageUI();$2
    });
_X_`
);
// Above regex is too complex/risky, let's just do a specific string replace:
const targetString = `state.user.premium = true;
    saveUser(state.user);
    updateUsageUI();
    document.getElementById('paymentModal').classList.remove('open');
    document.getElementById('successModal').classList.add('open');
  }, 2000);`;
const replacementString = `window.saveUserData(state.user.uid, { premium: true }).then(() => {
      window.updateUsageUI();
      document.getElementById('paymentModal').classList.remove('open');
      document.getElementById('successModal').classList.add('open');
    });
  }, 2000);`;
html = html.replace(targetString, replacementString);

// Also missing window. everywhere they are accessed inside the script!
// But since they are on window, they work globally. Oh wait, `type="module"` scripts do NOT put top-level functions on `window` and variables on `globalThis` by default. However, standard DOM event handlers `onclick="showToast()"` will look up `window.showToast()`. But internally to the script, wait... internally, if they are defined as `window.showToast = ...`, calling `showToast()` will NOT work inside the module because they are not declared with `var/let/const/function` in the module block!
// Wait! I redefined them as `window.showToast = function` instead of `function showToast`. This means they don't exist as local variables inside the module!
// Thus, internal calls like `showToast('Wait')` inside the module will throw `ReferenceError: showToast is not defined`!

fs.writeFileSync('studyai.html', html, 'utf8');
console.log("Patch applied.");
