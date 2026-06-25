import express from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import supabase from '../config/supabase.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Setup Multer (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper to clean and parse JSON response
const cleanJSONResponse = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
      console.error('JSON parsing error on cleaned text:', e);
    }
  }
  throw new Error('No valid JSON block found in the model response');
};

// ─── POST /api/resume/rate ───────────────────────────────────────────────────
// Accepts PDF/TXT resume and evaluates it
router.post('/rate', authenticate, upload.single('resume'), async (req, res) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a PDF or TXT file.' });
  }

  try {
    let extractedText = '';

    if (req.file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: req.file.buffer });
      const data = await parser.getText();
      await parser.destroy();
      extractedText = data.text;
    } else if (req.file.mimetype === 'text/plain') {
      extractedText = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Invalid file type. Only PDF and TXT files are supported.' });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from the uploaded file.' });
    }

    // Call Gemini to evaluate the resume text
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const systemPrompt = `
You are an expert technical recruiter and resume reviewer.
Evaluate the following resume text and provide a professional feedback report.
Provide a numeric score out of 100 based on standard industry criteria (formatting, clarity, skills, experience depth, metrics impact).
Identify 3-5 specific strengths.
Identify 3-5 specific areas of improvement (weaknesses).
Write a 2-3 sentence overall summary recommendation.

You MUST respond ONLY with a valid JSON block, using this exact schema:
{
  "score": <number between 0 and 100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "summary": "Your 2-3 sentence overall assessment."
}
No explanation, no markdown formatting like \`\`\`json, no trailing text.
`.trim();

    const response = await model.generateContent([
      systemPrompt,
      `RESUME CONTENT:\n${extractedText.substring(0, 15000)}` // Safeguard token length
    ]);

    const responseText = response.response.text();
    const result = cleanJSONResponse(responseText);

    // Upload file to Supabase Storage
    const fileExtension = req.file.originalname.split('.').pop();
    const storagePath = `${userId}/${Date.now()}_${req.file.originalname}`;
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
    }

    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('resumes')
      .getPublicUrl(storagePath);

    // Save evaluation to Supabase
    const { data: dbRecord, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        file_name: req.file.originalname,
        score: result.score,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        summary: result.summary,
        file_url: publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      // If table doesn't exist yet, we still return the evaluation results to the user
      console.error('Supabase save error:', dbError);
      return res.json({
        file_name: req.file.originalname,
        score: result.score,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        summary: result.summary,
        warning: 'Could not save history to the database. (Make sure you applied the SQL schema updates!)'
      });
    }

    res.json(dbRecord);
  } catch (err) {
    console.error('Resume rating error:', err);
    res.status(500).json({ error: err.message || 'Failed to rate resume' });
  }
});

// ─── GET /api/resume/history ─────────────────────────────────────────────────
// Retrieves past resume ratings for the authenticated user
router.get('/history', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Return empty array if table doesn't exist, to prevent crashing dashboard
      if (error.code === 'PGRST205') {
        return res.json({ history: [] });
      }
      throw error;
    }

    res.json({ history: data });
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ error: 'Failed to fetch resume evaluation history' });
  }
});

export default router;
