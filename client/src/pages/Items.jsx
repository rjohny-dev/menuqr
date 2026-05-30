import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ImageUploadField from '../components/ImageUploadField';
import api from '../api';

const FORMULARIO_VAZIO = { name: '', description: '', price: '', image_url: '' };
const GRUPO_VAZIO = { name: '', required: false, max_qty: 1 };

export default function Items() {
  const { categoryId } = useParams();
  const [itens, setItens] = useState([]);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Opções do item em edição
  const [gruposDoItem, setGruposDoItem] = useState([]);
  const [novoGrupo, setNovoGrupo] = useState(GRUPO_VAZIO);
  const [novaOpcaoPorGrupo, setNovaOpcaoPorGrupo] = useState({});
  const [grupoExpandido, setGrupoExpandido] = useState(null);
  const [erroOpcoes, setErroOpcoes] = useState('');

  useEffect(() => {
    carregarItens();
    carregarNomeDaCategoria();
  }, [categoryId]);

  useEffect(() => {
    if (!idEmEdicao) { setGruposDoItem([]); setNovoGrupo(GRUPO_VAZIO); return; }
    api.get(`/option-groups/item/${idEmEdicao}`)
      .then(({ data }) => setGruposDoItem(data))
      .catch(() => {});
  }, [idEmEdicao]);

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
      const cat = data.find((c) => c.id === categoryId);
      if (cat) setNomeCategoria(cat.name);
    } catch {}
  };

  const salvarItem = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      const dados = { ...formulario, price: parseFloat(formulario.price) };
      if (idEmEdicao) {
        const { data } = await api.put(`/items/${idEmEdicao}`, dados);
        setItens(itens.map((i) => (i.id === idEmEdicao ? data : i)));
      } else {
        const { data } = await api.post(`/items/category/${categoryId}`, dados);
        setItens([...itens, data]);
        setFormulario(FORMULARIO_VAZIO);
        // Entra automaticamente em modo edição para o painel de opções aparecer
        setIdEmEdicao(data.id);
      }
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
    setGrupoExpandido(null);
  };

  const cancelarEdicao = () => {
    setIdEmEdicao(null);
    setFormulario(FORMULARIO_VAZIO);
    setGruposDoItem([]);
    setGrupoExpandido(null);
  };

  const alternarStatus = async (item) => {
    try {
      const { data } = await api.put(`/items/${item.id}`, { active: !item.active });
      setItens(itens.map((i) => (i.id === item.id ? data : i)));
    } catch { setErro('Erro ao atualizar item'); }
  };

  const deletarItem = async (id) => {
    if (!window.confirm('Deletar este item permanentemente?')) return;
    try {
      await api.delete(`/items/${id}`);
      setItens(itens.filter((i) => i.id !== id));
      if (idEmEdicao === id) cancelarEdicao();
    } catch { setErro('Erro ao deletar item'); }
  };

  // ── Grupos ──────────────────────────────────────────────────────────────────

  const adicionarGrupo = async (e) => {
    e.preventDefault();
    if (!novoGrupo.name.trim()) return;
    setErroOpcoes('');
    try {
      const { data } = await api.post(`/option-groups/item/${idEmEdicao}`, {
        name: novoGrupo.name.trim(),
        required: novoGrupo.required,
        max_qty: parseInt(novoGrupo.max_qty) || 1,
        min_qty: novoGrupo.required ? 1 : 0,
      });
      setGruposDoItem([...gruposDoItem, data]);
      setNovoGrupo(GRUPO_VAZIO);
      setGrupoExpandido(data.id);
    } catch (err) {
      setErroOpcoes(err.response?.data?.error || 'Erro ao criar grupo. Tente novamente.');
    }
  };

  const deletarGrupo = async (groupId) => {
    if (!window.confirm('Deletar este grupo e todas as suas opções?')) return;
    try {
      await api.delete(`/option-groups/${groupId}`);
      setGruposDoItem(gruposDoItem.filter((g) => g.id !== groupId));
      if (grupoExpandido === groupId) setGrupoExpandido(null);
    } catch (err) {
      setErroOpcoes(err.response?.data?.error || 'Erro ao deletar grupo.');
    }
  };

  // ── Opções ──────────────────────────────────────────────────────────────────

  const adicionarOpcao = async (e, groupId) => {
    e.preventDefault();
    const form = novaOpcaoPorGrupo[groupId] || {};
    if (!form.name?.trim()) return;
    setErroOpcoes('');
    try {
      const { data } = await api.post(`/option-groups/${groupId}/options`, {
        name: form.name.trim(),
        price_add: parseFloat(form.price_add) || 0,
      });
      setGruposDoItem(gruposDoItem.map((g) =>
        g.id === groupId ? { ...g, options: [...g.options, data] } : g
      ));
      setNovaOpcaoPorGrupo({ ...novaOpcaoPorGrupo, [groupId]: { name: '', price_add: '' } });
    } catch (err) {
      setErroOpcoes(err.response?.data?.error || 'Erro ao criar opção. Tente novamente.');
    }
  };

  const deletarOpcao = async (groupId, optionId) => {
    try {
      await api.delete(`/option-groups/options/${optionId}`);
      setGruposDoItem(gruposDoItem.map((g) =>
        g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
      ));
    } catch (err) {
      setErroOpcoes(err.response?.data?.error || 'Erro ao deletar opção.');
    }
  };

  const setOpcaoForm = (groupId, field, value) =>
    setNovaOpcaoPorGrupo({ ...novaOpcaoPorGrupo, [groupId]: { ...(novaOpcaoPorGrupo[groupId] || {}), [field]: value } });

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <Link to="/categories" className="back-link">← Voltar para categorias</Link>
          <h2>Itens: {nomeCategoria}</h2>
        </div>

        <div className="content-grid">
          {/* ── Formulário de item ──────────────────────────── */}
          <div>
            <div className="card">
              <h3>{idEmEdicao ? 'Editar Item' : 'Novo Item'}</h3>
              <form onSubmit={salvarItem}>
                <div className="form-group">
                  <label>Nome *</label>
                  <input type="text" value={formulario.name}
                    onChange={(e) => setFormulario({ ...formulario, name: e.target.value })}
                    placeholder="Ex: X-Burguer especial" required />
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <textarea value={formulario.description}
                    onChange={(e) => setFormulario({ ...formulario, description: e.target.value })}
                    placeholder="Ingredientes, tamanho, observações..." rows={3} />
                </div>
                <div className="form-group">
                  <label>Preço (R$) *</label>
                  <input type="number" step="0.01" min="0" value={formulario.price}
                    onChange={(e) => setFormulario({ ...formulario, price: e.target.value })}
                    placeholder="0,00" required />
                </div>
                <ImageUploadField label="Foto" value={formulario.image_url}
                  onChange={(url) => setFormulario({ ...formulario, image_url: url })} />
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

            {/* ── Painel de opções (só ao editar) ────────────── */}
            {idEmEdicao && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 4 }}>Opções do produto</h3>
                <p style={{ font: '13px var(--sans)', color: 'var(--ink-3)', marginBottom: 16 }}>
                  Grupos de escolha: tamanho, sabor, complementos, etc.
                </p>

                {gruposDoItem.map((grupo) => (
                  <div key={grupo.id} className="opcao-grupo">
                    <div className="opcao-grupo-header">
                      <button type="button" className="opcao-grupo-toggle"
                        onClick={() => setGrupoExpandido(grupoExpandido === grupo.id ? null : grupo.id)}>
                        <span className="opcao-grupo-nome">{grupo.name}</span>
                        <span className="opcao-grupo-meta">
                          {grupo.required ? 'Obrigatório' : 'Opcional'} · máx {grupo.max_qty}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
                          {grupoExpandido === grupo.id ? '▲' : '▼'}
                        </span>
                      </button>
                      <button type="button" className="opcao-grupo-del"
                        onClick={() => deletarGrupo(grupo.id)} title="Deletar grupo">✕</button>
                    </div>

                    {grupoExpandido === grupo.id && (
                      <div className="opcao-grupo-body">
                        {grupo.options.length === 0 ? (
                          <p style={{ font: 'italic 13px var(--serif)', color: 'var(--ink-3)', padding: '6px 0' }}>
                            Nenhuma opção ainda.
                          </p>
                        ) : (
                          grupo.options.map((opt) => (
                            <div key={opt.id} className="opcao-item">
                              <span className="opcao-item-nome">{opt.name}</span>
                              <span className="opcao-item-preco">
                                {parseFloat(opt.price_add) > 0
                                  ? `+R$ ${parseFloat(opt.price_add).toFixed(2).replace('.', ',')}`
                                  : 'Grátis'}
                              </span>
                              <button type="button" className="opcao-item-del"
                                onClick={() => deletarOpcao(grupo.id, opt.id)}>✕</button>
                            </div>
                          ))
                        )}
                        <form className="opcao-nova-form" onSubmit={(e) => adicionarOpcao(e, grupo.id)}>
                          <input type="text" placeholder="Nome da opção"
                            value={novaOpcaoPorGrupo[grupo.id]?.name || ''}
                            onChange={(e) => setOpcaoForm(grupo.id, 'name', e.target.value)} />
                          <input type="number" step="0.01" min="0" placeholder="Acréscimo R$"
                            value={novaOpcaoPorGrupo[grupo.id]?.price_add || ''}
                            onChange={(e) => setOpcaoForm(grupo.id, 'price_add', e.target.value)} />
                          <button type="submit" className="btn-primary btn-sm">+ Opção</button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}

                {erroOpcoes && (
                  <div className="error-message" style={{ marginBottom: 12 }}>{erroOpcoes}</div>
                )}

                <form className="opcao-grupo-novo-form" onSubmit={adicionarGrupo}>
                  <div className="opcao-grupo-novo-titulo">Novo grupo</div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <input type="text" placeholder="Nome (ex: Sabor, Tamanho, Complementos)"
                      value={novoGrupo.name}
                      onChange={(e) => setNovoGrupo({ ...novoGrupo, name: e.target.value })} />
                  </div>
                  <div className="opcao-grupo-novo-controles">
                    <label className="opcao-grupo-check-label">
                      <input type="checkbox" checked={novoGrupo.required}
                        onChange={(e) => setNovoGrupo({ ...novoGrupo, required: e.target.checked })} />
                      Obrigatório
                    </label>
                    <label className="opcao-grupo-maxqty-label">
                      Máx. seleções:
                      <input type="number" min="1" max="20"
                        value={novoGrupo.max_qty}
                        onChange={(e) => setNovoGrupo({ ...novoGrupo, max_qty: e.target.value })} />
                    </label>
                  </div>
                  <button type="submit" className="btn-secondary btn-sm">+ Adicionar grupo</button>
                </form>
              </div>
            )}
          </div>

          {/* ── Lista de itens ──────────────────────────────── */}
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
                      {item.description && <p className="text-muted">{item.description}</p>}
                      <div className="item-meta">
                        <span className="price">R$ {parseFloat(item.price).toFixed(2)}</span>
                        {!item.active && <span className="badge-inactive">Inativo</span>}
                      </div>
                    </div>
                    <div className="list-item-actions">
                      <button className={`btn-sm ${item.active ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => alternarStatus(item)}>
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
