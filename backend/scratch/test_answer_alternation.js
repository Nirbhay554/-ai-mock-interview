import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qmxmzxogosnfwpuwsmhl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteG16eG9nb3NuZndwdXdzbWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzMDQ2OCwiZXhwIjoyMDk3ODA2NDY4fQ.-Ut1i3BGOSfJc8WM0ZPofB1o21eGwacJKvLHE6vLBIg';
const API_URL = 'http://localhost:3001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  console.log('Starting Q&A Answer Role Alternation Integration Test...');

  // 1. Sign up/in a test user to get JWT token
  const email = `testuser${Date.now()}@gmail.com`;
  const password = 'Password123!';
  
  console.log(`Creating user via admin API: ${email}...`);
  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    console.error('Sign up error:', authError);
    return;
  }

  console.log('Signing in user...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in error:', signInError);
    return;
  }

  const token = signInData.session.access_token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Start Interview Session (Frontend role, QA type)
  console.log('1. Starting QA Interview session...');
  const startRes = await fetch(`${API_URL}/api/interview/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      role: 'Frontend',
      type: 'qa',
      difficulty: 'medium',
      total_questions: 5
    })
  });

  const startData = await startRes.json();
  console.log('Start interview response:', startData);
  if (!startRes.ok) {
    console.error('Failed to start interview:', startData);
    return;
  }

  const sessionId = startData.session_id;

  // Verify that there is exactly 1 agent message in DB (the first question)
  const { data: dbMsgs1, error: dbErr1 } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId);
  
  console.log(`Initial message count in DB: ${dbMsgs1.length}`);
  if (dbMsgs1.length !== 1) {
    console.error(`Error: Expected exactly 1 message, got ${dbMsgs1.length}`);
    return;
  }

  // 3. Manually insert a user message (simulating a successful answer save, but failed API call)
  console.log('2. Simulating a failed answer attempt (inserting user message without agent response)...');
  const { data: userMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role: 'user',
      content: 'HTML stands for HyperText Markup Language',
    })
    .select()
    .single();

  if (insertErr) {
    console.error('Failed to insert simulated user message:', insertErr);
    return;
  }

  // Verify message count is now 2 (agent, user)
  const { data: dbMsgs2 } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId);
  
  console.log(`Message count in DB after simulated failure: ${dbMsgs2.length}`);

  // 4. Send a new answer (simulating user retry).
  // If the self-healing logic works:
  // - It will see the trailing user message 'HTML stands for...'
  // - It will delete it from the database.
  // - It will insert the new answer: 'HyperText Markup Language'
  // - It will call Gemini and get the next question.
  // - The count in the DB will end up being: 1 (original agent question) + 1 (new user answer) + 1 (new agent question) = 3 messages.
  console.log('3. Sending new user answer retry to /answer endpoint...');
  const answerRes = await fetch(`${API_URL}/api/interview/answer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      answer: 'HyperText Markup Language',
      is_voice: false
    })
  });

  const answerData = await answerRes.json();
  console.log('Answer endpoint response:', answerData);
  if (!answerRes.ok) {
    console.error('Failed to process answer:', answerData);
    return;
  }

  console.log(`Next question received: "${answerData.question}"`);

  // Verify DB messages count is exactly 3 (no trailing consecutive user messages)
  const { data: dbMsgs3 } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  console.log(`Final message count in DB: ${dbMsgs3.length}`);
  dbMsgs3.forEach((m, idx) => {
    console.log(`  [${idx}] Role: ${m.role}, Content: "${m.content.substring(0, 50)}"`);
  });

  if (dbMsgs3.length !== 3) {
    console.error(`Error: Expected exactly 3 messages in DB, got ${dbMsgs3.length}`);
    return;
  }

  if (dbMsgs3[1].content !== 'HyperText Markup Language') {
    console.error(`Error: Expected user message to be updated to 'HyperText Markup Language', got '${dbMsgs3[1].content}'`);
    return;
  }

  console.log('Q&A Alternation & Self-Healing tests passed successfully!');
}

runTest().catch(console.error);
