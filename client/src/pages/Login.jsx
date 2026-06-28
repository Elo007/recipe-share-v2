import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <span className="eyebrow">Welcome back</span>
      <h1>Log in</h1>
      <div className="auth-card">
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username or email</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
      <p className="auth-switch">New here? <Link to="/signup">Create an account</Link></p>
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
        Demo accounts (password <strong>password123</strong>): <strong>chefmaria</strong>, <strong>jakethebaker</strong>, <strong>sophiecooks</strong>, <strong>davidgrills</strong>
      </p>
    </div>
  );
}
