import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import supabase from '../config/supabase.js';
import authenticate from '../middleware/auth.js';
import sanitizeInput from '../middleware/sanitize.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Rate Limiter: 20 requests per minute per IP ──────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please slow down.' },
});

router.use(limiter);

// Helper to clean markdown formatting, parse multiple JSON blocks and merge them robustly
const cleanJSONResponse = (text) => {
  // If it contains a JSON array (useful for MCQs / Aptitude)
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return text.substring(arrayStart, arrayEnd + 1);
  }

  const objects = [];
  let depth = 0;
  let startIdx = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        const block = text.substring(startIdx, i + 1);
        try {
          objects.push(JSON.parse(block));
        } catch (e) {
          // Ignore invalid blocks
        }
      }
    }
  }

  if (objects.length === 0) {
    return text.trim();
  }

  // Merge the objects
  const merged = {};
  for (const obj of objects) {
    for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined) {
        // Prefer the question that belongs to the higher question_number
        if (key === 'question' && merged.question && obj.question_number && merged.question_number && obj.question_number < merged.question_number) {
          continue;
        }
        merged[key] = obj[key];
      }
    }
  }
  return JSON.stringify(merged);
};

// ─── Gemini System Prompt for QA ──────────────────────────────────────────────
const buildSystemPrompt = (role, difficulty, total_questions) => {
  const diffInstructions = difficulty === 'easy'
    ? "Ask EASY, fundamental, and highly straightforward questions suitable for a beginner. Focus on basic terminology, simple definitions, and direct syntax questions. Reduce difficulty to half of what is normally asked."
    : "Ask standard, professional technical questions of medium difficulty that test core concepts, practical scenarios, and problem-solving skills.";

  return `
You are a strict but fair technical interviewer specializing in ${role} interviews.

RULES:
- ${diffInstructions}
- Ask ONE question at a time. Never ask multiple questions together.
- After the candidate answers, evaluate it briefly (2-3 sentences max).
- Give a score from 1-10 for that answer.
- Even if the candidate's answer is incorrect, extremely short, or gibberish, you MUST evaluate it (give a low score like 1), provide feedback, and progress to the next question. Do NOT repeat the same question or ask them to retry.
- Then either ask a relevant follow-up OR move to the next topic.
- After exactly ${total_questions} questions total, end the interview.

ENDING THE INTERVIEW:
When you have asked and evaluated ${total_questions} questions, output ONLY this JSON (nothing else):
{
  "interview_complete": true,
  "overall_score": <number 1-10>,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "summary": "2-3 sentence overall assessment"
}

FORMAT FOR EACH TURN (before interview ends):
{
  "question": "your next question here",
  "feedback": "evaluation of their last answer (null for first question)",
  "answer_score": <1-10 or null for first question>,
  "question_number": <1-${total_questions}>
}

Always respond with valid JSON only. No markdown, no extra text.
`.trim();
};

// Prompt for MCQ Generation
const buildMcqPrompt = (role, difficulty, total_questions) => {
  const diffInstructions = difficulty === 'easy'
    ? "fundamental, basic, and easy multiple-choice questions suitable for a beginner. Focus on syntax, standard concepts, and definitions. Reduce difficulty to half."
    : "standard, professional, and medium-difficulty multiple-choice questions.";

  return `
You are a technical interviewer. Generate exactly ${total_questions} technical multiple-choice questions for a ${role} position.
The questions should be ${diffInstructions}

Format the output as a JSON array of objects. Each object must have:
- "question": The technical question text.
- "options": An array of exactly 4 distinct and unique answer options (strings). One must be the correct answer, and the other three must be plausible but incorrect distractors. All 4 options must be completely different from one another.
- "correct_option": The 0-based index of the correct option (number 0, 1, 2, or 3).
- "explanation": A 1-2 sentence explanation of why this option is correct.

Respond ONLY with the JSON array. Do not wrap in markdown or add any other text.
`.trim();
};

