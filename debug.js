const fs = require('fs');
const html = fs.readFileSync('studyai.html', 'utf8');
const start = html.indexOf('<script type="module">') + 22;
const end = html.lastIndexOf('</script>');
fs.writeFileSync('test_script.js', html.substring(start, end), 'utf8');
console.log('Script written.');
