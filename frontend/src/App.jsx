import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import supabase from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import SessionDetails from './pages/SessionDetails';
import Aptitude from './pages/Aptitude';
import ResumeAnalyzer from './pages/ResumeAnalyzer';

// Protects routes — redirects to login if not authenticated
const ProtectedRoute = ({ user, children }) => {
  if (!user) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f1f5f9' }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
        <Route path="/interview" element={<ProtectedRoute user={user}><Interview /></ProtectedRoute>} />
        <Route path="/sessions/:id" element={<ProtectedRoute user={user}><SessionDetails /></ProtectedRoute>} />
        <Route path="/aptitude" element={<ProtectedRoute user={user}><Aptitude /></ProtectedRoute>} />
        <Route path="/resume-analyzer" element={<ProtectedRoute user={user}><ResumeAnalyzer /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
