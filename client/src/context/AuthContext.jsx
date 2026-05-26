import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Recupera apenas os dados de exibição (nome/email/id) do localStorage.
    // O token de autenticação fica em um cookie HttpOnly — o JavaScript não tem acesso a ele.
    const dadosSalvos = localStorage.getItem('user');
    if (dadosSalvos) {
      try {
        setUsuario(JSON.parse(dadosSalvos));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setCarregando(false);
  }, []);

  // Chamado após login ou cadastro bem-sucedido — salva apenas os dados do usuário (sem token)
  const login = (dadosDoUsuario) => {
    localStorage.setItem('user', JSON.stringify(dadosDoUsuario));
    setUsuario(dadosDoUsuario);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout'); // remove o cookie HttpOnly no servidor
    } catch {
      // mesmo com erro na API, limpa o estado local
    }
    localStorage.removeItem('user');
    setUsuario(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user: usuario, login, logout, loading: carregando }}>
      {!carregando && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
