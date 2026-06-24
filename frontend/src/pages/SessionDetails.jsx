import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../lib/api';
import supabase from '../lib/supabase';

// Mascot definitions removed

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        const data = await getSession(id);
        setSession(data.session);
        setMessages(data.messages || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load session details');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [id]);

  const getScoreColor = (score) => {
    if (!score) return 'hsl(var(--text-muted))';
    if (score >= 8) return 'hsl(var(--success))';
    if (score >= 5) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={{ width: 36, height: 36, border: '4px solid #000', borderTop: '4px solid hsl(var(--primary))', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: 16, color: 'hsl(var(--text-muted))' }}>Loading session details...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={styles.center}>
        <h2 style={{ color: 'hsl(var(--danger))', marginBottom: 12 }}>Error</h2>
        <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 24 }}>{error || 'Session not found'}</p>
        <button onClick={() => navigate('/dashboard')} className="cartoon-button cartoon-button-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isMcq = session.type === 'mcq';

  // Construct MCQ data representation if it is an MCQ session
  const mcqTimeline = [];
  if (isMcq) {
    // Filter agents
    const agentMsgs = messages.filter(m => m.role === 'agent' && m.content !== 'Interview completed.');
    // Filter users
    const userMsgs = messages.filter(m => m.role === 'user');

    agentMsgs.forEach((qMsg, idx) => {
      try {
        const parsedQ = JSON.parse(qMsg.content); // { question, options, correct_option, explanation }
        const uMsg = userMsgs[idx];
        
        let userOptionIndex = -1;
        if (uMsg) {
          userOptionIndex = parsedQ.options.indexOf(uMsg.content);
        }

        mcqTimeline.push({
          question_number: qMsg.question_number,
          question: parsedQ.question,
          options: parsedQ.options,
          correct_option: parsedQ.correct_option,
          user_option: userOptionIndex,
          is_correct: qMsg.answer_score >= 8,
          explanation: parsedQ.explanation
        });
      } catch (e) {
        console.error('Failed to parse MCQ content:', e);
      }
    });
  }

  // Construct standard timeline for QA
  const qaTimeline = [];
  if (!isMcq) {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'agent') {
        if (msg.content === 'Interview completed.') continue;
        qaTimeline.push({
          id: msg.id,
          type: 'question',
          content: msg.content,
          question_number: msg.question_number,
        });
      } else if (msg.role === 'user') {
        // Find feedback from the next agent message
        const nextMsg = messages[i + 1];
        const feedback = nextMsg && nextMsg.role === 'agent' ? nextMsg.feedback : null;
        const score = nextMsg && nextMsg.role === 'agent' ? nextMsg.answer_score : null;
        
        qaTimeline.push({
          id: msg.id,
          type: 'answer',
          content: msg.content,
          isVoice: msg.is_voice,
          feedback,
          score,
        });
      }
    }
  }

  return (
    <div style={styles.page}>
      {/* Top Header */}
      <div style={{ ...styles.header, borderBottom: '3px solid #000', background: 'hsl(var(--bg-card))' }}>
        <button onClick={() => navigate('/dashboard')} className="cartoon-button" style={{ padding: '6px 14px', fontSize: 13, background: 'hsl(var(--primary))', color: '#fff' }}>
          ← Dashboard
        </button>
        <div style={styles.userInfo}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="avatar" style={{ ...styles.avatar, border: '2px solid #000' }} />
          ) : (
            <div style={{ ...styles.avatarPlaceholder, border: '2px solid #000' }}>
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={styles.userName}>{user?.user_metadata?.full_name || user?.email}</span>
        </div>
      </div>

      <div style={styles.container}>
        {/* Session Meta Card */}
        <div className="cartoon-card" style={{ padding: '24px 32px', background: 'hsl(var(--bg-card))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: 32, border: '3px solid #000', boxShadow: '6px 6px 0px #000' }}>
          <div style={{ flex: '1 1 450px', textAlign: 'left' }}>
            <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000', marginBottom: 12 }}>
              {session.role} Track
            </span>
            <div style={{ display: 'flex', gap: 8, margin: '4px 0 10px 0' }}>
              {session.type && (
                <span style={{ fontSize: 11, background: '#000', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>
                  {session.type} Mode
                </span>
              )}
              {session.difficulty && (
                <span style={{ fontSize: 11, background: '#000', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 'bold', color: session.difficulty === 'easy' ? 'hsl(var(--warning))' : '#fff' }}>
                  {session.difficulty} level
                </span>
              )}
            </div>
            <h1 style={{ ...styles.title, fontSize: 26, margin: '8px 0' }}>Evaluation Report</h1>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 12 }}>
              Completed on {new Date(session.completed_at || session.created_at).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
            {session.summary && <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#000000' }}>{session.summary}</p>}
          </div>

          {session.overall_score !== null && session.overall_score !== undefined && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ ...styles.scoreCircle, width: 110, height: 110, border: '4px solid #000', background: getScoreColor(session.overall_score), boxShadow: '4px 4px 0px #000' }}>
                <span style={{ fontSize: 36, fontWeight: '800', color: '#000' }}>
                  {isMcq ? mcqTimeline.filter(item => item.is_correct).length : session.overall_score}
                </span>
                <span style={{ fontSize: 16, color: '#000', alignSelf: 'flex-end', marginBottom: 6 }}>
                  /{isMcq ? (session.total_questions || 5) : 10}
                </span>
              </div>
              <span style={{ color: getScoreColor(session.overall_score), fontWeight: '700', fontSize: 13, textTransform: 'uppercase' }}>
                Overall Score
              </span>
            </div>
          )}
        </div>

        {/* Strengths & Weaknesses */}
        {session.status === 'completed' && (
          <div style={styles.analysisGrid}>
            <div className="cartoon-card" style={{ padding: 20, border: '3px solid #000', background: 'rgba(34, 197, 94, 0.08)', boxShadow: '4px 4px 0 #000' }}>
              <h3 style={{ color: 'hsl(var(--success))', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                ⭐ Key Strengths
              </h3>
              <ul style={styles.list}>
                {session.strengths?.map((s, idx) => (
                  <li key={idx} style={styles.listItem}>⭐ {s}</li>
                )) || <p style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No strengths highlighted.</p>}
              </ul>
            </div>

            <div className="cartoon-card" style={{ padding: 20, border: '3px solid #000', background: 'rgba(239, 68, 68, 0.08)', boxShadow: '4px 4px 0 #000' }}>
              <h3 style={{ color: 'hsl(var(--danger))', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                ⚠️ Areas to Improve
              </h3>
              <ul style={styles.list}>
                {session.weaknesses?.map((w, idx) => (
                  <li key={idx} style={styles.listItem}>🎯 {w}</li>
                )) || <p style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No improvement areas highlighted.</p>}
              </ul>
            </div>
          </div>
        )}

        {/* Review Section */}
        <h2 style={{ ...styles.sectionTitle, marginTop: 40, marginBottom: 20 }}>📝 Question-by-Question Review</h2>
        
        {/* Render MCQ Review */}
        {isMcq ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mcqTimeline.map((q, idx) => (
              <div key={idx} className="cartoon-card" style={{ padding: 20, background: 'hsl(var(--bg-card))', border: '3px solid #000', boxShadow: '4px 4px 0px #000', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontWeight: '700', color: 'hsl(var(--secondary))', fontSize: 15 }}>Q{q.question_number}. {q.question}</span>
                  <span className="cartoon-badge" style={{ background: q.is_correct ? 'hsl(var(--success))' : 'hsl(var(--danger))', alignSelf: 'flex-start', flexShrink: 0 }}>
                    {q.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
                  {q.options.map((opt, optIdx) => {
                    let btnStyle = { border: '1.5px solid #000', padding: 10, borderRadius: 8, fontSize: 13, background: 'hsl(var(--bg-card-light))' };
                    if (optIdx === q.correct_option) {
                      btnStyle.background = 'rgba(34, 197, 94, 0.2)';
                      btnStyle.border = '2px solid hsl(var(--success))';
                    } else if (optIdx === q.user_option && !q.is_correct) {
                      btnStyle.background = 'rgba(239, 68, 68, 0.2)';
                      btnStyle.border = '2px solid hsl(var(--danger))';
                    }
                    return (
                      <div key={optIdx} style={btnStyle}>
                        {String.fromCharCode(65 + optIdx)}. {opt}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                  💡 <strong>Explanation:</strong> {q.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          /* Render QA Review */
          <div style={styles.timeline}>
            {qaTimeline.map((item, index) => {
              if (item.type === 'question') {
                return (
                  <div key={item.id} className="cartoon-card" style={{ padding: 16, background: 'hsl(var(--bg-card))', border: '3.5px solid #000', boxShadow: '3px 3px 0 #000', borderLeft: '8px solid hsl(var(--primary))' }}>
                    <div style={styles.questionHeader}>
                      <span className="cartoon-badge" style={{ background: 'hsl(var(--primary))', color: '#fff', fontSize: 10 }}>Q{item.question_number}</span>
                      <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 'bold' }}>AI Interviewer</span>
                    </div>
                    <p style={{ ...styles.qText, margin: 0 }}>{item.content}</p>
                  </div>
                );
              } else {
                return (
                  <div key={item.id} className="cartoon-card" style={{ padding: 16, background: 'hsl(var(--bg-card-light))', border: '3.5px solid #000', boxShadow: '3px 3px 0 #000', borderLeft: '8px solid #a1a1aa', marginLeft: 24 }}>
                    <div style={styles.answerHeader}>
                      <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 'bold' }}>Your Response</span>
                      {item.isVoice && <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000', fontSize: 9 }}>🎤 Voice</span>}
                    </div>
                    <p style={{ ...styles.aText, margin: '0 0 16px 0' }}>"{item.content}"</p>

                    {/* Feedback Box */}
                    {(item.feedback || item.score !== null) && (
                      <div className="cartoon-card" style={{ padding: 12, background: 'hsl(var(--bg-card))', border: '1.5px solid #000', boxShadow: '2px 2px 0 #000' }}>
                        <div style={styles.feedbackHead}>
                          <h4 style={{ color: 'hsl(var(--secondary))', fontSize: 13, fontWeight: '700' }}>AI Evaluation</h4>
                          {item.score !== null && (
                            <span className="cartoon-badge" style={{ background: getScoreColor(item.score), color: '#000', fontSize: 10 }}>
                              Score: {item.score}/10
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: '1.5', margin: 0 }}>{item.feedback || 'No feedback recorded.'}</p>
                      </div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'hsl(var(--bg-deep))', color: '#000000' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'hsl(var(--bg-deep))', color: '#000000' },
  container: { maxWidth: 900, margin: '0 auto', padding: '30px 20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', height: 72 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%' },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'hsl(var(--bg-card-light))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000'
  },
  userName: { fontSize: 13.5, color: 'hsl(var(--text-muted))', fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800', color: '#000000', fontFamily: 'var(--font-display)' },
  scoreCircle: { borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  analysisGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 },
  list: { listStyleType: 'none', paddingLeft: 0, margin: 0 },
  listItem: { padding: '6px 0', fontSize: 13.5, color: 'hsl(var(--text-muted))', lineHeight: '1.5' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#000000', fontFamily: 'var(--font-display)' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 20 },
  questionHeader: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  qText: { fontSize: 14, color: '#000000', lineHeight: '1.5', fontWeight: '600' },
  answerHeader: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  aText: { fontSize: 14, color: '#334155', fontStyle: 'italic', lineHeight: '1.5' },
  feedbackHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }
};
