import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';

export default function Categories() {
  const [categorias, setCategorias] = useState([]);
  const [formulario, setFormulario] = useState({ name: '' });
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarCategorias();
  }, []);

  const carregarCategorias = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategorias(data);
    } catch {
      setErro('Erro ao carregar categorias');
    } finally {
      setCarregando(false);
    }
  };

  const salvarCategoria = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (idEmEdicao) {
        const { data } = await api.put(`/categories/${idEmEdicao}`, formulario);
        setCategorias(categorias.map((c) => (c.id === idEmEdicao ? data : c)));
        setIdEmEdicao(null);
      } else {
        const { data } = await api.post('/categories', formulario);
        setCategorias([...categorias, data]);
      }
      setFormulario({ name: '' });
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar categoria');
    }
  };

  const iniciarEdicao = (categoria) => {
    setIdEmEdicao(categoria.id);
    setFormulario({ name: categoria.name });
  };

  const cancelarEdicao = () => {
    setIdEmEdicao(null);
    setFormulario({ name: '' });
  };

  const deletarCategoria = async (id) => {
    if (!window.confirm('Deletar esta categoria? Todos os itens serão removidos.')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategorias(categorias.filter((c) => c.id !== id));
    } catch {
      setErro('Erro ao deletar categoria');
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
            <h3>{idEmEdicao ? 'Editar Categoria' : 'Nova Categoria'}</h3>
            <form onSubmit={salvarCategoria}>
              <div className="form-group">
                <label>Nome da categoria</label>
                <input
                  type="text"
                  value={formulario.name}
                  onChange={(e) => setFormulario({ name: e.target.value })}
                  placeholder="Ex: Lanches, Bebidas..."
                  required
                  autoFocus
                />
              </div>
              {erro && <div className="error-message">{erro}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {idEmEdicao ? 'Salvar alterações' : 'Adicionar categoria'}
                </button>
                {idEmEdicao && (
                  <button type="button" className="btn-secondary" onClick={cancelarEdicao}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            {carregando ? (
              <div className="loading">Carregando categorias...</div>
            ) : categorias.length === 0 ? (
              <div className="empty-state card">
                <p>Nenhuma categoria cadastrada ainda.<br />Adicione sua primeira categoria!</p>
              </div>
            ) : (
              <div className="list">
                {categorias.map((categoria) => (
                  <div key={categoria.id} className="list-item">
                    <div className="list-item-icon">🗂️</div>
                    <div className="list-item-info">
                      <strong>{categoria.name}</strong>
                    </div>
                    <div className="list-item-actions">
                      <Link
                        to={`/categories/${categoria.id}/items`}
                        className="btn-sm btn-primary"
                      >
                        Itens
                      </Link>
                      <button
                        className="btn-sm btn-secondary"
                        onClick={() => iniciarEdicao(categoria)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-sm btn-danger"
                        onClick={() => deletarCategoria(categoria.id)}
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
