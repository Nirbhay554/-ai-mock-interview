import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qmxmzxogosnfwpuwsmhl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteG16eG9nb3NuZndwdXdzbWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzMDQ2OCwiZXhwIjoyMDk3ODA2NDY4fQ.-Ut1i3BGOSfJc8WM0ZPofB1o21eGwacJKvLHE6vLBIg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  console.log('Inspecting Supabase database sessions and messages...');

  // Fetch the latest session
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (sErr) {
    console.error('Error fetching sessions:', sErr);
    return;
  }

  console.log('Latest Sessions:');
  for (const s of sessions) {
    console.log(`\nSession ID: ${s.id}`);
    console.log(`Role: ${s.role}, Type: ${s.type}, Status: ${s.status}, Created: ${s.created_at}`);

    // Fetch messages for this session
    const { data: msgs, error: mErr } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', s.id)
      .order('created_at', { ascending: true });

    if (mErr) {
      console.error(`Error fetching messages for session ${s.id}:`, mErr);
      continue;
    }

    console.log(`Messages (${msgs.length}):`);
    msgs.forEach((m, idx) => {
      console.log(`  [${idx}] Role: ${m.role}, Number: ${m.question_number}, Content: ${m.content.substring(0, 150)}`);
      if (m.feedback) console.log(`      Feedback: ${m.feedback.substring(0, 100)}`);
    });
  }
}

inspect().catch(console.error);
