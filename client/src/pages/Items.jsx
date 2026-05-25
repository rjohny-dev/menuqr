import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ImageUploadField from '../components/ImageUploadField';
import api from '../api';

const EMPTY_FORM = { name: '', description: '', price: '', image_url: '' };

export default function Items() {
  const { categoryId } = useParams();
  const [items, setItems] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems();
    fetchCategoryName();
  }, [categoryId]);

  const fetchItems = async () => {
    try {
      const { data } = await api.get(`/items/category/${categoryId}`);
      setItems(data);
    } catch {
      setError('Erro ao carregar itens');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryName = async () => {
    try {
      const { data } = await api.get('/categories');
      const cat = data.find((c) => c.id === categoryId);
      if (cat) setCategoryName(cat.name);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      if (editId) {
        const { data } = await api.put(`/items/${editId}`, payload);
        setItems(items.map((i) => (i.id === editId ? data : i)));
        setEditId(null);
      } else {
        const { data } = await api.post(`/items/category/${categoryId}`, payload);
        setItems([...items, data]);
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar item');
    }
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      image_url: item.image_url || '',
    });
  };

  const handleCancel = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleToggleActive = async (item) => {
    try {
      const { data } = await api.put(`/items/${item.id}`, { active: !item.active });
      setItems(items.map((i) => (i.id === item.id ? data : i)));
    } catch {
      setError('Erro ao atualizar item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deletar este item permanentemente?')) return;
    try {
      await api.delete(`/items/${id}`);
      setItems(items.filter((i) => i.id !== id));
    } catch {
      setError('Erro ao deletar item');
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <Link to="/categories" className="back-link">← Voltar para categorias</Link>
          <h2>Itens: {categoryName}</h2>
        </div>

        <div className="content-grid">
          <div className="card">
            <h3>{editId ? 'Editar Item' : 'Novo Item'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: X-Burguer especial"
                  required
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ingredientes, tamanho, observações..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <ImageUploadField
                label="Foto"
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
              />
              {error && <div className="error-message">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editId ? 'Salvar alterações' : 'Adicionar item'}
                </button>
                {editId && (
                  <button type="button" className="btn-secondary" onClick={handleCancel}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            {loading ? (
              <div className="loading">Carregando itens...</div>
            ) : items.length === 0 ? (
              <div className="empty-state card">
                <p>Nenhum item cadastrado nesta categoria.</p>
              </div>
            ) : (
              <div className="list">
                {items.map((item) => (
                  <div key={item.id} className={`list-item ${!item.active ? 'inactive' : ''}`}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div className="list-item-info">
                      <strong>{item.name}</strong>
                      {item.description && (
                        <p className="text-muted">{item.description}</p>
                      )}
                      <div className="item-meta">
                        <span className="price">R$ {parseFloat(item.price).toFixed(2)}</span>
                        {!item.active && <span className="badge-inactive">Inativo</span>}
                      </div>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className={`btn-sm ${item.active ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleToggleActive(item)}
                      >
                        {item.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="btn-sm btn-secondary" onClick={() => handleEdit(item)}>
                        Editar
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                        Deletar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
