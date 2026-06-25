import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import supabase from '../config/supabase.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper to clean and parse JSON response
const cleanJSONResponse = (text) => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
      console.error('JSON parsing error on cleaned array text:', e);
    }
  }
  
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      const parsed = JSON.parse(text.substring(objStart, objEnd + 1));
      if (parsed.questions) return parsed.questions;
      return [parsed];
    } catch (e) {
      console.error('JSON parsing error on cleaned object text:', e);
    }
  }
  
  throw new Error('No valid JSON array or object block found in the model response');
};

// ─── POST /api/aptitude/generate ─────────────────────────────────────────────
// Generates aptitude MCQs and saves them in Supabase messages if session_id is provided
router.post('/generate', authenticate, async (req, res) => {
  const { topic, total_questions, session_id } = req.body;
  
  const validTopics = ['Quantitative', 'Logical Reasoning', 'Verbal Ability'];
  const questionsCount = parseInt(total_questions, 10) || 5;
  
  if (!topic || !validTopics.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic selected. Must be Quantitative, Logical Reasoning, or Verbal Ability.' });
  }
  
  if (questionsCount < 5 || questionsCount > 10) {
    return res.status(400).json({ error: 'Question count must be between 5 and 10.' });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const seed = session_id || Math.random().toString(36).substring(7);
    const systemPrompt = `
You are an expert aptitude test maker. Create a set of ${questionsCount} multiple-choice questions for the topic: ${topic}.
Each question must test the candidate's core skills in this area.
Format the questions as a JSON array of objects. Each object must have:
- "question": The aptitude problem question text.
- "options": An array of exactly 4 distinct and unique answer options (strings). One must be the correct answer, and the other three must be plausible but incorrect distractors. All 4 options must be completely different from one another.
- "correct_option": The 0-based index of the correct option (number 0, 1, 2, or 3).
- "explanation": A detailed, easy-to-understand explanation of how to solve the problem step-by-step.

Respond ONLY with the JSON array. Do not wrap in markdown or add any other text.
Ensure that you generate a unique and diverse set of questions. [Session: ${seed}]
`.trim();

    let questions = [];
    let lastParsedQuestions = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await model.generateContent([systemPrompt]);
        const responseText = response.response.text();
        console.log("Raw Aptitude Gemini Response:", responseText);
        const parsed = cleanJSONResponse(responseText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastParsedQuestions = parsed;
          const allValid = parsed.every(q => 
            Array.isArray(q.options) && 
            q.options.length === 4 && 
            new Set(q.options.map(o => o.trim())).size === 4
          );
          if (allValid) {
            questions = parsed;
            break;
          }
        }
        console.warn(`Attempt ${attempts + 1}: Aptitude generation had invalid/duplicate options. Retrying...`);
      } catch (e) {
        console.error(`Attempt ${attempts + 1} generation/parsing failed:`, e);
      }
      attempts++;
    }
    if (questions.length === 0 && lastParsedQuestions) {
      questions = lastParsedQuestions;
    }
    if (!questions || questions.length === 0) {
      throw new Error("Failed to generate valid aptitude questions from Gemini.");
    }

    // If session_id is provided, save questions in messages table so they can be graded via submit-mcq
    if (session_id) {
      const messagesToInsert = questions.map((q, idx) => ({
        session_id: session_id,
        role: 'agent',
        content: JSON.stringify({
          question: q.question,
          options: q.options,
          correct_option: q.correct_option,
          explanation: q.explanation
        }),
        question_number: idx + 1
      }));

      const { error: msgInsertError } = await supabase.from('messages').insert(messagesToInsert);
      if (msgInsertError) {
        console.error('Failed to insert aptitude questions into DB messages:', msgInsertError);
      }
    }

    res.json({ topic, questions });
  } catch (err) {
    console.error('Aptitude generation error:', err);
    res.status(500).json({ error: 'Failed to generate aptitude questions' });
  }
});

export default router;
