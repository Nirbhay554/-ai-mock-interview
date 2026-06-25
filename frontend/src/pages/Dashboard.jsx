import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessions } from '../lib/api';
import supabase from '../lib/supabase';
import CosmicParallaxBg from '../components/CosmicParallaxBg';

// Stylish text logo replacing the robot logo
const InterviewLogo = ({ text = "INTERVIEW", size = "normal" }) => {
  return (
    <div style={{
      display: 'inline-block',
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
      textAlign: 'center'
    }}>
      {text}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      try {
        const data = await getSessions();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getScoreColor = (score) => {
    if (!score) return 'hsl(var(--text-muted))';
    if (score >= 8) return 'hsl(var(--success))';
    if (score >= 5) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalSessionsCount = sessions.length;
  const completedCount = completedSessions.length;
  const averageScore = completedCount > 0
    ? (completedSessions.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / completedCount).toFixed(1)
    : 'N/A';

  return (
    <div style={styles.page}>
      <CosmicParallaxBg starsOnly={true} />
      {/* Header */}
      <div className="cartoon-header" style={{ ...styles.header, borderBottom: '3px solid #000000', background: 'hsl(var(--bg-card))' }}>
        <div style={styles.headerContainer}>
          <div style={styles.brand} onClick={() => navigate('/')}>
            <InterviewLogo text="INTERVIEW" />
            <span style={styles.brandName}>Mock Prep</span>
          </div>

          <div style={styles.rightNav}>
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
            
            <button onClick={handleLogout} className="cartoon-button" style={{ padding: '6px 14px', fontSize: 13, background: 'hsl(var(--danger))', color: '#fff' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {/* Welcome Banner */}
        <div className="cartoon-card float-effect-reverse" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 20, border: '3px solid #000', boxShadow: '6px 6px 0px #000', marginBottom: 40, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'hsl(var(--text-main))', marginBottom: 4 }}>
              Hello, {user?.user_metadata?.full_name?.split(' ')[0] || 'Prep Buddy'}! 👋
            </h2>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>
              Ready to test your skills today? We have Mock Interviews, MCQ tests, Aptitude exercises, and Resume evaluations!
            </p>
          </div>
        </div>

        {/* Practice Module Cards (Core request: Attractive Cartoon Cards for new sections) */}
        <h2 style={{ ...styles.sectionTitle, marginBottom: 16 }}>🎯 Choose Your Prep Module</h2>
        <div style={styles.modulesGrid}>
          {/* Module 1: Interview */}
          <div
            className="cartoon-card"
            style={{
              padding: 24,
              border: '3px solid #000',
              background: 'hsl(var(--bg-card))',
              boxShadow: '6px 6px 0px hsl(var(--primary))',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/interview')}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: 'hsl(var(--primary))' }}>Mock Interview</h3>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5, marginBottom: 16 }}>
              Give technical interviews with AI. Speak or write answers. Support for easy (half difficulty!) and standard mode.
            </p>
            <span className="cartoon-badge" style={{ background: 'hsl(var(--primary))', color: '#fff' }}>
              Q&A or MCQ
            </span>
          </div>

          {/* Module 2: Aptitude */}
          <div
            className="cartoon-card"
            style={{
              padding: 24,
              border: '3px solid #000',
              background: 'hsl(var(--bg-card))',
              boxShadow: '6px 6px 0px hsl(var(--secondary))',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/aptitude')}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧩</div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: 'hsl(var(--secondary))' }}>Aptitude Practice</h3>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5, marginBottom: 16 }}>
              Solve math, logical reasoning, and verbal aptitude MCQs with instant step-by-step explanations.
            </p>
            <span className="cartoon-badge" style={{ background: 'hsl(var(--secondary))', color: '#000' }}>
              Aptitude Tests
            </span>
          </div>

          {/* Module 3: Resume Rate */}
          <div
            className="cartoon-card"
            style={{
              padding: 24,
              border: '3px solid #000',
              background: 'hsl(var(--bg-card))',
              boxShadow: '6px 6px 0px hsl(var(--accent))',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/resume-analyzer')}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: 'hsl(var(--accent))' }}>Resume Evaluator</h3>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5, marginBottom: 16 }}>
              Upload your PDF/TXT resume and get a score out of 100 with clear strengths, weaknesses, and reviews.
            </p>
            <span className="cartoon-badge" style={{ background: 'hsl(var(--accent))', color: '#fff' }}>
              Score / 100
            </span>
          </div>
        </div>

        {/* Stats Row */}
        {!loading && sessions.length > 0 && (
          <div style={{ margin: '40px 0' }}>
            <h2 style={styles.sectionTitle}>📊 Your Progress Summary</h2>
            <div style={styles.statsGrid}>
              <div className="cartoon-card" style={{ padding: 20, border: '2.5px solid #000', boxShadow: '4px 4px 0 #000', background: 'hsl(var(--bg-card-light))' }}>
                <span style={styles.statLabel}>Total Practice Sessions</span>
                <span style={styles.statValue}>{totalSessionsCount}</span>
              </div>
              <div className="cartoon-card" style={{ padding: 20, border: '2.5px solid #000', boxShadow: '4px 4px 0 #000', background: 'hsl(var(--bg-card-light))' }}>
                <span style={styles.statLabel}>Completed Tracks</span>
                <span style={styles.statValue}>{completedCount}</span>
              </div>
              <div className="cartoon-card" style={{ padding: 20, border: '2.5px solid #000', boxShadow: '4px 4px 0 #000', background: 'hsl(var(--bg-card-light))' }}>
                <span style={styles.statLabel}>Average Performance</span>
                <span style={{ ...styles.statValue, color: averageScore !== 'N/A' ? getScoreColor(parseFloat(averageScore)) : '#000000' }}>
                  {averageScore} <span style={styles.avgScoreMax}>{averageScore !== 'N/A' ? '/10' : ''}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        <h2 style={styles.sectionTitle}>📋 Past Sessions Log</h2>

        {loading ? (
          <div style={styles.loadingWrapper}>
            <div style={{ width: 36, height: 36, border: '4px solid #000', borderTop: '4px solid hsl(var(--primary))', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'hsl(var(--text-muted))', marginTop: 12 }}>Loading records...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="cartoon-card" style={{ textAlign: 'center', padding: '40px 20px', border: '3px solid #000', boxShadow: '6px 6px 0px #000' }}>
            <span style={{ fontSize: 44 }}>🎯</span>
            <h3 style={{ fontSize: 18, marginTop: 10, marginBottom: 6 }}>No history log yet</h3>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13.5, maxWidth: 350, margin: '0 auto 16px auto', lineHeight: 1.5 }}>
              Choose a module above to start practicing and generate your profile stats!
            </p>
          </div>
        ) : (
          <div style={styles.grid}>
            {sessions.map((s) => {
              const isAptitude = s.role === 'Aptitude';
              return (
                <div
                  key={s.id}
                  className="cartoon-card"
                  style={{
                    padding: 20,
                    border: '3px solid #000000',
                    boxShadow: '4px 4px 0px #000000',
                    background: 'hsl(var(--bg-card-light))',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 220
                  }}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                >
                  <div>
                    <div style={styles.cardTop}>
                      <span style={{ ...styles.role, color: isAptitude ? 'hsl(var(--secondary))' : 'hsl(var(--primary))' }}>
                        {isAptitude ? '🧩 Aptitude Practice' : `💬 ${s.role}`}
                      </span>
                      <span className="cartoon-badge" style={{ background: s.status === 'completed' ? 'hsl(var(--success))' : 'hsl(var(--warning))', fontSize: 10 }}>
                        {s.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, margin: '4px 0 10px 0' }}>
                      {s.type && (
                        <span style={{ fontSize: 11, background: '#000', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>
                          {s.type}
                        </span>
                      )}
                      {s.difficulty && (
                        <span style={{ fontSize: 11, background: '#000', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 'bold', color: s.difficulty === 'easy' ? 'hsl(var(--warning))' : '#fff' }}>
                          {s.difficulty}
                        </span>
                      )}
                    </div>

                    {s.overall_score !== null && s.overall_score !== undefined ? (
                      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
                        <span style={{ fontSize: 32, fontWeight: '800', marginRight: 2, color: getScoreColor(s.overall_score) }}>
                          {s.type === 'mcq' ? Math.round((s.overall_score * (s.total_questions || 5)) / 10) : s.overall_score}
                        </span>
                        <span style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>
                          /{s.type === 'mcq' ? (s.total_questions || 5) : 10}
                        </span>
                      </div>
                    ) : (
                      <div style={{ color: 'hsl(var(--text-muted))', fontSize: 13, fontStyle: 'italic', marginBottom: 16 }}>Session Unfinished</div>
                    )}

                    {s.summary ? (
                      <p style={styles.summary}>{s.summary}</p>
                    ) : (
                      <p style={{ color: 'hsl(var(--text-muted))', fontSize: 12.5, fontStyle: 'italic' }}>Resume or review details</p>
                    )}
                  </div>

                  <div style={{ ...styles.cardFooter, borderTop: '2px solid #000', paddingTop: 12 }}>
                    <span style={styles.date}>
                      {new Date(s.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                    <span style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold', fontSize: 13 }}>Review Details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'transparent', color: 'hsl(var(--text-main))' },
  header: { 
    position: 'sticky', 
    top: 0, 
    zIndex: 100, 
    padding: '0 20px',
    height: 72,
    display: 'flex',
    alignItems: 'center'
  },
  headerContainer: {
    width: '100%',
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer'
  },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 20,
    color: '#000000'
  },
  rightNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: 8 },
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
  
  content: { maxWidth: 1050, margin: '0 auto', padding: '30px 20px' },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
    color: 'hsl(var(--text-main))',
    fontFamily: 'var(--font-display)'
  },
  
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginBottom: 40
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16
  },
  statLabel: {
    fontSize: 11,
    color: 'hsl(var(--text-muted))',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '700',
    display: 'block',
    marginBottom: 4
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000'
  },
  avgScoreMax: {
    fontSize: 14,
    color: 'hsl(var(--text-muted))',
    fontWeight: '500'
  },
  
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0'
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  role: { fontWeight: '800', fontSize: 16, fontFamily: 'var(--font-display)' },
  summary: { color: 'hsl(var(--text-muted))', fontSize: 12.5, lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  date: { color: 'hsl(var(--text-muted))', fontSize: 11.5, fontWeight: '500' }
};
