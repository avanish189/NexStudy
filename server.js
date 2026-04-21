const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
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

// Helper utility for making Gemini API calls with strict JSON schemas
async function callGemini(promptText, schemaExample, imageBase64 = null) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const fullPrompt = `${promptText}\n\nRespond ONLY with this JSON format exactly:\n${schemaExample}`;
  
  const parts = [{ text: fullPrompt }];
  
  if (imageBase64) {
    // base64 format from frontend is 'data:image/jpeg;base64,...'
    const mimeMatch = imageBase64.match(/^data:(.*?);base64,/);
    if (mimeMatch) {
      parts.push({
        inlineData: {
          mimeType: mimeMatch[1],
          data: imageBase64.replace(/^data:.*?;base64,/, '')
        }
      });
    }
  }

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ parts: parts }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");

  const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return JSON.parse(answerText.replace(/^```json\s*/,'').replace(/```$/,'').trim());
  } catch(e) {
    console.error("Failed to parse Gemini output:", answerText);
    throw new Error("Invalid format from AI");
  }
}

// 1. SMART SOLVER ENDPOINT
app.post('/api/solve', async (req, res) => {
  try {
    const { messages, text, image } = req.body;
    let userQuestion = text || "";
    
    // Legacy support for older frontend message structures
    if (!userQuestion && messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const contentStr = Array.isArray(lastMsg.content) 
        ? lastMsg.content.find(c => c.type === 'text')?.text || ""
        : typeof lastMsg.content === 'string' ? lastMsg.content : "";
      
      const qMatch = contentStr.match(/Student's question:\s*([\s\S]*?)\n\nGive a complete exam-style answer/);
      userQuestion = qMatch ? qMatch[1].trim() : contentStr;
    }

    if (!userQuestion && !image) return res.status(400).json({ error: "Question or image is required." });

    const promptText = `You are an expert school teacher. Solve the question step-by-step.
Requirements:
- For each step, provide the mathematical 'content' and a simple 'explanation'.
- Provide the final answer explicitly.
- Provide a full summary of the approach.
- Provide a list of formulas used.
- List common mistakes students make.
- Provide a trick or shortcut if any (or "None").
- Provide a 'pureSolution' which is JUST the mathematical steps with absolutely no English explanation, formatted beautifully with line breaks.
Question: ${userQuestion || "Solve the provided image."}`;
    
    const schema = `{
      "stepByStep": "Detailed steps",
      "finalAnswer": "Final answer explicitly",
      "summary": "Brief summary of the entire process",
      "formulas": ["Formula 1", "Formula 2"],
      "commonMistakes": ["Mistake 1", "Mistake 2"],
      "tricks": "Any short trick or tip to solve it faster (or write None)",
      "pureSolution": "Just the pure mathematical steps without any english explanations. E.g. x^2 = 4 \\n x = 2",
      "examImportance": "Low | Medium | High",
      "question_clean": "Original clean question",
      "marks": "Expected marks",
      "steps": [{"title": "Step 1", "content": "mathematical calculation", "explanation": "simple explanation for this step"}] 
    }`;

    let result = await callGemini(promptText, schema, image);
    
    // Fallback missing legacy arrays to avoid crashing existing frontend UI
    if (!result.steps) result.steps = [{ title: "Solution", content: result.stepByStep || result.finalAnswer }];

    res.json({
      answer: JSON.stringify(result),
      content: [{ type: 'text', text: JSON.stringify(result) }] // Legacy compat
    });

  } catch (err) {
    console.error("Solver Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. EXAM GENERATOR ENDPOINT
app.post('/api/exam/generate', async (req, res) => {
  try {
    const { classLevel, subject, topic } = req.body;
    if(!classLevel || !subject || !topic) return res.status(400).json({error: "Class, Subject, and Topic required"});

    const promptText = `Generate a 20-question Multiple Choice Question (MCQ) exam for class ${classLevel} students in subject ${subject}, specifically focusing on the topic/chapter: "${topic}". Provide exactly 20 MCQs. Each question must have 4 options, the correct answer, and a short explanation.`;
    const schema = `[
      {
        "id": 1,
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "The exact string of the correct option (e.g. 'Option B')",
        "explanation": "Short explanation of why it is correct"
      }
    ]`;

    const questions = await callGemini(promptText, schema);
    res.json(questions);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. MISTAKE CHECKER ENDPOINT
app.post('/api/exam/mistake', async (req, res) => {
  try {
    const { question, correctAnswer, studentAnswer } = req.body;
    
    const promptText = `The student answered a question incorrectly. \nQuestion: ${question}\nCorrect Answer: ${correctAnswer}\nStudent's Answer: ${studentAnswer}\nAnalyze the student's answer and explain their mistake in simple, encouraging terms.`;
    const schema = `{
      "mistakeExplanation": "Why the student was wrong",
      "encouragement": "Positive feedback sentence"
    }`;

    const feedback = await callGemini(promptText, schema);
    res.json(feedback);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. FINAL FEEDBACK ENDPOINT
app.post('/api/exam/feedback', async (req, res) => {
  try {
    const { report } = req.body;
    // report is an array: [{ question, studentAnswer, isCorrect }]
    
    const promptText = `Analyze this student's exam performance and offer final feedback.\nExam Data: ${JSON.stringify(report)}`;
    const schema = `{
      "weakTopics": "comma separated weak concepts",
      "suggestions": "1 paragraph of helpful advice"
    }`;

    const feedback = await callGemini(promptText, schema);
    res.json(feedback);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. SEND REPORT EMAIL ENDPOINT
app.post('/api/exam/send-report', async (req, res) => {
  try {
    const { studentName, classLevel, parentEmail, score, totalQuestions, reportHTML } = req.body;

    if (!process.env.EMAIL_PASS) {
      console.warn("EMAIL_PASS not found in .env, skipping actual email send.");
      return res.json({ success: true, message: "Email simulated (no credentials)" });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'nexcart.system@gmail.com',
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: 'nexcart.system@gmail.com',
      to: `${parentEmail}, nexcart.system@gmail.com`, // Send to parent and CC registered email
      subject: `StudyAI Exam Result: ${studentName} (Class ${classLevel})`,
      html: `
        <h2>Exam Result for ${studentName}</h2>
        <p><strong>Score:</strong> ${score} / ${totalQuestions}</p>
        <p><strong>Class:</strong> ${classLevel}</p>
        <hr>
        <h3>Detailed Report</h3>
        ${reportHTML}
        <br><br>
        <p>Thank you for using StudyAI!</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent successfully" });

  } catch(err) {
    console.error("Email Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
  console.log(`Ready to proxy requests to Gemini API!`);
});
