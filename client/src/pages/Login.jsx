import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [emailNaoVerificado, setEmailNaoVerificado] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailNaoVerificado(false);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNaoVerificado(true);
      } else {
        setError(err.response?.data?.error || 'Erro ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', color: 'var(--tomate)', letterSpacing: '-0.8px', lineHeight: 1 }}>Menu</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.8px', lineHeight: 1 }}>QR</span>
        </div>
        <p className="auth-subtitle">Cardápio digital para restaurantes brasileiros</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {emailNaoVerificado && (
            <div className="error-message" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>Email não confirmado. Verifique sua caixa de entrada.</span>
              <ReenviarLink email={form.email} />
            </div>
          )}

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 14 }}>
          <Link to="/forgot-password" style={{ color: 'var(--ink-3)' }}>Esqueci minha senha</Link>
        </p>
        <p className="auth-link">
          Não tem conta? <Link to="/register">Cadastre-se grátis</Link>
        </p>
      </div>
    </div>
  );
}

function ReenviarLink({ email }) {
  const [estado, setEstado] = useState('idle');

  const reenviar = async () => {
    setEstado('loading');
    try {
      await api.post('/auth/resend-verification', { email });
    } catch { /* silencioso */ }
    setEstado('done');
  };

  if (estado === 'done') return <span style={{ color: 'var(--tomate)', fontSize: 13 }}>Novo link enviado!</span>;
  if (estado === 'loading') return <span style={{ fontSize: 13 }}>Enviando...</span>;
  return (
    <button
      onClick={reenviar}
      style={{ background: 'none', border: 'none', color: 'var(--tomate)', cursor: 'pointer', padding: 0, fontSize: 13, textDecoration: 'underline', textAlign: 'left' }}
    >
      Reenviar email de confirmação
    </button>
  );
}
