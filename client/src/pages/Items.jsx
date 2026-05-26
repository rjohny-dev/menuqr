import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ImageUploadField from '../components/ImageUploadField';
import api from '../api';

const FORMULARIO_VAZIO = { name: '', description: '', price: '', image_url: '' };

export default function Items() {
  const { categoryId } = useParams();
  const [itens, setItens] = useState([]);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarItens();
    carregarNomeDaCategoria();
  }, [categoryId]);

  const carregarItens = async () => {
    try {
      const { data } = await api.get(`/items/category/${categoryId}`);
      setItens(data);
    } catch {
      setErro('Erro ao carregar itens');
    } finally {
      setCarregando(false);
    }
  };

  const carregarNomeDaCategoria = async () => {
    try {
      const { data } = await api.get('/categories');
      const categoriaEncontrada = data.find((c) => c.id === categoryId);
      if (categoriaEncontrada) setNomeCategoria(categoriaEncontrada.name);
    } catch {}
  };

  const salvarItem = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      const dadosParaEnviar = { ...formulario, price: parseFloat(formulario.price) };
      if (idEmEdicao) {
        const { data } = await api.put(`/items/${idEmEdicao}`, dadosParaEnviar);
        setItens(itens.map((i) => (i.id === idEmEdicao ? data : i)));
        setIdEmEdicao(null);
      } else {
        const { data } = await api.post(`/items/category/${categoryId}`, dadosParaEnviar);
        setItens([...itens, data]);
      }
      setFormulario(FORMULARIO_VAZIO);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar item');
    }
  };

  const iniciarEdicao = (item) => {
    setIdEmEdicao(item.id);
    setFormulario({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      image_url: item.image_url || '',
    });
  };

  const cancelarEdicao = () => {
    setIdEmEdicao(null);
    setFormulario(FORMULARIO_VAZIO);
  };

  const alternarStatusDoItem = async (item) => {
    try {
      const { data } = await api.put(`/items/${item.id}`, { active: !item.active });
      setItens(itens.map((i) => (i.id === item.id ? data : i)));
    } catch {
      setErro('Erro ao atualizar item');
    }
  };

  const deletarItem = async (id) => {
    if (!window.confirm('Deletar este item permanentemente?')) return;
    try {
      await api.delete(`/items/${id}`);
      setItens(itens.filter((i) => i.id !== id));
    } catch {
      setErro('Erro ao deletar item');
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <Link to="/categories" className="back-link">← Voltar para categorias</Link>
          <h2>Itens: {nomeCategoria}</h2>
        </div>

        <div className="content-grid">
          <div className="card">
            <h3>{idEmEdicao ? 'Editar Item' : 'Novo Item'}</h3>
            <form onSubmit={salvarItem}>
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formulario.name}
                  onChange={(e) => setFormulario({ ...formulario, name: e.target.value })}
                  placeholder="Ex: X-Burguer especial"
                  required
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={formulario.description}
                  onChange={(e) => setFormulario({ ...formulario, description: e.target.value })}
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
                  value={formulario.price}
                  onChange={(e) => setFormulario({ ...formulario, price: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <ImageUploadField
                label="Foto"
                value={formulario.image_url}
                onChange={(url) => setFormulario({ ...formulario, image_url: url })}
              />
              {erro && <div className="error-message">{erro}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {idEmEdicao ? 'Salvar alterações' : 'Adicionar item'}
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
              <div className="loading">Carregando itens...</div>
            ) : itens.length === 0 ? (
              <div className="empty-state card">
                <p>Nenhum item cadastrado nesta categoria.</p>
              </div>
            ) : (
              <div className="list">
                {itens.map((item) => (
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
                        onClick={() => alternarStatusDoItem(item)}
                      >
                        {item.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="btn-sm btn-secondary" onClick={() => iniciarEdicao(item)}>
                        Editar
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => deletarItem(item.id)}>
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
