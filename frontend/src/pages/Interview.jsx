import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startInterview, submitAnswer, submitMcqAnswers } from '../lib/api';
import useVoice from '../hooks/useVoice';
import supabase from '../lib/supabase';
import CosmicParallaxBg from '../components/CosmicParallaxBg';

const ROLES = [
  { name: 'Frontend', icon: '🎨', desc: 'React, CSS layout, DOM structure, and web APIs' },
  { name: 'Backend', icon: '⚙️', desc: 'Node.js, databases, Express routing, and caching' },
  { name: 'DSA', icon: '🧠', desc: 'Data structures, space/time complexity, and algorithms' },
  { name: 'System Design', icon: '🌐', desc: 'Scalability, microservices, load balancing, and SQL vs NoSQL' },
  { name: 'Full Stack', icon: '🚀', desc: 'Client-server architecture, security, and full-stack integrations' },
];

// Stylish text logo replacing the robot logo
const InterviewLogo = ({ text = "INTERVIEW", size = "normal" }) => {
  return (
    <div style={{
      fontFamily: 'var(--font-display)',
      fontWeight: '900',
      fontSize: size === 'large' ? '24px' : '15px',
      color: '#000000',
      background: 'hsl(var(--secondary))',
      border: '3px solid #000000',
      padding: size === 'large' ? '8px 16px' : '4px 10px',
      borderRadius: '6px',
      boxShadow: '2px 2px 0px #000000',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      textAlign: 'center',
      margin: '0 auto',
      display: 'block',
      width: 'fit-content'
    }}>
      {text}
    </div>
  );
};

