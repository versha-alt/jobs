import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { EASE, Icon } from './ui.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordProblem(pw) {
  if (pw.length < 8) return 'At least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Needs at least one letter and one number';
  return null;
}

function PasswordField({ value, onChange, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`auth-input-wrap${invalid ? ' invalid' : ''}`}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        placeholder="Password"
        onChange={(e) => onChange(e.target.value)}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="auth-eye"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (name.trim().length < 2) return setError('Please enter your name (at least 2 characters)');
      if (!EMAIL_RE.test(email.trim())) return setError('Please enter a valid email address');
      const pw = passwordProblem(password);
      if (pw) return setError(`Password too weak — ${pw.toLowerCase()}`);
    } else if (!email.trim() || !password) {
      return setError('Enter your email and password');
    }

    setBusy(true);
    try {
      const data =
        mode === 'signup'
          ? await api.auth.signup({ name: name.trim(), email: email.trim(), password })
          : await api.auth.login({ email: email.trim(), password });
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pwHint = mode === 'signup' && password && passwordProblem(password);

  return (
    <div className="auth-shell">
      <motion.form
        className="card auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="auth-brand">
          <span className="auth-brand-icon">
            <Icon name="zap" size={18} />
          </span>
          Job Portal
        </div>
        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Sign in to see your job runs and alerts.'
            : 'Sign up to start monitoring LinkedIn & Upwork jobs.'}
        </p>

        {mode === 'signup' && (
          <input
            value={name}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          value={email}
          placeholder="Email address"
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <PasswordField value={password} onChange={setPassword} invalid={Boolean(pwHint)} />
        {pwHint && <div className="auth-hint">{pwHint}</div>}

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('signup'); setError(''); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.form>
    </div>
  );
}
