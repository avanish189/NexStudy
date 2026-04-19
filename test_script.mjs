const key = 'AIzaSyD1ZRYlkFal9_a4NnmJfpl9v4Q6q7wUUIQ';
const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];

async function test() {
  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({contents: [{parts: [{text: 'hi'}]}]})
      });
      const data = await res.json();
      console.log(`Model: ${m}`);
      if (data.error) {
        console.log(`Error: ${data.error.message}`);
      } else {
        console.log(`Success! Candidates: ${data.candidates.length}`);
      }
      console.log('---');
    } catch (err) {
      console.log(`Model: ${m} - Exception: ${err.message}`);
    }
  }
}
test();
