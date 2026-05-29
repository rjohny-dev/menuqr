import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch { /* silencioso — não revelar se email existe */ }
    setEnviado(true);
    setLoading(false);
  };

  if (enviado) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8 }}>
            Verifique seu email
          </h2>
          <p style={{ color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
            Se este email estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
          </p>
          <Link to="/login" style={{ color: 'var(--tomate)', fontSize: 14 }}>Voltar para o login</Link>
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
        <p className="auth-subtitle">Redefinir senha</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email da sua conta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </form>
        <p className="auth-link">
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
