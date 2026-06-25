import { useState } from 'react';
import supabase from '../lib/supabase';
import CardFanCarousel from '../components/CardFanCarousel';
import CosmicParallaxBg from '../components/CosmicParallaxBg';
import { MetalButton } from '../components/Button';

// Stylish text-based logo replacing the robot
const InterviewLogo = ({ text = "INTERVIEW", size = "normal" }) => {
  return (
    <div style={{
      display: 'inline-block',
      fontFamily: 'var(--font-display)',
      fontWeight: '900',
      fontSize: size === 'large' ? '28px' : '16px',
      color: '#000000',
      background: 'hsl(var(--secondary))',
      border: '3px solid #000000',
      padding: size === 'large' ? '12px 24px' : '6px 16px',
      borderRadius: '8px',
      boxShadow: '3px 3px 0px #000000',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      textAlign: 'center'
    }}>
      {text}
    </div>
  );
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loginMethod, setLoginMethod] = useState('google'); // 'google' | 'email'

  const handleScrollToLogin = (isSignUpMode) => {
    setIsSignUp(isSignUpMode);
    setLoginMethod('email'); // Default to email form
    const container = document.getElementById('login-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleGoogleLogin = async () => {
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage(`Google Login Error: ${err.message}`);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Sign-up successful! Check your email inbox for confirmation links.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const specialties = [
    { emoji: '🎙️', title: 'Real-time Voice Analysis', desc: 'Answer technical questions verbally with instant speech evaluation.' },
    { emoji: '⏱️', title: 'Custom Track Settings', desc: 'Select track, mode (Q&A/MCQ), difficulty (half option), and size (5-10 questions).' },
    { emoji: '🧩', title: 'Aptitude Practice Hub', desc: 'Train your quantitative, logical reasoning, and verbal reasoning skills.' },
    { emoji: '📁', title: 'AI Resume Reviewer', desc: 'Upload PDF resumes to get rated out of 100 with recruiter summaries.' },
    { emoji: '🚀', title: 'Balanced-Brace Flash Logic', desc: 'Powered by highly stable gemini-3.1-flash-lite retry pipelines.' }
  ];

  return (
    <div style={styles.page}>
      {/* Top Header with Login and Sign Up buttons */}
      <div style={styles.topHeader}>
        <MetalButton onClick={() => handleScrollToLogin(false)} variant="default">
          Login
        </MetalButton>
        <MetalButton onClick={() => handleScrollToLogin(true)} variant="gold">
          Sign Up
        </MetalButton>
      </div>

      {/* Cosmic Parallax background */}
      <CosmicParallaxBg 
        head="AI Mock Prep" 
        text="" 
      />
      
      {/* Centered container scrollable */}
      <div style={styles.scrollWrapper}>
        
        {/* BIG BOLD HEADING */}
        <h1 style={styles.mainHeading}>AI Mock Interview</h1>
        
        {/* SPECIALTIES DISPLAYED ABOVE THE LOGIN CARD */}
        <div style={styles.specialtiesSection}>
          <CardFanCarousel cards={specialties} />
        </div>

        {/* LOGIN CONTAINER */}
        <div id="login-container" style={styles.authContainer}>
          <div className="cartoon-card" style={styles.authCard}>
            <div style={styles.logoContainer}>
              <InterviewLogo text="INTERVIEW" size="large" />
            </div>
            
            <h1 style={styles.title}>AI Mock Prep</h1>
            <p style={styles.sub}>
              Kickstart your preparation by signing in. Choose your preferred registration method below.
            </p>

            {/* Toggle between Google & Email */}
            <div style={styles.methodToggle}>
              <button
                type="button"
                onClick={() => { setLoginMethod('google'); setMessage(''); }}
                className="cartoon-button"
                style={{
                  flex: 1,
                  fontSize: '13px',
                  padding: '8px 12px',
                  background: loginMethod === 'google' ? 'hsl(var(--primary))' : '#ffffff',
                  color: loginMethod === 'google' ? '#ffffff' : '#000000'
                }}
              >
                🌐 Google Sign In
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod('email'); setMessage(''); }}
                className="cartoon-button"
                style={{
                  flex: 1,
                  fontSize: '13px',
                  padding: '8px 12px',
                  background: loginMethod === 'email' ? 'hsl(var(--primary))' : '#ffffff',
                  color: loginMethod === 'email' ? '#ffffff' : '#000000'
                }}
              >
                ✉️ Email & Password
              </button>
            </div>

            {message && (
              <div className="cartoon-card" style={styles.messageBox}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{message}</span>
              </div>
            )}

            {/* Google Auth Block */}
            {loginMethod === 'google' && (
              <div style={{ marginTop: 24 }}>
                <button onClick={handleGoogleLogin} className="cartoon-button cartoon-button-primary" style={{ width: '100%', padding: '16px' }}>
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    alt="G" 
                    width={20} 
                    style={styles.googleIcon} 
                  />
                  Continue with Google
                </button>
              </div>
            )}

            {/* Email Auth Block */}
            {loginMethod === 'email' && (
              <form onSubmit={handleEmailAuth} style={styles.emailForm}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="cartoon-input"
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="cartoon-input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="cartoon-button cartoon-button-accent"
                  style={{ width: '100%', padding: '14px', marginTop: 12 }}
                >
                  {loading ? 'Processing...' : isSignUp ? 'Sign Up (Create Account)' : 'Login (Existing Account)'}
                </button>

                <div style={styles.formFooter}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    style={styles.switchModeBtn}
                  >
                    {isSignUp ? 'Switch to Login' : 'Create an Account'}
                  </button>
                </div>
              </form>
            )}

            <p style={styles.note}>100% Free. Secure OAuth & Database Storage</p>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: { 
    minHeight: '100vh', 
    background: 'transparent', // Transparent to let cosmic stars background shine through
    color: '#000000',
    overflowY: 'auto'
  },
  scrollWrapper: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 60
  },
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480
  },
  authCard: { 
    borderRadius: 24, 
    padding: '40px', 
    width: '100%', 
    textAlign: 'center', 
    background: '#e0f2fe', // light morning sky blue color
    border: '4px solid #000000',
    boxShadow: '8px 8px 0px #000000',
    position: 'relative'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  title: { 
    fontFamily: 'var(--font-display)',
    fontSize: '28px', 
    fontWeight: '800', 
    color: '#000000', 
    marginBottom: 8,
    letterSpacing: '-0.02em'
  },
  sub: { 
    color: '#475569', 
    marginBottom: 24, 
    lineHeight: 1.6,
    fontSize: '13.5px'
  },
  methodToggle: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
  },
  messageBox: {
    padding: '12px',
    background: 'rgba(6, 182, 212, 0.08)',
    border: '2px solid #000000',
    borderRadius: '10px',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 16,
  },
  googleIcon: {
    background: '#ffffff',
    padding: 2,
    borderRadius: '50%',
    marginRight: 8
  },
  emailForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    textAlign: 'left',
    marginTop: 20
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  inputLabel: {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '13px',
    color: '#000000'
  },
  formFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    marginTop: 10
  },
  switchModeBtn: {
    background: 'none',
    border: 'none',
    color: 'hsl(var(--primary))',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px'
  },
  note: { 
    color: '#64748b', 
    fontSize: '11px', 
    marginTop: 20 
  },
  specialtiesSection: {
    width: '100%',
    textAlign: 'center'
  },
  sidebarTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffffff', // white text for readability against dark space bg
    marginBottom: '8px'
  },
  sidebarSubtitle: {
    fontSize: '13.5px',
    color: '#94a3b8', // light blue-slate text for readability against dark space bg
    marginBottom: '24px'
  },
  verticalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  specCard: {
    padding: '16px 20px',
    background: '#ffffff',
    border: '3px solid #000000',
    borderRadius: '16px',
    boxShadow: '4px 4px 0px #000000',
    textAlign: 'left'
  },
  specHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: '8px'
  },
  specEmoji: {
    fontSize: '22px'
  },
  specCardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: '700',
    color: '#000000'
  },
  specDesc: {
    fontSize: '12.5px',
    lineHeight: '1.5',
    color: '#334155'
  },
  topHeader: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    zIndex: 100,
    display: 'flex',
    gap: '12px'
  },
  mainHeading: {
    fontFamily: 'var(--font-display)',
    fontSize: '56px',
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: '-0.02em',
    marginBottom: '20px',
    textShadow: '0 0 20px rgba(255, 255, 255, 0.15), 0 4px 8px rgba(0, 0, 0, 0.5)',
    textTransform: 'uppercase'
  }
};
