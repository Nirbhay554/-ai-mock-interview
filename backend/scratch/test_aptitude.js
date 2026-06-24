import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qmxmzxogosnfwpuwsmhl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteG16eG9nb3NuZndwdXdzbWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzMDQ2OCwiZXhwIjoyMDk3ODA2NDY4fQ.-Ut1i3BGOSfJc8WM0ZPofB1o21eGwacJKvLHE6vLBIg';
const API_URL = 'http://localhost:3001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  console.log('Starting Aptitude API Integration Test...');

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
  console.log('User signed up successfully. Token obtained.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Start Interview Session
  console.log('1. Starting Aptitude MCQ session...');
  const startRes = await fetch(`${API_URL}/api/interview/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      role: 'Aptitude',
      type: 'mcq',
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

  // Verify that start interview returned 0 questions for Aptitude role
  console.log(`Returned question count: ${startData.questions?.length}`);
  if (startData.questions && startData.questions.length > 0) {
    console.error('Error: Start interview should not generate questions for Aptitude role!');
    return;
  }

  // Check database messages count for this session (should be 0)
  const { data: dbMsgsBefore, error: dbErrBefore } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId);
  
  console.log(`DB Messages before generate: ${dbMsgsBefore.length}`);
  if (dbMsgsBefore.length > 0) {
    console.error('Error: There should be 0 messages in DB before generating!');
    return;
  }

  // 3. Generate questions
  console.log('2. Generating aptitude questions...');
  const genRes = await fetch(`${API_URL}/api/aptitude/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic: 'Logical Reasoning',
      total_questions: 5,
      session_id: sessionId
    })
  });

  const genData = await genRes.json();
  console.log(`Generate questions response. Topic: ${genData.topic}, count: ${genData.questions?.length}`);
  if (!genRes.ok) {
    console.error('Failed to generate questions:', genData);
    return;
  }

  // Check database messages count for this session (should be exactly 5)
  const { data: dbMsgsAfter, error: dbErrAfter } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId);
  
  console.log(`DB Messages after generate: ${dbMsgsAfter.length}`);
  if (dbMsgsAfter.length !== 5) {
    console.error(`Error: Expected exactly 5 messages in DB, found ${dbMsgsAfter.length}`);
    return;
  }

  // 4. Submit Answers
  console.log('3. Submitting answers...');
  // Let's answer [0, 1, 2, 3, 0]
  const submitRes = await fetch(`${API_URL}/api/interview/submit-mcq`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      answers: [0, 1, 2, 3, 0]
    })
  });

  const submitData = await submitRes.json();
  console.log('Submit MCQ response:', submitData);
  if (!submitRes.ok) {
    console.error('Failed to submit MCQ answers:', submitData);
    return;
  }

  console.log(`Graded questions returned: ${submitData.graded_questions?.length}`);
  console.log(`Overall score returned: ${submitData.overall_score}/10`);

  if (submitData.graded_questions?.length !== 5) {
    console.error(`Error: Expected 5 graded questions, got ${submitData.graded_questions?.length}`);
    return;
  }

  console.log('All tests passed successfully!');
}

runTest().catch(console.error);