// Helper to send message with retry on transient errors (like 503 or 429)
const sendMessageWithRetry = async (chat, message, maxRetries = 3, delayMs = 1500) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chat.sendMessage(message);
    } catch (err) {
      const isTransient = err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429');
      if (isTransient && i < maxRetries - 1) {
        console.log(`Transient Gemini error (${err.status || err.message}). Retrying in ${delayMs}ms (Attempt ${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
};

// ─── POST /api/interview/start ────────────────────────────────────────────────
// Creates a new session and returns first question (QA) or all questions (MCQ)
router.post('/start', authenticate, async (req, res) => {
  const { role, type, difficulty, total_questions } = req.body;
  const userId = req.user.id;

  const validRoles = ['Frontend', 'Backend', 'DSA', 'System Design', 'Full Stack', 'Aptitude'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }

  const sessionType = type === 'mcq' ? 'mcq' : 'qa';
  const diff = difficulty === 'easy' ? 'easy' : 'medium';
  const totalQuestions = parseInt(total_questions, 10) || 5;

  if (totalQuestions < 5 || totalQuestions > 10) {
    return res.status(400).json({ error: 'Total questions must be between 5 and 10' });
  }

  try {
    // Check daily session limit (max 50 per user per day)
    const today = new Date().toISOString().split('T')[0];
    const { count, error: countError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`);

    if (countError) throw countError;

    if (count >= 50) {
      return res.status(429).json({
        error: 'Daily limit reached (50 sessions/day). Come back tomorrow!',
      });
    }

    // Create session in DB
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        role,
        status: 'active',
        type: sessionType,
        difficulty: diff,
        total_questions: totalQuestions
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Handle MCQ Mode
    if (sessionType === 'mcq') {
      if (role === 'Aptitude') {
        return res.json({
          session_id: session.id,
          role,
          type: 'mcq',
          difficulty: diff,
          total_questions: totalQuestions,
          questions: []
        });
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 1.0
        }
      });
      const prompt = `${buildMcqPrompt(role, diff, totalQuestions)}\nEnsure that you generate a unique and diverse set of questions. [Session ID: ${session.id}]`;

      let questions = [];
      let lastParsedQuestions = null;
      let attempts = 0;
      while (attempts < 3) {
        try {
          const response = await model.generateContent([prompt]);
          const responseText = response.response.text();
          const parsed = JSON.parse(cleanJSONResponse(responseText));
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
          console.warn(`Attempt ${attempts + 1}: MCQ generation had invalid/duplicate options. Retrying...`);
        } catch (e) {
          console.error(`Attempt ${attempts + 1} generation/parsing failed:`, e);
        }
        attempts++;
      }
      if (questions.length === 0 && lastParsedQuestions) {
        questions = lastParsedQuestions;
      }
      if (!questions || questions.length === 0) {
        throw new Error("Failed to generate valid MCQ questions from Gemini.");
      }

      // Save MCQ questions (with correct answer and explanation) in DB messages
      const messagesToInsert = questions.map((q, idx) => ({
        session_id: session.id,
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
      if (msgInsertError) throw msgInsertError;

      // Return only questions and options to the frontend (hide correct_option and explanation to prevent cheating)
      return res.json({
        session_id: session.id,
        role,
        type: 'mcq',
        difficulty: diff,
        total_questions: totalQuestions,
        questions: questions.map((q, idx) => ({
          question_number: idx + 1,
          question: q.question,
          options: q.options
        }))
      });
    }

    // Handle QA Mode
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: `${buildSystemPrompt(role, diff, totalQuestions)}\nEnsure that you ask unique and diverse questions. [Session ID: ${session.id}]`,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const chat = model.startChat({ history: [] });
    const result = await sendMessageWithRetry(chat, 'Start the interview. Ask the first question.');
    const responseText = result.response.text();
    const parsed = JSON.parse(cleanJSONResponse(responseText));

    // Save first AI message to DB
    await supabase.from('messages').insert({
      session_id: session.id,
      role: 'agent',
      content: parsed.question,
      question_number: parsed.question_number,
    });

    res.json({
      session_id: session.id,
      role,
      type: 'qa',
      difficulty: diff,
      total_questions: totalQuestions,
      question: parsed.question,
      question_number: parsed.question_number,
      feedback: null,
      answer_score: null,
    });
  } catch (err) {
    console.error('Start error:', err);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// ─── POST /api/interview/answer ───────────────────────────────────────────────
// Accepts user answer for QA mode, returns next question or final result
router.post('/answer', authenticate, sanitizeInput, async (req, res) => {
  const { session_id, answer, is_voice } = req.body;
  const userId = req.user.id;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    // Verify session belongs to this user and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    const totalQuestions = session.total_questions || 5;
    const diff = session.difficulty || 'medium';

    // Fetch full conversation history for this session
    let { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    // Clean up any trailing unanswered user messages from previous failed attempts
    while (history && history.length > 0 && history[history.length - 1].role === 'user') {
      console.log('Cleaning up trailing unanswered user message from previous failed attempt...');
      const trailingUserMsg = history[history.length - 1];
      
      // Delete from DB
      await supabase
        .from('messages')
        .delete()
        .eq('id', trailingUserMsg.id);
        
      // Remove from local history array
      history.pop();
    }

    // Count how many questions have been asked by the agent so far
    const questionCount = history ? history.filter((msg) => msg.role === 'agent').length : 0;

    // Build Gemini chat history from DB messages, ensuring strict alternation
    const chatHistory = [
      { role: 'user', parts: [{ text: 'Start the interview. Ask the first question.' }] }
    ];

    if (history && history.length > 0) {
      let lastRole = 'user'; // Start the interview was user
      for (const msg of history) {
        const currentRole = msg.role === 'agent' ? 'model' : 'user';
        if (currentRole === lastRole) {
          // Merge consecutive message content
          const lastMsg = chatHistory[chatHistory.length - 1];
          lastMsg.parts[0].text += '\n' + msg.content;
        } else {
          chatHistory.push({
            role: currentRole,
            parts: [{ text: msg.content }]
          });
          lastRole = currentRole;
        }
      }
    }

    // Save user's answer to DB
    await supabase.from('messages').insert({
      session_id,
      role: 'user',
      content: answer,
      is_voice: is_voice || false,
    });

    // Send to Gemini with full history
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: `${buildSystemPrompt(session.role, diff, totalQuestions)}\nEnsure that you ask unique and diverse questions. [Session ID: ${session.id}]`,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const chat = model.startChat({ history: chatHistory });

    let prompt = answer;
    if (questionCount >= totalQuestions) {
      prompt = `
Candidate's answer to the final question: "${answer}"

The interview is now complete. Evaluate this final answer, and return the final results JSON matching this schema:
{
  "interview_complete": true,
  "overall_score": <number 1-10>,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "summary": "2-3 sentence overall assessment of the candidate"
}
Output ONLY valid JSON.
      `.trim();
    }

    const result = await sendMessageWithRetry(chat, prompt);
    const responseText = result.response.text();
    console.log("Raw Gemini Response:", responseText);
    const parsed = JSON.parse(cleanJSONResponse(responseText));

    // ── Interview complete ──
    if (parsed.interview_complete || questionCount >= totalQuestions) {
      const prevScores = history ? history.map(h => h.answer_score).filter(s => s !== null && s !== undefined) : [];
      const currentScore = parsed.answer_score || parsed.overall_score || 8;
      const allScores = [...prevScores, currentScore];
      const avgScore = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 8;

      const overallScore = parsed.overall_score || avgScore;
      const strengths = parsed.strengths || ["Technical knowledge", "Good communication"];
      const weaknesses = parsed.weaknesses || ["Scope for deeper understanding"];
      const summary = parsed.summary || parsed.feedback || "Interview completed successfully.";

      // Save final summary to session
      await supabase
        .from('sessions')
        .update({
          status: 'completed',
          overall_score: overallScore,
          strengths: strengths,
          weaknesses: weaknesses,
          summary: summary,
          completed_at: new Date().toISOString(),
        })
        .eq('id', session_id);

      // Save final feedback message
      await supabase.from('messages').insert({
        session_id,
        role: 'agent',
        content: "Interview completed.",
        feedback: parsed.feedback || "Final evaluation completed.",
        answer_score: currentScore,
        question_number: totalQuestions,
      });

      return res.json({
        interview_complete: true,
        overall_score: overallScore,
        strengths: strengths,
        weaknesses: weaknesses,
        summary: summary,
        feedback: parsed.feedback || null,
        answer_score: currentScore,
      });
    }

    // ── Next question ──
    await supabase.from('messages').insert({
      session_id,
      role: 'agent',
      content: parsed.question,
      feedback: parsed.feedback,
      answer_score: parsed.answer_score,
      question_number: parsed.question_number,
    });

    res.json({
      question: parsed.question,
      feedback: parsed.feedback,
      answer_score: parsed.answer_score,
      question_number: parsed.question_number,
    });
  } catch (err) {
    console.error('Answer error:', err);

    if (err.status === 429) {
      return res.status(429).json({
        error: 'AI is busy right now. Please wait a moment and try again.',
      });
    }

    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// ─── POST /api/interview/submit-mcq ──────────────────────────────────────────
// Grades MCQ answers, updates session status to completed, and generates stats
router.post('/submit-mcq', authenticate, async (req, res) => {
  const { session_id, answers } = req.body; // answers is an array of selected option indexes [0, 2, 1...]
  const userId = req.user.id;

  if (!session_id || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'session_id and answers array are required' });
  }

  try {
    // 1. Verify session belongs to user and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    // 2. Fetch original MCQ questions saved in messages
    const { data: dbMessages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session_id)
      .eq('role', 'agent')
      .order('question_number', { ascending: true });

    if (msgError || !dbMessages || dbMessages.length === 0) {
      return res.status(400).json({ error: 'No questions found for this session' });
    }

    const gradedQuestions = [];
    let correctCount = 0;

    // 3. Grade each answer
    for (let i = 0; i < dbMessages.length; i++) {
      const qMsg = dbMessages[i];
      let parsedQ;
      try {
        parsedQ = JSON.parse(qMsg.content);
      } catch (e) {
        console.error('Failed to parse question content:', qMsg.content, e);
      }
      
      if (!parsedQ || !Array.isArray(parsedQ.options)) {
        parsedQ = {
          question: parsedQ?.question || qMsg.content || 'Aptitude Question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_option: (parsedQ?.correct_option !== undefined && parsedQ?.correct_option >= 0 && parsedQ?.correct_option < 4) ? parsedQ.correct_option : 0,
          explanation: parsedQ?.explanation || 'Could not parse step-by-step explanation'
        };
      }

      const userAnswerIndex = answers[i] !== undefined ? answers[i] : -1;
      const isCorrect = userAnswerIndex === parsedQ.correct_option;

      if (isCorrect) correctCount++;

      gradedQuestions.push({
        question_number: qMsg.question_number,
        question: parsedQ.question,
        options: parsedQ.options,
        correct_option: parsedQ.correct_option,
        user_option: userAnswerIndex,
        is_correct: isCorrect,
        explanation: parsedQ.explanation
      });

      // Save user answer in DB
      await supabase.from('messages').insert({
        session_id,
        role: 'user',
        content: userAnswerIndex >= 0 && parsedQ.options[userAnswerIndex] ? parsedQ.options[userAnswerIndex] : 'No Answer',
        question_number: qMsg.question_number,
      });

      // Update agent message with score and feedback
      await supabase
        .from('messages')
        .update({
          answer_score: isCorrect ? 10 : 1,
          feedback: `Correct answer: ${parsedQ.options[parsedQ.correct_option]}. Explanation: ${parsedQ.explanation}`,
        })
        .eq('id', qMsg.id);
    }

    const totalQuestions = dbMessages.length;
    const rawScore = (correctCount / totalQuestions) * 10;
    const overallScore = Math.round(rawScore);

    // 4. Call Gemini to generate qualitative feedback based on MCQ score & results
    let feedbackJSON = {
      strengths: ["Completed MCQ test"],
      weaknesses: ["Areas of incorrect answers need review"],
      summary: `You scored ${correctCount}/${totalQuestions} on the MCQ evaluation.`
    };

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });
      const prompt = `
You are a technical interviewer reviewing a candidate's multiple-choice exam for a ${session.role} position.
They scored ${correctCount} correct out of ${totalQuestions} questions.
Here are the questions they answered, whether they got them correct, and the explanations:
${JSON.stringify(gradedQuestions.map(q => ({ question: q.question, is_correct: q.is_correct, explanation: q.explanation })), null, 2)}

Provide a professional feedback report based on their strengths and weaknesses shown by these answers.
Identify 2-3 specific strengths.
Identify 2-3 specific areas of improvement (weaknesses).
Write a 2-3 sentence overall summary assessment.

You MUST respond ONLY with a valid JSON block, using this exact schema:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "summary": "Your 2-3 sentence overall assessment."
}
Do not wrap in markdown.
`.trim();

      const response = await model.generateContent([prompt]);
      feedbackJSON = JSON.parse(cleanJSONResponse(response.response.text()));
    } catch (e) {
      console.error('Failed to generate qualitative AI feedback for MCQ:', e);
    }

    // 5. Update session in Supabase
    await supabase
      .from('sessions')
      .update({
        status: 'completed',
        overall_score: overallScore,
        strengths: feedbackJSON.strengths,
        weaknesses: feedbackJSON.weaknesses,
        summary: feedbackJSON.summary,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    res.json({
      interview_complete: true,
      overall_score: overallScore,
      strengths: feedbackJSON.strengths,
      weaknesses: feedbackJSON.weaknesses,
      summary: feedbackJSON.summary,
      graded_questions: gradedQuestions
    });
  } catch (err) {
    console.error('Submit MCQ error:', err);
    res.status(500).json({ error: 'Failed to submit MCQ answers' });
  }
});

// ─── GET /api/interview/sessions ─────────────────────────────────────────────
// Returns all past sessions for the logged-in user
router.get('/sessions', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, role, status, overall_score, summary, created_at, completed_at, type, difficulty, total_questions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ sessions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ─── GET /api/interview/sessions/:id ─────────────────────────────────────────
// Returns full transcript of one session
router.get('/sessions/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
