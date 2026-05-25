import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '' });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch {
      setError('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) {
        const { data } = await api.put(`/categories/${editId}`, form);
        setCategories(categories.map((c) => (c.id === editId ? data : c)));
        setEditId(null);
      } else {
        const { data } = await api.post('/categories', form);
        setCategories([...categories, data]);
      }
      setForm({ name: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar categoria');
    }
  };

  const handleEdit = (cat) => {
    setEditId(cat.id);
    setForm({ name: cat.name });
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ name: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deletar esta categoria? Todos os itens serão removidos.')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories(categories.filter((c) => c.id !== id));
    } catch {
      setError('Erro ao deletar categoria');
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h2>Categorias do Cardápio</h2>
          <p className="text-muted">Organize seu cardápio em categorias como Lanches, Bebidas, Sobremesas...</p>
        </div>

        <div className="content-grid">
          <div className="card">
            <h3>{editId ? 'Editar Categoria' : 'Nova Categoria'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome da categoria</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  placeholder="Ex: Lanches, Bebidas..."
                  required
                  autoFocus
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editId ? 'Salvar alterações' : 'Adicionar categoria'}
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
              <div className="loading">Carregando categorias...</div>
            ) : categories.length === 0 ? (
              <div className="empty-state card">
                <p>Nenhuma categoria cadastrada ainda.<br />Adicione sua primeira categoria!</p>
              </div>
            ) : (
              <div className="list">
                {categories.map((cat) => (
                  <div key={cat.id} className="list-item">
                    <div className="list-item-icon">🗂️</div>
                    <div className="list-item-info">
                      <strong>{cat.name}</strong>
                    </div>
                    <div className="list-item-actions">
                      <Link
                        to={`/categories/${cat.id}/items`}
                        className="btn-sm btn-primary"
                      >
                        Itens
                      </Link>
                      <button
                        className="btn-sm btn-secondary"
                        onClick={() => handleEdit(cat)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-sm btn-danger"
                        onClick={() => handleDelete(cat.id)}
                      >
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