export default function Interview() {
  const navigate = useNavigate();
  
  // Settings stages: select | interview | result
  const [stage, setStage] = useState('select'); 
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedType, setSelectedType] = useState('qa'); // qa | mcq
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium'); // easy | medium
  const [selectedQuestions, setSelectedQuestions] = useState(5); // 5 to 10
  const [latestEvaluation, setLatestEvaluation] = useState(null);
  
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inputMode, setInputMode] = useState('text'); // text | voice
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const bottomRef = useRef(null);

  // MCQ state
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState({}); // {question_number: option_index}

  const {
    isListening, transcript, isSpeaking,
    startListening, stopListening, speak, stopSpeaking, setTranscript,
    voiceError,
  } = useVoice();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) setInputText(transcript);
  }, [transcript]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stage, stopSpeaking]);

  useEffect(() => {
    if (voiceError) {
      setError(voiceError);
    }
  }, [voiceError]);

  const addMessage = (role, content, meta = {}) => {
    setMessages((prev) => [...prev, { role, content, ...meta }]);
  };

  // Start interview
  const handleStart = async () => {
    if (!selectedRole) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await startInterview(selectedRole, selectedType, selectedDifficulty, selectedQuestions);
      setSessionId(data.session_id);
      setCelebratedInSession(false);
      setLatestEvaluation(null);
      
      if (selectedType === 'mcq') {
        setMcqQuestions(data.questions);
        setCurrentMcqIndex(0);
        setMcqAnswers({});
        setStage('interview');
      } else {
        setQuestionNumber(data.question_number);
        addMessage('agent', data.question);
        speak(data.question);
        setStage('interview');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [celebration, setCelebration] = useState(null); // null or { score, nextAction }
  const [celebratedInSession, setCelebratedInSession] = useState(false);

  // Submit QA Answer
  const handleSubmitQA = async () => {
    const answer = inputText.trim();
    if (!answer || isLoading) return;

    stopSpeaking();

    const isVoice = inputMode === 'voice';
    addMessage('user', answer, { isVoice });
    setInputText('');
    setTranscript('');
    setIsLoading(true);
    setError('');

    try {
      const data = await submitAnswer(sessionId, answer, isVoice);

      const processNextStep = () => {
        if (data.interview_complete) {
          setResult(data);
          setStage('result');
          speak(`Interview complete! You scored ${data.overall_score} out of 10. ${data.summary}`);
          return;
        }

        if (data.feedback) {
          setLatestEvaluation({
            feedback: data.feedback,
            score: data.answer_score,
            questionNumber: questionNumber,
          });
          addMessage('agent', `Evaluation: ${data.feedback}`, {
            isFeedback: true,
            score: data.answer_score,
          });
        }

        addMessage('agent', data.question);
        setQuestionNumber(data.question_number);
        speak(data.question);
      };

      // If user scores > 7 on this turn, trigger the Mickey Mouse celebration before showing next question/results
      if (data.answer_score > 7 && !celebratedInSession) {
        setCelebratedInSession(true);
        if (data.feedback) {
          setLatestEvaluation({
            feedback: data.feedback,
            score: data.answer_score,
            questionNumber: questionNumber,
          });
        }
        setCelebration({
          score: data.answer_score,
          nextAction: processNextStep
        });
      } else {
        processNextStep();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit MCQ answers
  const handleSubmitMCQ = async () => {
    // Fill unanswered questions with -1
    const finalAnswers = mcqQuestions.map((q, idx) => {
      const val = mcqAnswers[idx + 1];
      return val !== undefined ? val : -1;
    });

    setIsLoading(true);
    setError('');
    try {
      const data = await submitMcqAnswers(sessionId, finalAnswers);
      setResult(data);
      setStage('result');
      speak(`Exam submitted successfully! You scored ${data.overall_score} out of 10.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      setInputText('');
      startListening();
    }
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 8) return 'hsl(var(--success))';
    if (score >= 5) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  // ─── RENDER: Selection Stage ──────────────────────────────────────────────
  if (stage === 'select') {
    return (
      <div style={styles.center}>
        <CosmicParallaxBg starsOnly={true} />
        <div style={styles.selectContainer}>
          <div style={{ marginBottom: 20 }}>
            <InterviewLogo text="INTERVIEW" size="large" />
          </div>

          <div style={styles.bubbleContainer}>
            <div className="speech-bubble" style={{ maxWidth: 450, margin: '0 auto 24px auto', fontSize: 15, fontWeight: '600' }}>
              Swagat hai! 💬 Customize your Mock Interview settings below to begin!
            </div>
          </div>

          <h1 style={styles.title}>Mock Interview Settings</h1>
          <p style={styles.subtitle}>Super attractive tech-cartoon interface. Select your track & difficulty!</p>

          <div className="cartoon-card" style={{ padding: '24px 32px', background: 'hsl(var(--bg-card))', textAlign: 'left', marginBottom: 32 }}>
            {/* Track Selector */}
            <label style={styles.fieldLabel}>1. Select Interview Track</label>
            <div style={styles.roleGrid}>
              {ROLES.map((role) => (
                <div
                  key={role.name}
                  onClick={() => setSelectedRole(role.name)}
                  style={{
                    ...styles.roleCard,
                    border: selectedRole === role.name ? '3px solid hsl(var(--primary))' : '2px solid #000',
                    background: selectedRole === role.name ? 'rgba(139, 92, 246, 0.15)' : 'hsl(var(--bg-card-light))',
                    boxShadow: selectedRole === role.name ? '4px 4px 0px hsl(var(--primary))' : '2px 2px 0px #000'
                  }}
                >
                  <div style={styles.cardHeader}>
                    <span style={styles.roleIcon}>{role.icon}</span>
                    <span style={{ ...styles.roleTitle, color: selectedRole === role.name ? 'hsl(var(--primary))' : '#000000' }}>{role.name}</span>
                  </div>
                  <p style={styles.roleDesc}>{role.desc}</p>
                </div>
              ))}
            </div>

            {/* Mode & Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={styles.fieldLabel}>2. Interview Mode</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setSelectedType('qa')}
                    className="cartoon-button"
                    style={{ flex: 1, background: selectedType === 'qa' ? 'hsl(var(--primary))' : 'hsl(var(--bg-card))', color: selectedType === 'qa' ? '#fff' : '#000' }}
                  >
                    💬 Speaking/Q&A
                  </button>
                  <button
                    onClick={() => setSelectedType('mcq')}
                    className="cartoon-button"
                    style={{ flex: 1, background: selectedType === 'mcq' ? 'hsl(var(--primary))' : 'hsl(var(--bg-card))', color: selectedType === 'mcq' ? '#fff' : '#000' }}
                  >
                    🎯 MCQ Quiz
                  </button>
                </div>
              </div>

              <div>
                <label style={styles.fieldLabel}>3. Difficulty level</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setSelectedDifficulty('easy')}
                    className="cartoon-button"
                    style={{ flex: 1, background: selectedDifficulty === 'easy' ? 'hsl(var(--warning))' : 'hsl(var(--bg-card))', color: '#000' }}
                  >
                    🎈 Half Difficulty
                  </button>
                  <button
                    onClick={() => setSelectedDifficulty('medium')}
                    className="cartoon-button"
                    style={{ flex: 1, background: selectedDifficulty === 'medium' ? 'hsl(var(--primary))' : 'hsl(var(--bg-card))', color: selectedDifficulty === 'medium' ? '#fff' : '#000' }}
                  >
                    ⚙️ Standard Tech
                  </button>
                </div>
              </div>
            </div>

            {/* Questions count */}
            <div style={{ marginBottom: 10 }}>
              <label style={styles.fieldLabel}>4. Number of Questions ({selectedQuestions})</label>
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
              ← Back
            </button>
            <button
              onClick={handleStart}
              disabled={!selectedRole || isLoading}
              className="cartoon-button cartoon-button-primary"
            >
              {isLoading ? 'Launching Module...' : 'Begin Session 🚀'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Results Stage ────────────────────────────────────────────────
  if (stage === 'result') {
    const isMcq = selectedType === 'mcq';
    return (
      <div style={styles.center}>
        <CosmicParallaxBg starsOnly={true} />
        <div style={{ ...styles.resultContainer, border: '3px solid #000000', background: 'hsl(var(--bg-card))', boxShadow: '8px 8px 0px #000' }} className="cartoon-card">
          <div style={{ marginBottom: 15 }}>
            <InterviewLogo text="INTERVIEW SCORECARD" size="large" />
          </div>

          <h2 style={{ ...styles.title, fontSize: 28 }}>Evaluation Completed! 🎉</h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
            {isMcq ? `Score based on ${selectedQuestions} questions` : 'Results generated out of 10 points'}
          </p>

          <div style={styles.scoreRow}>
            <div style={{ ...styles.scoreCircle, width: 120, height: 120, border: '4px solid #000', background: getScoreBadgeColor(result.overall_score), boxShadow: '4px 4px 0px #000' }}>
              <span style={{ ...styles.scoreBig, color: '#000' }}>
                {isMcq ? (result.graded_questions ? result.graded_questions.filter(q => q.is_correct).length : Math.round((result.overall_score * selectedQuestions) / 10)) : result.overall_score}
              </span>
              <span style={{ ...styles.scoreLabel, color: '#000' }}>/{isMcq ? selectedQuestions : 10}</span>
            </div>
            <p style={{ ...styles.resultSummary, fontSize: 14.5 }}>{result.summary}</p>
          </div>

          <div style={styles.feedbackGrid}>
            <div style={{ ...styles.feedbackCardGreen, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(34, 197, 94, 0.08)' }}>
              <h3 style={{ color: 'hsl(var(--success))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>✨ Key Strengths</h3>
              <ul style={styles.resultList}>
                {result.strengths?.map((s, i) => <li key={i} style={styles.resultListItem}>⭐ {s}</li>)}
              </ul>
            </div>
            <div style={{ ...styles.feedbackCardRed, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(239, 68, 68, 0.08)' }}>
              <h3 style={{ color: 'hsl(var(--danger))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>⚠️ Areas to Improve</h3>
              <ul style={styles.resultList}>
                {result.weaknesses?.map((w, i) => <li key={i} style={styles.resultListItem}>🎯 {w}</li>)}
              </ul>
            </div>
          </div>

          {/* MCQ Question Review */}
          {isMcq && result.graded_questions && (
            <div style={{ textAlign: 'left', margin: '30px 0', borderTop: '2px dashed #000', paddingTop: 20 }}>
              <h3 style={{ fontSize: 18, marginBottom: 15 }}>📝 Question-by-Question Review:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {result.graded_questions.map((q, idx) => (
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
                      💡 <strong>Explanation:</strong> {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard')} className="cartoon-button cartoon-button-primary">
              Dashboard Home
            </button>
            <button
              onClick={() => { setStage('select'); setMessages([]); setResult(null); setLatestEvaluation(null); }}
              className="cartoon-button cartoon-button-outline"
            >
              Practice Again 🔁
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Interview Exam Stage ─────────────────────────────────────────
  const isMcqMode = selectedType === 'mcq';

  // Render MCQ Exam Interface
  if (isMcqMode) {
    const currentQ = mcqQuestions[currentMcqIndex];
    if (!currentQ) return <div style={styles.center}><CosmicParallaxBg starsOnly={true} />Loading MCQ Questions...</div>;

    const selectedOption = mcqAnswers[currentQ.question_number];

    return (
      <div style={styles.chatWrapper}>
        <CosmicParallaxBg starsOnly={true} />
        {/* Header */}
        <div style={{ ...styles.chatHeader, background: 'hsl(var(--bg-card))', borderBottom: '3px solid #000' }}>
          <div style={styles.chatHeaderLeft}>
            <button onClick={() => navigate('/dashboard')} className="cartoon-button" style={{ padding: '6px 12px', fontSize: 12, background: 'hsl(var(--danger))', color: '#fff' }}>
              ✕ Quit Exam
            </button>
            <span style={styles.headerRoleTitle}>📝 MCQ Exam — {selectedRole} ({selectedDifficulty === 'easy' ? 'Easy Mode' : 'Standard'})</span>
          </div>
          <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000' }}>
            Q {currentMcqIndex + 1} of {mcqQuestions.length}
          </span>
        </div>

        {/* MCQ body */}
        <div style={{ ...styles.messagesContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="cartoon-card" style={{ maxWidth: 650, width: '100%', padding: 24, background: 'hsl(var(--bg-card))' }}>
            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <InterviewLogo text="QUESTION" />
            </div>

            <h3 style={{ fontSize: 18, marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
              {currentQ.question}
            </h3>

            {/* A, B, C, D Option Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setMcqAnswers({ ...mcqAnswers, [currentQ.question_number]: idx })}
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

            {/* Navigation controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                disabled={currentMcqIndex === 0}
                onClick={() => setCurrentMcqIndex(currentMcqIndex - 1)}
                className="cartoon-button cartoon-button-outline"
                style={{ padding: '8px 20px' }}
              >
                ◀ Previous
              </button>

              {currentMcqIndex < mcqQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentMcqIndex(currentMcqIndex + 1)}
                  className="cartoon-button cartoon-button-primary"
                  style={{ padding: '8px 20px' }}
                >
                  Next ▶
                </button>
              ) : (
                <button
                  onClick={handleSubmitMCQ}
                  disabled={isLoading}
                  className="cartoon-button"
                  style={{ padding: '10px 24px', background: 'hsl(var(--success))', color: '#fff' }}
                >
                  {isLoading ? 'Submitting...' : 'Submit Exam 🚀'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render QA Voice/Text Interface
  return (
    <div style={styles.chatWrapper}>
      <CosmicParallaxBg starsOnly={true} />
      {/* Header */}
      <div style={{ ...styles.chatHeader, background: 'hsl(var(--bg-card))', borderBottom: '3px solid #000' }}>
        <div style={styles.chatHeaderLeft}>
          <button onClick={() => navigate('/dashboard')} className="cartoon-button" style={{ padding: '6px 12px', fontSize: 12, background: 'hsl(var(--danger))', color: '#fff' }}>
            ✕ Exit
          </button>
          <span style={styles.headerRoleTitle}>💬 AI Interviewer — {selectedRole} ({selectedDifficulty === 'easy' ? 'Easy Mode' : 'Standard'})</span>
        </div>
        <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000' }}>
          Q {questionNumber} of {selectedQuestions}
        </span>
      </div>

      <div className="chat-body-split">
        {/* Sticky Sidebar Panel */}
        <div className="sidebar-panel-split">
          <div style={{ textAlign: 'center', marginBottom: 5 }}>
            <InterviewLogo text="EVALUATION" />
          </div>
          {latestEvaluation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{
                  width: 70,
                  height: 70,
                  borderRadius: '50%',
                  border: '3px solid #000',
                  background: getScoreBadgeColor(latestEvaluation.score),
                  boxShadow: '3px 3px 0px #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: 22,
                  color: '#000'
                }}>
                  {latestEvaluation.score}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: '800', color: 'hsl(var(--secondary))', textTransform: 'uppercase' }}>
                    Latest Score
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Question {latestEvaluation.questionNumber} of {selectedQuestions}
                  </div>
                </div>
              </div>
              <div className="cartoon-card" style={{ padding: 14, background: 'hsl(var(--bg-card-light))', flex: 1, overflowY: 'auto', border: '2px solid #000', boxShadow: '2px 2px 0px #000', margin: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: '#000000' }}>
                  {latestEvaluation.feedback}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '20px 10px', color: 'hsl(var(--text-muted))' }}>
              <span style={{ fontSize: 40, marginBottom: 12 }}>💬</span>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                Real-time AI score & feedback will appear here as soon as you submit your first answer.
              </p>
            </div>
          )}
        </div>

        {/* Right Chat Panel */}
        <div className="chat-panel-split">
          {/* Messages */}
          <div style={{ ...styles.messagesContainer, width: '100%' }}>
            <div style={styles.messagesInner}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
                <InterviewLogo text="INTERVIEW" size="large" />
              </div>

              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                
                if (msg.isFeedback) {
                  return (
                    <div key={i} className="cartoon-card" style={{ padding: 16, background: 'rgba(6,182,212,0.06)', border: '2px solid #000', boxShadow: '4px 4px 0 #000', alignSelf: 'center', maxWidth: 650, width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: '800', color: 'hsl(var(--secondary))', fontSize: 12, textTransform: 'uppercase' }}>AI Evaluation Feedback</span>
                        <span className="cartoon-badge" style={{ background: getScoreBadgeColor(msg.score), color: '#000' }}>
                          Score: {msg.score}/10
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'hsl(var(--text-muted))' }}>{msg.content}</p>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    style={{
                      ...styles.bubbleWrapper,
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isUser && (
                      <div style={{ ...styles.avatarMini, border: '2px solid #000', background: 'hsl(var(--secondary))', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>AI</div>
                    )}
                    <div
                      className="cartoon-card"
                      style={{
                        maxWidth: '75%',
                        padding: '12px 18px',
                        borderRadius: 16,
                        border: '2.5px solid #000000',
                        boxShadow: isUser ? '3px 3px 0px hsl(var(--primary))' : '3px 3px 0px #000000',
                        background: isUser ? 'hsl(var(--bg-card-light))' : 'hsl(var(--bg-card))',
                        borderTopLeftRadius: !isUser ? 2 : 16,
                        borderTopRightRadius: isUser ? 2 : 16,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{msg.content}</p>
                      {msg.isVoice && (
                        <span style={styles.voiceIndicator}>🎤 Spoken Answer</span>
                      )}
                    </div>
                    {isUser && user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="U" style={{ ...styles.avatarMiniUser, border: '2px solid #000' }} />
                    ) : isUser ? (
                      <div style={{ ...styles.avatarMiniUserPlaceholder, border: '2px solid #000' }}>U</div>
                    ) : null}
                  </div>
                );
              })}
              {isLoading && (
                <div style={styles.bubbleWrapper}>
                  <div style={{ ...styles.avatarMini, border: '2px solid #000', background: 'hsl(var(--secondary))', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>AI</div>
                  <div className="cartoon-card" style={{ padding: '12px 18px', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-muted))', border: '2px solid #000', boxShadow: '2px 2px 0px #000' }}>
                    <span className="float-effect" style={{ display: 'inline-block' }}>Thinking... 🧠</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {error && (
            <div style={styles.errorBanner}>
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Input Area */}
          <div style={{ ...styles.inputArea, background: 'hsl(var(--bg-card))', borderTop: '3px solid #000', width: '100%' }}>
            <div style={styles.inputAreaContainer}>
              <div style={styles.modeToggle}>
                <button
                  onClick={() => { setInputMode('text'); stopListening(); }}
                  className="cartoon-button"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: inputMode === 'text' ? 'hsl(var(--secondary))' : 'hsl(var(--bg-card-light))',
                    color: '#000000'
                  }}
                >
                  ⌨️ Type Answer
                </button>
                <button
                  onClick={() => { setInputMode('voice'); setInputText(''); }}
                  className="cartoon-button"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: inputMode === 'voice' ? 'hsl(var(--secondary))' : 'hsl(var(--bg-card-light))',
                    color: '#000000'
                  }}
                >
                  🎤 Speak Answer
                </button>
              </div>

              <div style={styles.inputRow}>
                {inputMode === 'voice' ? (
                  <button
                    onClick={handleVoiceToggle}
                    className="cartoon-button"
                    style={{
                      background: isListening ? 'hsl(var(--danger))' : 'hsl(var(--primary))',
                      color: '#fff',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isListening ? '🔴 Stop Listening' : '🎤 Speak Now'}
                  </button>
                ) : null}

                {isListening && (
                  <div style={styles.visualizerBlock}>
                    <div className="visualizer-container" style={{ gap: 4 }}>
                      <div className="voice-wave-bar" style={{ animationDelay: '0.1s' }}></div>
                      <div className="voice-wave-bar" style={{ animationDelay: '0.3s' }}></div>
                      <div className="voice-wave-bar" style={{ animationDelay: '0.5s' }}></div>
                      <div className="voice-wave-bar" style={{ animationDelay: '0.2s' }}></div>
                      <div className="voice-wave-bar" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                )}

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitQA();
                    }
                  }}
                  placeholder={
                    inputMode === 'voice'
                      ? isListening ? 'Listening... Speak now!' : 'Click Speak, answer, then click Send.'
                      : 'Type your answer... (Press Enter to send)'
                  }
                  className="cartoon-input"
                  style={{ flex: 1, height: 48, resize: 'none', lineHeight: '20px' }}
                  disabled={isLoading || isListening}
                />

                <button
                  onClick={handleSubmitQA}
                  disabled={!inputText.trim() || isLoading || isListening}
                  className="cartoon-button cartoon-button-primary"
                  style={{ height: 48, padding: '0 20px' }}
                >
                  Send Answer 🚀
                </button>
              </div>

              <div style={styles.inputFooter}>
                {isSpeaking && (
                  <span style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold' }}>
                    🔊 Speaker active... Listening for completion
                  </span>
                )}
                {!isSpeaking && !isListening && (
                  <span style={{ color: 'hsl(var(--text-muted))' }}>
                    Send your answer when ready
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mickey Mouse Celebration Overlay */}
      {celebration && (
        <div
          className="celebration-overlay"
          onClick={() => {
            const next = celebration.nextAction;
            setCelebration(null);
            next();
          }}
        >
          <div className="mickey-bubble">
            <p className="mickey-text">"bhai sahi ja rha hai google pakka hai"</p>
            <span className="mickey-subtext">Click anywhere on screen to continue</span>
          </div>

          {/* Mickey Mouse SVG Vector */}
          <svg width="220" height="220" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(4px 4px 0px #000000)' }}>
            {/* Left Ear */}
            <circle cx="24" cy="28" r="18" fill="#000000" stroke="#000" strokeWidth="2" />
            {/* Right Ear */}
            <circle cx="76" cy="28" r="18" fill="#000000" stroke="#000" strokeWidth="2" />
            {/* Head Silhouette */}
            <circle cx="50" cy="56" r="28" fill="#000000" stroke="#000" strokeWidth="2" />
            {/* Face Mask (Peach/Flesh tone) */}
            <path d="M50 36 C34 36, 32 50, 32 64 C32 78, 42 82, 50 82 C58 82, 68 78, 68 64 C68 50, 66 36, 50 36 Z" fill="#ffd1b3" />
            <path d="M50 36 C42 36, 38 42, 38 52 C38 60, 44 60, 50 60 C56 60, 62 60, 62 52 C62 42, 58 36, 50 36 Z" fill="#ffd1b3" />
            
            {/* Eyes Backdrop (white) */}
            <ellipse cx="44" cy="50" rx="5" ry="10" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="56" cy="50" rx="5" ry="10" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
            {/* Pupils (Black) */}
            <ellipse cx="44" cy="53" rx="2" ry="5" fill="#000000" />
            <ellipse cx="56" cy="53" rx="2" ry="5" fill="#000000" />

            {/* Nose Bridge and Nose */}
            <ellipse cx="50" cy="62" rx="6" ry="3.5" fill="#000000" />
            
            {/* Smile */}
            <path d="M38 66 Q50 78 62 66" stroke="#000000" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Cheeks detail */}
            <path d="M36 67 Q38 65 39 68" stroke="#000000" strokeWidth="2" fill="none" />
            <path d="M64 67 Q62 65 61 68" stroke="#000000" strokeWidth="2" fill="none" />
            {/* Tongue */}
            <path d="M46 72 Q50 76 54 72 Z" fill="#ff4d4d" stroke="#000000" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    maxWidth: 800,
    width: '100%',
    textAlign: 'center',
    padding: '20px 0'
  },
  title: { 
    fontFamily: 'var(--font-display)',
    fontSize: 30, 
    fontWeight: 800, 
    marginBottom: 8 
  },
  subtitle: { 
    color: 'hsl(var(--text-muted))', 
    marginBottom: 24,
    fontSize: 15 
  },
  fieldLabel: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '14.5px',
    marginBottom: '10px',
    color: 'hsl(var(--secondary))',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  roleGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
    gap: 12, 
    marginBottom: 20,
    textAlign: 'left'
  },
  roleCard: {
    padding: 16,
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
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
  error: { color: 'hsl(var(--danger))', marginBottom: 20, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  
  resultContainer: {
    maxWidth: 680,
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
  scoreBig: { fontSize: 40, fontWeight: 800 },
  scoreLabel: { fontSize: 16, alignSelf: 'flex-end', marginBottom: 6 },
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
    display: 'flex',
    justifyContent: 'center'
  },
  messagesInner: {
    maxWidth: 700,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  bubbleWrapper: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    width: '100%'
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'hsl(var(--bg-card-light))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    flexShrink: 0
  },
  avatarMiniUser: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    flexShrink: 0
  },
  avatarMiniUserPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'hsl(var(--primary))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    flexShrink: 0
  },
  voiceIndicator: {
    display: 'block',
    fontSize: 11,
    color: 'hsl(var(--secondary))',
    marginTop: 6,
    fontWeight: '600'
  },

  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    borderTop: '2px solid #000',
    borderBottom: '2px solid #000',
    padding: '8px 20px',
    color: 'hsl(var(--danger))',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600'
  },

  inputArea: { 
    padding: '16px 20px', 
  },
  inputAreaContainer: {
    maxWidth: 700,
    margin: '0 auto',
    width: '100%'
  },
  modeToggle: { display: 'flex', gap: 8, marginBottom: 10 },
  inputRow: { display: 'flex', gap: 12, alignItems: 'stretch' },
  visualizerBlock: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
  },
  inputFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    marginTop: 6,
    color: 'hsl(var(--text-muted))'
  }
};
