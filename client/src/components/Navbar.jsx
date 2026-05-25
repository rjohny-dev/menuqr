import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">
          <span style={{ fontStyle: 'italic', color: 'var(--tomate)' }}>Menu</span>
          <span style={{ color: 'var(--ink)' }}>QR</span>
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
          Dashboard
        </Link>
        <Link to="/categories" className={isActive('/categories') ? 'active' : ''}>
          Cardápio
        </Link>
        <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>
          Configurações
        </Link>
        <span className="navbar-user">{user?.name}</span>
        <button onClick={handleLogout} className="btn-logout">Sair</button>
      </div>
    </nav>
  );
}
