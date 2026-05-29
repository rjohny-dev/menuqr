import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailCadastrado, setEmailCadastrado] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      setEmailCadastrado(form.email);
      setEmailEnviado(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (emailEnviado) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8 }}>
            Confirme seu email
          </h2>
          <p style={{ color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
            Enviamos um link de confirmação para <strong>{emailCadastrado}</strong>.
            Verifique sua caixa de entrada (e a pasta de spam).
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            Não recebeu?{' '}
            <ReenviarLink email={emailCadastrado} />
          </p>
          <p className="auth-link" style={{ marginTop: 24 }}>
            <Link to="/login">Voltar para o login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', color: 'var(--tomate)', letterSpacing: '-0.8px', lineHeight: 1 }}>Menu</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.8px', lineHeight: 1 }}>QR</span>
        </div>
        <p className="auth-subtitle">Criar conta gratuita</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome completo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Seu nome"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 8 caracteres, 1 maiúscula e 1 número"
              minLength={8}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
        <p className="auth-link">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

function ReenviarLink({ email }) {
  const [estado, setEstado] = useState('idle'); // idle | loading | done

  const reenviar = async () => {
    setEstado('loading');
    try {
      await api.post('/auth/resend-verification', { email });
    } catch { /* silencioso */ }
    setEstado('done');
  };

  if (estado === 'done') return <span style={{ color: 'var(--tomate)' }}>Reenviado!</span>;
  if (estado === 'loading') return <span>Enviando...</span>;
  return (
    <button
      onClick={reenviar}
      style={{ background: 'none', border: 'none', color: 'var(--tomate)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
    >
      Reenviar email
    </button>
  );
}
