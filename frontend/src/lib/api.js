import supabase from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Attach Supabase JWT to every request automatically
const authFetch = async (path, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = {
    Authorization: `Bearer ${session?.access_token}`,
    ...options.headers,
  };

  // Only set Content-Type to JSON if it's not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// Start interview (with new type, difficulty, total_questions settings)
export const startInterview = (role, type = 'qa', difficulty = 'medium', totalQuestions = 5) =>
  authFetch('/api/interview/start', {
    method: 'POST',
    body: JSON.stringify({ role, type, difficulty, total_questions: totalQuestions }),
  });

// Submit QA text/voice answer
export const submitAnswer = (session_id, answer, is_voice = false) =>
  authFetch('/api/interview/answer', {
    method: 'POST',
    body: JSON.stringify({ session_id, answer, is_voice }),
  });

// Transcribe voice recording audio blob using backend Gemini transcription
export const transcribeAudio = (audioBlob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  return authFetch('/api/interview/transcribe', {
    method: 'POST',
    body: formData,
  });
};

// Submit MCQ answers
export const submitMcqAnswers = (session_id, answers) =>
  authFetch('/api/interview/submit-mcq', {
    method: 'POST',
    body: JSON.stringify({ session_id, answers }),
  });

// Generate aptitude test questions
export const generateAptitude = (topic, totalQuestions = 5, sessionId = null) =>
  authFetch('/api/aptitude/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, total_questions: totalQuestions, session_id: sessionId }),
  });

// Upload and rate resume
export const rateResume = (file) => {
  const formData = new FormData();
  formData.append('resume', file);

  return authFetch('/api/resume/rate', {
    method: 'POST',
    body: formData,
  });
};

// Retrieve resume evaluation history
export const getResumeHistory = () => authFetch('/api/resume/history');

export const getSessions = () => authFetch('/api/interview/sessions');

export const getSession = (id) => authFetch(`/api/interview/sessions/${id}`);
