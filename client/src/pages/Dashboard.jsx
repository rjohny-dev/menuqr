import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '../components/Navbar';
import api from '../api';

export default function Dashboard() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/restaurant')
      .then(({ data }) => setRestaurant(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const menuUrl = restaurant
    ? `${window.location.origin}/menu/${restaurant.slug}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-container"><div className="loading">Carregando...</div></div>
      </>
    );
  }

  if (!restaurant) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="empty-state card">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
            <h2>Bem-vindo ao MenuQR!</h2>
            <p>Configure seu restaurante para gerar seu cardápio digital e QR Code.</p>
            <Link to="/settings" className="btn-primary" style={{ marginTop: '1rem' }}>
              Configurar Restaurante
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="dashboard-header">
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt="Logo" className="restaurant-logo" />
          )}
          <div>
            <h1>{restaurant.name}</h1>
            <p className="text-muted">menuqr.app/menu/{restaurant.slug}</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <h3>QR Code do Cardápio</h3>
            <div className="qr-container">
              <QRCodeSVG
                value={menuUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#1e293b"
                level="M"
              />
            </div>
            <p className="qr-link">
              <a href={menuUrl} target="_blank" rel="noreferrer">{menuUrl}</a>
            </p>
            <div className="qr-actions">
              <button className="btn-secondary" onClick={handleCopy}>
                {copied ? '✓ Copiado!' : 'Copiar Link'}
              </button>
              <a href={menuUrl} target="_blank" rel="noreferrer" className="btn-primary">
                Abrir Cardápio
              </a>
            </div>
          </div>

          <div className="card">
            <h3>Ações Rápidas</h3>
            <div className="quick-actions">
              <Link to="/categories" className="action-item">
                <span className="action-icon">🗂️</span>
                <div>
                  <strong>Gerenciar Categorias</strong>
                  <p>Organize lanches, bebidas, sobremesas...</p>
                </div>
              </Link>
              <Link to="/settings" className="action-item">
                <span className="action-icon">⚙️</span>
                <div>
                  <strong>Configurações</strong>
                  <p>Nome, slug e logo do restaurante</p>
                </div>
              </Link>
              <a href={menuUrl} target="_blank" rel="noreferrer" className="action-item">
                <span className="action-icon">👁️</span>
                <div>
                  <strong>Ver como Cliente</strong>
                  <p>Veja o cardápio como seus clientes</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
