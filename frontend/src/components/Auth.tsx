import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Lock, Mail, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import tenderiqLogo from '../assets/tenderiq_logo.png';
import { useNotification } from './NotificationProvider';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const { showToast } = useNotification();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        showToast("Registration successful! Please check your email for verification.", "success");
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container" style={{ flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
            <img src={tenderiqLogo} alt="TenderIQ Logo" style={{ width: '80px', height: '80px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)' }} />
            <span className="logo-text">TenderIQ</span>
          </div>
          <p className="auth-subtitle">
            {isSignUp ? 'Create a secure enterprise workspace' : 'Procurement Intelligence Portal'}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            color: '#ef4444',
            fontSize: '13px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', color: '#6b7280' }} />
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', color: '#6b7280' }} />
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="loading-dots">
                Please wait<span></span><span></span><span></span>
              </span>
            ) : isSignUp ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <UserPlus size={16} /> Sign Up
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <LogIn size={16} /> Sign In
              </span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <span className="auth-link" onClick={() => setIsSignUp(false)}>
                Sign In
              </span>
            </p>
          ) : (
            <p>
              New to TenderIQ?{' '}
              <span className="auth-link" onClick={() => setIsSignUp(true)}>
                Create Account
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
