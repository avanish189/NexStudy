const fs = require('fs');
let html = fs.readFileSync('studyai.html', 'utf8');

// 1. Remove the malformed Object.assign from the first tesseract script
const badAssign = /Object\.assign\(window,\s*\{[\s\S]*?\}\);\s*\\n/g;
html = html.replace(badAssign, '');
html = html.replace(/<script src="([^"]+)">\s*<\/script>/, '<script src="$1"></script>');

// Just in case it's literally:
html = html.replace(
  /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/tesseract\.js\/4\.1\.1\/tesseract\.min\.js">\nObject\.assign[\s\S]*?\\n<\/script>/,
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js"></script>'
);

// We need a robust way to assign window. properties.
// Let's iterate all function definitions in the module and explicitly export them at the bottom.
const functionMatches = html.matchAll(/(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g);
const fns = new Set();
for (const match of functionMatches) {
  fns.add(match[1]);
}

// Ensure toggleAuthMode and handleAuth are included if they are defined as window.x = function
fns.add('toggleAuthMode');
fns.add('handleAuth');
fns.add('loadUserData');
fns.add('getUsage');
fns.add('setUsage');
fns.add('getHistory');
fns.add('saveHistory');
fns.add('logout');
fns.add('saveUserData');
fns.add('showPage');
fns.add('initHome');
fns.add('updateUsageUI');
fns.add('loadHistory');
fns.add('addToHistory');
fns.add('renderHistory');
fns.add('solve');

// For any remaining window.x = function, let's revert ALL OF THEM to standard function declarations inside the script!
html = html.replace(/window\.([a-zA-Z0-9_]+)\s*=\s*(async\s+)?function\s*\(/g, '$2function $1(');

let exportStrs = [];
for (const fn of fns) {
  exportStrs.push(`  if (typeof ${fn} === 'function') window.${fn} = ${fn};`);
}

const safeExportBlock = `
// Expose all functions to window
${exportStrs.join('\\n')}
`;

// Insert the safe export block right before the LAST </script> tag
if (!html.includes('// Expose all functions to window')) {
  const parts = html.split('</script>');
  if (parts.length > 1) {
    const lastIdx = parts.length - 2;
    parts[lastIdx] = parts[lastIdx] + '\\n' + safeExportBlock;
    html = parts.join('</script>');
  }
}

fs.writeFileSync('studyai.html', html, 'utf8');
console.log("Repair finished.");
