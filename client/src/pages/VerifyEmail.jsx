import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [estado, setEstado] = useState('carregando'); // carregando | sucesso | erro
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) { setEstado('erro'); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setEstado('sucesso'))
      .catch(() => setEstado('erro'));
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {estado === 'carregando' && (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--ink-3)' }}>Verificando seu email...</p>
          </>
        )}
        {estado === 'sucesso' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8 }}>
              Email confirmado!
            </h2>
            <p style={{ color: 'var(--ink-3)', marginBottom: 24 }}>
              Sua conta está ativa. Faça login para começar.
            </p>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Fazer login
            </Link>
          </>
        )}
        {estado === 'erro' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8 }}>
              Link inválido ou expirado
            </h2>
            <p style={{ color: 'var(--ink-3)', marginBottom: 24 }}>
              O link de confirmação expirou ou já foi usado. Faça login para solicitar um novo.
            </p>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Ir para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
