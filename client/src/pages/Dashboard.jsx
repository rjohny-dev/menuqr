import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '../components/Navbar';
import api from '../api';

export default function Dashboard() {
  const [restaurante, setRestaurante] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    api.get('/restaurant')
      .then(({ data }) => setRestaurante(data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const urlDoCardapio = restaurante
    ? `${window.location.origin}/menu/${restaurante.slug}`
    : '';

  const copiarLink = () => {
    navigator.clipboard.writeText(urlDoCardapio);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  if (carregando) {
    return (
      <>
        <Navbar />
        <div className="page-container"><div className="loading">Carregando...</div></div>
      </>
    );
  }

  if (!restaurante) {
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
          {restaurante.logo_url && (
            <img src={restaurante.logo_url} alt="Logo" className="restaurant-logo" />
          )}
          <div>
            <h1>{restaurante.name}</h1>
            <p className="text-muted">menuqr.app/menu/{restaurante.slug}</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <h3>QR Code do Cardápio</h3>
            <div className="qr-container">
              <QRCodeSVG
                value={urlDoCardapio}
                size={180}
                bgColor="#ffffff"
                fgColor="#1e293b"
                level="M"
              />
            </div>
            <p className="qr-link">
              <a href={urlDoCardapio} target="_blank" rel="noreferrer">{urlDoCardapio}</a>
            </p>
            <div className="qr-actions">
              <button className="btn-secondary" onClick={copiarLink}>
                {linkCopiado ? '✓ Copiado!' : 'Copiar Link'}
              </button>
              <a href={urlDoCardapio} target="_blank" rel="noreferrer" className="btn-primary">
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
              <a href={urlDoCardapio} target="_blank" rel="noreferrer" className="action-item">
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
