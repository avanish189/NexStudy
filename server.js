const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // <-- Enable serving files like studyai.html

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/studyai.html');
});

// Google Gemini API config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the .env file.");
}

app.post('/api/solve', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({ error: { message: "Messages payload is required." } });
    }

    // Extract the original question from frontend payload
    let userQuestion = "";
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const contentStr = Array.isArray(lastMsg.content) 
        ? lastMsg.content.find(c => c.type === 'text')?.text || ""
        : typeof lastMsg.content === 'string' ? lastMsg.content : "";
      
      // Attempt to extract the pure question from the legacy prompt structure
      const qMatch = contentStr.match(/Student's question:\s*([\s\S]*?)\n\nGive a complete exam-style answer/);
      userQuestion = qMatch ? qMatch[1].trim() : contentStr;
    }

    // Optimize prompt combined with the user's question
    let promptText = `You are a helpful teacher. Solve step-by-step, give final answer, and explain simply for school students. Keep the answer short and clear.\n\nSolve the question step-by-step in simple English for class 6–12 students: ${userQuestion}`;

    // Inject the frontend's required JSON schema to ensure the UI renders correctly!
    let contentStrLocal = "";
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      contentStrLocal = Array.isArray(lastMsg.content) 
        ? lastMsg.content.find(c => c.type === 'text')?.text || ""
        : typeof lastMsg.content === 'string' ? lastMsg.content : "";
    }
    if (contentStrLocal && contentStrLocal.includes("Respond ONLY with this JSON")) {
      const schemaPart = contentStrLocal.substring(contentStrLocal.indexOf("Respond ONLY with this JSON"));
      promptText += "\n\n" + schemaPart;
    }

    // Proxies request to Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        generationConfig: { responseMimeType: "application/json" },
        contents: [
          {
            parts: [
              {
                text: promptText
              }
            ]
          }
        ]
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API Error:", data);
      return res.status(geminiResponse.status).json(data);
    }

    // Parse the response properly as requested
    const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Provide the legacy structure to ensure the frontend maintains 'fully working' behavior 
    // and beautiful formatting without throwing a JSON.parse error
    let legacyJsonResponse;
    try {
      legacyJsonResponse = JSON.parse(answerText.replace(/^```json\s*/,'').replace(/```$/,'').trim());
    } catch {
      legacyJsonResponse = {
        question_clean: userQuestion,
        marks: "—",
        steps: [
          {
            title: "Solution",
            content: answerText
          }
        ],
        final_answer: "See solution steps."
      };
    }

    // Return a clean response to frontend formatted exactly as requested
    res.json({
      answer: answerText,
      // Pass content property for backward compatibility with existing front-end 
      content: [{ type: 'text', text: JSON.stringify(legacyJsonResponse) }]
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: { message: "Internal Server Error" } });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
  console.log(`Ready to proxy requests to Gemini API!`);
});
