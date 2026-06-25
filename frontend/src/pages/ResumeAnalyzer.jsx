import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rateResume, getResumeHistory } from '../lib/api';
import InterviewLogo from '../components/InterviewLogo';
import CosmicParallaxBg from '../components/CosmicParallaxBg';

// CuteRobot component removed

export default function ResumeAnalyzer() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Fetch History
  const fetchHistory = async () => {
    try {
      const data = await getResumeHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching resume history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Cycling loading text
  useEffect(() => {
    if (!isLoading) return;
    const texts = [
      'Aapka resume analyze ho raha hai... 📂',
      'Scanning education & skills... 🎓',
      'Evaluating work experience depth... 💼',
      'Analyzing project impact metrics... 💻',
      'Formatting professional feedback scorecard... 📊',
    ];
    let i = 0;
    setLoadingText(texts[0]);
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        setError('Please select a valid PDF or TXT file.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await rateResume(selectedFile);
      setResult(data);
      setSelectedFile(null);
      fetchHistory(); // Refresh history list
    } catch (err) {
      setError(err.message || 'Failed to analyze resume.');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'hsl(var(--success))';
    if (score >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  return (
    <div style={styles.center}>
      <CosmicParallaxBg starsOnly={true} />
      <div style={styles.container}>
        
        {/* Stage 1: Uploading / Scanning */}
        {!result && !isLoading && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <InterviewLogo text="INTERVIEW" size="large" />
            </div>

            <div className="speech-bubble" style={{ maxWidth: 450, margin: '0 auto 24px auto', fontSize: 14.5, fontWeight: '600', textAlign: 'center' }}>
              Upload your Resume (PDF/TXT)! I will scan it, rate it out of 100, and show you exactly what to fix! 🚀
            </div>

            <h1 style={styles.title}>AI Resume Evaluator</h1>
            <p style={styles.subtitle}>Get professional feedback scorecard and actionable recommendations.</p>

            <div className="cartoon-card" style={{ padding: '36px 24px', background: 'hsl(var(--bg-card))', textAlign: 'center', marginBottom: 24, cursor: 'pointer' }}>
              <input
                type="file"
                id="resume-file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="resume-file" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📁</div>
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>
                  {selectedFile ? selectedFile.name : 'Choose Resume File'}
                </h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                  Supports PDF and TXT formats (Max 5MB)
                </p>
              </label>
            </div>

            {error && <p style={styles.error}>⚠️ {error}</p>}

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="cartoon-button cartoon-button-outline"
              >
                ← Return to Dashboard
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile}
                className="cartoon-button cartoon-button-primary"
              >
                Evaluate Resume 🚀
              </button>
            </div>
          </div>
        )}

        {/* Stage 2: Loading scanning mode */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              <InterviewLogo text="SCANNING" size="large" />
            </div>
            <h2 style={{ ...styles.title, marginTop: 24, fontSize: 22 }}>Evaluating Your Profile...</h2>
            <p style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold', fontSize: 15, marginTop: 12 }} className="float-effect">
              {loadingText}
            </p>
          </div>
        )}

        {/* Stage 3: Evaluation results report */}
        {result && (
          <div className="cartoon-card" style={{ padding: '32px 40px', background: 'hsl(var(--bg-card))', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <InterviewLogo text="RESULTS" size="large" />
            </div>

            <h2 style={{ ...styles.title, fontSize: 26, marginBottom: 4 }}>Resume Scorecard 🏆</h2>
            <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 24 }}>Report card for {result.file_name}</p>

            <div style={styles.scoreRow}>
              {/* SVG Circular Gauge */}
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
                <svg width="140" height="140" viewBox="0 0 100 100" className="gauge-svg">
                  <circle cx="50" cy="50" r="40" stroke="#000" strokeWidth="9" fill="none" />
                  <circle cx="50" cy="50" r="40" stroke="hsl(var(--bg-card-light))" strokeWidth="6" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={getScoreColor(result.score)}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * result.score) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                  <text x="50%" y="54%" textAnchor="middle" fill="#000000" fontWeight="800" fontSize="19" fontFamily="var(--font-display)">
                    {result.score}
                  </text>
                  <text x="50%" y="72%" textAnchor="middle" fill="hsl(var(--text-muted))" fontWeight="700" fontSize="8" fontFamily="var(--font-display)">
                    / 100
                  </text>
                </svg>
              </div>

              <div style={{ textAlign: 'left', flex: 1, minWidth: 260 }}>
                <h4 style={{ color: 'hsl(var(--secondary))', marginBottom: 6, fontSize: 15 }}>📋 Recruiter Summary</h4>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
                  {result.summary}
                </p>
              </div>
            </div>

            <div style={styles.feedbackGrid}>
              <div style={{ ...styles.feedbackCardGreen, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(34, 197, 94, 0.08)' }}>
                <h3 style={{ color: 'hsl(var(--success))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>⭐ Key Strengths</h3>
                <ul style={styles.resultList}>
                  {result.strengths?.map((s, i) => <li key={i} style={styles.resultListItem}>⭐ {s}</li>)}
                </ul>
              </div>
              <div style={{ ...styles.feedbackCardRed, border: '3px solid #000000', borderRadius: 12, boxShadow: '4px 4px 0px #000', background: 'rgba(239, 68, 68, 0.08)' }}>
                <h3 style={{ color: 'hsl(var(--danger))', marginBottom: 8, fontSize: 15, fontWeight: '700' }}>⚠️ Areas of Improvement</h3>
                <ul style={styles.resultList}>
                  {result.weaknesses?.map((w, i) => <li key={i} style={styles.resultListItem}>🎯 {w}</li>)}
                </ul>
              </div>
            </div>

            {result.warning && (
              <p style={{ fontSize: 12, color: 'hsl(var(--warning))', marginBottom: 16 }}>
                ⚠️ {result.warning}
              </p>
            )}

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="cartoon-button cartoon-button-outline"
              >
                Dashboard Home
              </button>
              <button
                onClick={() => setResult(null)}
                className="cartoon-button cartoon-button-primary"
              >
                Rate Another Resume 📁
              </button>
            </div>
          </div>
        )}

        {/* History Log Section */}
        {!isLoading && history.length > 0 && (
          <div style={{ marginTop: 40, textAlign: 'left' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 15 }}>📋 Past Resume Evaluations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((record) => (
                <div
                  key={record.id}
                  className="cartoon-card"
                  style={{
                    padding: '12px 18px',
                    background: 'hsl(var(--bg-card-light))',
                    border: '2px solid #000',
                    boxShadow: '3px 3px 0px #000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: 14, color: '#000000', marginBottom: 4 }}>{record.file_name}</h4>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      Evaluated on: {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div
                    className="cartoon-badge"
                    style={{
                      background: getScoreColor(record.score),
                      color: '#000',
                      fontWeight: '800',
                      fontSize: 14,
                      padding: '4px 10px'
                    }}
                  >
                    {record.score}/100
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
    padding: '24px 16px',
    color: 'hsl(var(--text-main))',
    background: 'transparent'
  },
  container: {
    maxWidth: 750,
    width: '100%',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    color: 'hsl(var(--text-muted))',
    marginBottom: 28,
    fontSize: 14.5,
    textAlign: 'center'
  },
  error: { color: 'hsl(var(--danger))', marginBottom: 20, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 28,
    margin: '24px 0',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  feedbackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    marginBottom: 24,
    textAlign: 'left'
  },
  feedbackCardGreen: {
    padding: 16
  },
  feedbackCardRed: {
    padding: 16
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
  }
};
