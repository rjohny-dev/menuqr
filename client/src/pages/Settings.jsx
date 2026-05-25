import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ImageUploadField from '../components/ImageUploadField';
import api from '../api';

export default function Settings() {
  const [form, setForm] = useState({ name: '', slug: '', logo_url: '', whatsapp: '' });
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/restaurant')
      .then(({ data }) => {
        if (data) {
          setForm({ name: data.name, slug: data.slug, logo_url: data.logo_url || '', whatsapp: data.whatsapp || '' });
        } else {
          setIsNew(true);
        }
      })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false));
  }, []);

  const handleSlugChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setForm((f) => ({ ...f, slug: sanitized }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (isNew) {
        await api.post('/restaurant', form);
        setIsNew(false);
        setSuccess('Restaurante criado com sucesso! Agora adicione categorias e itens ao seu cardápio.');
      } else {
        await api.put('/restaurant', form);
        setSuccess('Configurações salvas com sucesso!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-container"><div className="loading">Carregando...</div></div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h2>Configurações do Restaurante</h2>
          <p className="text-muted">
            {isNew
              ? 'Configure seu restaurante para gerar o cardápio digital'
              : 'Edite as informações do seu restaurante'}
          </p>
        </div>

        <div className="card settings-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome do Restaurante *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Burger House, Pizzaria Roma..."
                required
              />
            </div>

            <div className="form-group">
              <label>Slug (URL do cardápio) *</label>
              <div className="input-prefix-group">
                <span className="input-prefix">/menu/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="burger-house"
                  pattern="[a-z0-9-]+"
                  required
                />
              </div>
              <small className="form-hint">
                Apenas letras minúsculas, números e hífens. Ex: burger-house, pizzaria-roma
              </small>
            </div>

            <div className="form-group">
              <label>WhatsApp do Restaurante</label>
              <div className="input-prefix-group">
                <span className="input-prefix">+55</span>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })}
                  placeholder="11999887766"
                  maxLength={11}
                />
              </div>
              <small className="form-hint">
                DDD + número, somente dígitos. Ex: 11999887766. Usado para receber pedidos.
              </small>
            </div>

            <ImageUploadField
              label="Logo do Restaurante"
              value={form.logo_url}
              onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
            />

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isNew ? 'Criar Restaurante' : 'Salvar Configurações'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
