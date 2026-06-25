import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startInterview, generateAptitude, submitMcqAnswers } from '../lib/api';
import InterviewLogo from '../components/InterviewLogo';
import CosmicParallaxBg from '../components/CosmicParallaxBg';

const TOPICS = [
  { name: 'Quantitative', icon: '🔢', desc: 'Averages, percentages, ratios, probability, interest, and arithmetic.' },
  { name: 'Logical Reasoning', icon: '🧩', desc: 'Sequences, patterns, syllogisms, blood relations, and puzzles.' },
  { name: 'Verbal Ability', icon: '📚', desc: 'Grammar, synonyms/antonyms, comprehension, and vocabulary.' },
];

// CuteRobot component removed

export default function Aptitude() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('select'); // select | test | result
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState(5);
  const [sessionId, setSessionId] = useState(null);
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // {question_number: option_index}
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleStart = async () => {
    if (!selectedTopic) return;
    setIsLoading(true);
    setError('');
    try {
      // 1. Create Supabase session for history tracking
      const sessionData = await startInterview('Aptitude', 'mcq', 'medium', selectedQuestions);
      setSessionId(sessionData.session_id);

      // 2. Generate questions from Gemini
      const data = await generateAptitude(selectedTopic, selectedQuestions, sessionData.session_id);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setStage('test');
    } catch (err) {
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const finalAnswers = questions.map((q, idx) => {
      const val = answers[idx + 1];
      return val !== undefined ? val : -1;
    });

    setIsLoading(true);
    setError('');
    try {
      const data = await submitMcqAnswers(sessionId, finalAnswers);
      setResult(data);
      setStage('result');
    } catch (err) {
      setError(err.message || 'Failed to submit answers.');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 8) return 'hsl(var(--success))';
    if (score >= 5) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  // ─── RENDER: Selection Screen ──────────────────────────────────────────────
  if (stage === 'select') {
    return (
      <div style={styles.center}>
        <CosmicParallaxBg starsOnly={true} />
        <div style={styles.selectContainer}>
          <div style={{ marginBottom: 16 }}>
            <InterviewLogo text="INTERVIEW" size="large" />
          </div>

          <div style={styles.bubbleContainer}>
            <div className="speech-bubble" style={{ maxWidth: 450, margin: '0 auto 24px auto', fontSize: 15, fontWeight: '600' }}>
              Aptitude Time! 🧩 Let's test your logical, quantitative, and verbal reasoning!
            </div>
          </div>

          <h1 style={styles.title}>Aptitude Practice Hub</h1>
          <p style={styles.subtitle}>Select a topic, pick your length, and jump into local practice.</p>

          <div className="cartoon-card" style={{ padding: '24px 32px', background: 'hsl(var(--bg-card))', textAlign: 'left', marginBottom: 32 }}>
            <label style={styles.fieldLabel}>1. Select Aptitude Topic</label>
            <div style={styles.roleGrid}>
              {TOPICS.map((topic) => (
                <div
                  key={topic.name}
                  onClick={() => setSelectedTopic(topic.name)}
                  style={{
                    ...styles.roleCard,
                    border: selectedTopic === topic.name ? '3px solid hsl(var(--accent))' : '2px solid #000',
                    background: selectedTopic === topic.name ? 'rgba(244, 63, 94, 0.15)' : 'hsl(var(--bg-card-light))',
                    boxShadow: selectedTopic === topic.name ? '4px 4px 0px hsl(var(--accent))' : '2px 2px 0px #000'
                  }}
                >
                  <div style={styles.cardHeader}>
                    <span style={styles.roleIcon}>{topic.icon}</span>
                    <span style={{ ...styles.roleTitle, color: selectedTopic === topic.name ? 'hsl(var(--accent))' : '#000000' }}>{topic.name}</span>
                  </div>
                  <p style={styles.roleDesc}>{topic.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={styles.fieldLabel}>2. Number of Questions ({selectedQuestions})</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[5, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedQuestions(num)}
                    className="cartoon-button"
                    style={{
                      padding: '8px 16px',
                      flex: 1,
                      minWidth: 50,
                      background: selectedQuestions === num ? 'hsl(var(--secondary))' : 'hsl(var(--bg-card-light))',
                      color: '#000000'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p style={styles.error}>⚠️ {error}</p>}

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="cartoon-button cartoon-button-outline"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={handleStart}
              disabled={!selectedTopic || isLoading}
              className="cartoon-button cartoon-button-accent"
            >
              {isLoading ? 'Generating quiz...' : 'Start Test 🧠'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Results Screen ───────────────────────────────────────────────
  if (stage === 'result') {
    return (
      <div style={styles.center}>
        <CosmicParallaxBg starsOnly={true} />
        <div style={{ ...styles.resultContainer, border: '3px solid #000000', background: 'hsl(var(--bg-card))', boxShadow: '8px 8px 0px #000' }} className="cartoon-card">
          <div style={{ marginBottom: 16 }}>
            <InterviewLogo text={result.overall_score >= 6 ? "EXCELLENT" : "RESULTS"} size="large" />
          </div>

          <h2 style={{ ...styles.title, fontSize: 28 }}>Aptitude Scorecard 🏆</h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
            Score based on {questions.length} questions
          </p>

          <div style={styles.scoreRow}>
            <div style={{ ...styles.scoreCircle, width: 120, height: 120, border: '4px solid #000', background: getScoreBadgeColor(result.overall_score), boxShadow: '4px 4px 0px #000' }}>
              <span style={{ ...styles.scoreBig, color: '#000' }}>
                {result.graded_questions ? result.graded_questions.filter(q => q.is_correct).length : Math.round((result.overall_score * questions.length) / 10)}
              </span>
              <span style={{ ...styles.scoreLabel, color: '#000' }}>/{questions.length}</span>
            </div>
            <p style={{ ...styles.resultSummary, fontSize: 14.5 }}>{result.summary}</p>
          </div>

          <div style={styles.feedbackGrid}>
            <div style={{ ...styles.feedbackCardGreen, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(34, 197, 94, 0.08)' }}>
              <h3 style={{ color: 'hsl(var(--success))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>✨ Strengths Found</h3>
              <ul style={styles.resultList}>
                {result.strengths?.map((s, i) => <li key={i} style={styles.resultListItem}>⭐ {s}</li>)}
              </ul>
            </div>
            <div style={{ ...styles.feedbackCardRed, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(239, 68, 68, 0.08)' }}>
              <h3 style={{ color: 'hsl(var(--danger))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>⚠️ Areas to Review</h3>
              <ul style={styles.resultList}>
                {result.weaknesses?.map((w, i) => <li key={i} style={styles.resultListItem}>🎯 {w}</li>)}
              </ul>
            </div>
          </div>

          {/* Graded Review */}
          <div style={{ textAlign: 'left', margin: '30px 0', borderTop: '2px dashed #000', paddingTop: 20 }}>
            <h3 style={{ fontSize: 18, marginBottom: 15 }}>📝 Question-by-Question Explanations:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {result.graded_questions?.map((q, idx) => (
                <div key={idx} className="cartoon-card" style={{ padding: 16, background: 'hsl(var(--bg-card-light))', border: '2px solid #000', boxShadow: '3px 3px 0px #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: '700', color: 'hsl(var(--secondary))' }}>Q{q.question_number}. {q.question}</span>
                    <span className="cartoon-badge" style={{ background: q.is_correct ? 'hsl(var(--success))' : 'hsl(var(--danger))', alignSelf: 'flex-start', flexShrink: 0 }}>
                      {q.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {q.options.map((opt, optIdx) => {
                      let btnStyle = { border: '1px solid #000', padding: 8, borderRadius: 8, fontSize: 13, background: 'hsl(var(--bg-card))' };
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
                  <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                    💡 <strong>Step-by-step:</strong> {q.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button onClick={() => navigate('/dashboard')} className="cartoon-button cartoon-button-primary">
              Return Home
            </button>
            <button
              onClick={() => { setStage('select'); setQuestions([]); setResult(null); }}
              className="cartoon-button cartoon-button-outline"
            >
              Test Again 🔁
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Test Exam Screen ──────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  if (!currentQ) return <div style={styles.center}><CosmicParallaxBg starsOnly={true} />Loading Aptitude Test...</div>;
  const selectedOption = answers[currentIndex + 1];

  return (
    <div style={styles.chatWrapper}>
      <CosmicParallaxBg starsOnly={true} />
      {/* Header */}
      <div style={{ ...styles.chatHeader, background: 'hsl(var(--bg-card))', borderBottom: '3px solid #000' }}>
        <div style={styles.chatHeaderLeft}>
          <button onClick={() => navigate('/dashboard')} className="cartoon-button" style={{ padding: '6px 12px', fontSize: 12, background: 'hsl(var(--danger))', color: '#fff' }}>
            ✕ Quit Test
          </button>
          <span style={styles.headerRoleTitle}>🧩 Aptitude Practice — {selectedTopic}</span>
        </div>
        <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000' }}>
          Q {currentIndex + 1} of {questions.length}
        </span>
      </div>

      <div style={{ ...styles.messagesContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cartoon-card" style={{ maxWidth: 650, width: '100%', padding: 24, background: 'hsl(var(--bg-card))' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <InterviewLogo text="QUESTION" />
          </div>

          <h3 style={{ fontSize: 18, marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
            {currentQ.question}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setAnswers({ ...answers, [currentIndex + 1]: idx })}
                  className="cartoon-card"
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    border: isSelected ? '3px solid hsl(var(--secondary))' : '2px solid #000',
                    background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'hsl(var(--bg-card-light))',
                    boxShadow: isSelected ? '4px 4px 0px hsl(var(--secondary))' : '2px 2px 0px #000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '2px solid #000',
                    background: isSelected ? 'hsl(var(--secondary))' : '#fff',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: 13,
                  }}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: '500' }}>{opt}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between' }}>
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
              className="cartoon-button cartoon-button-outline"
              style={{ padding: '8px 20px' }}
            >
              ◀ Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="cartoon-button cartoon-button-primary"
                style={{ padding: '8px 20px' }}
              >
                Next ▶
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="cartoon-button"
                style={{ padding: '10px 24px', background: 'hsl(var(--success))', color: '#fff' }}
              >
                {isLoading ? 'Submitting...' : 'Submit Answers 🚀'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  center: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: '100vh', 
    padding: 24, 
    color: 'hsl(var(--text-main))',
    background: 'transparent'
  },
  selectContainer: {
    maxWidth: 750,
    width: '100%',
    textAlign: 'center',
  },
  title: { 
    fontFamily: 'var(--font-display)',
    fontSize: 28, 
    fontWeight: 800, 
    marginBottom: 8 
  },
  subtitle: { 
    color: 'hsl(var(--text-muted))', 
    marginBottom: 24,
    fontSize: 14.5 
  },
  fieldLabel: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '14.5px',
    marginBottom: '12px',
    color: 'hsl(var(--accent))',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  roleGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
    gap: 12, 
    marginBottom: 20,
    textAlign: 'left'
  },
  roleCard: {
    padding: 16,
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  roleIcon: {
    fontSize: 20
  },
  roleTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: '700',
  },
  roleDesc: {
    color: 'hsl(var(--text-muted))',
    fontSize: 12.5,
    lineHeight: 1.4
  },
  error: { color: 'hsl(var(--danger))', marginBottom: 20, fontSize: 14, fontWeight: '600' },
  
  resultContainer: {
    maxWidth: 650,
    width: '100%',
    padding: '30px 40px',
    textAlign: 'center'
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    margin: '24px 0',
    flexWrap: 'wrap'
  },
  scoreCircle: { 
    borderRadius: '50%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  scoreBig: { fontSize: 38, fontWeight: 800 },
  scoreLabel: { fontSize: 15, alignSelf: 'flex-end', marginBottom: 6 },
  resultSummary: {
    color: 'hsl(var(--text-main))',
    maxWidth: 380,
    textAlign: 'left',
    lineHeight: 1.6,
    fontSize: 14
  },
  feedbackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    marginBottom: 24,
    textAlign: 'left'
  },
  resultList: {
    listStyleType: 'none',
    paddingLeft: 0,
    margin: 0
  },
  resultListItem: {
    fontSize: 13,
    color: 'hsl(var(--text-muted))',
    padding: '4px 0',
    lineHeight: 1.4
  },

  chatWrapper: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: 'hsl(var(--text-main))' },
  chatHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: '0 20px', 
    height: 68,
    zIndex: 10
  },
  chatHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  headerRoleTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 15,
    color: '#000000'
  },
  messagesContainer: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '20px 16px',
  }
};
