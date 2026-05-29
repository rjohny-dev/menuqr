import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { state: { mensagem: 'Senha redefinida com sucesso. Faça login.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-3)' }}>Link inválido.</p>
          <Link to="/forgot-password" style={{ color: 'var(--tomate)' }}>Solicitar novo link</Link>
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
        <p className="auth-subtitle">Nova senha</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres, 1 maiúscula e 1 número"
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Confirmar nova senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              minLength={8}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
