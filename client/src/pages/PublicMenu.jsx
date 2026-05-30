import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import api from '../api';

// Preço unitário de uma entrada do carrinho (base + acréscimos das opções)
const calcularPrecoUnitario = (entrada) => {
  const acrescimos = (entrada.opcoesGrupos || []).reduce(
    (soma, g) => soma + g.opcoesSelecionadas.reduce((s, o) => s + parseFloat(o.acrescimo || 0), 0),
    0
  );
  return parseFloat(entrada.price) + acrescimos;
};

const formatarPreco = (valor) => parseFloat(valor).toFixed(2).replace('.', ',');

export default function PublicMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);

  const [carrinho, setCarrinho] = useState(() => {
    try {
      const saved = localStorage.getItem(`menuqr_cart_${slug}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Modal de produto
  const [itemModal, setItemModal] = useState(null);
  const [selecoes, setSelecoes] = useState({});   // { groupId: optionId[] }
  const [qtdModal, setQtdModal] = useState(1);

  const [corte, setCorte] = useState(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const navRef = useRef(null);
  const measureRef = useRef(null);

  useEffect(() => {
    api.get(`/menu/${slug}`)
      .then(({ data }) => {
        setMenu(data);
        if (data.categories.length > 0) setCategoriaAtiva(data.categories[0].id);
      })
      .catch(() => setNaoEncontrado(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  useEffect(() => {
    try { localStorage.setItem(`menuqr_cart_${slug}`, JSON.stringify(carrinho)); } catch {}
  }, [carrinho, slug]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const calcularCorte = useCallback(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure || !measure.children.length) return;
    const navWidth = nav.offsetWidth;
    const GAP = 18, MAIS_WIDTH = 72;
    const tabs = Array.from(measure.children);
    let usado = 0, novoCorte = tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const w = tabs[i].offsetWidth;
      const eUltimo = i === tabs.length - 1;
      if (usado + w + (eUltimo ? 0 : GAP + MAIS_WIDTH) > navWidth) { novoCorte = i; break; }
      usado += w + GAP;
    }
    setCorte(novoCorte < tabs.length ? novoCorte : null);
  }, []);

  useEffect(() => {
    if (!menu) return;
    calcularCorte();
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(calcularCorte);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [menu, calcularCorte]);

  useEffect(() => {
    if (!dropdownAberto) return;
    const handler = (e) => { if (!e.target.closest('.cat-mais-wrapper')) setDropdownAberto(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [dropdownAberto]);

  // ── Carrinho ────────────────────────────────────────────────────────────────

  const totalDoCarrinho = carrinho.reduce((soma, e) => soma + calcularPrecoUnitario(e) * e.qty, 0);
  const quantidadeNoCarrinho = carrinho.reduce((soma, e) => soma + e.qty, 0);

  const adicionarSemOpcoes = (item) => {
    setCarrinho((prev) => {
      const existente = prev.find((e) => e.uid === item.id);
      if (existente) return prev.map((e) => e.uid === item.id ? { ...e, qty: e.qty + 1 } : e);
      return [...prev, { uid: item.id, id: item.id, name: item.name, price: item.price, qty: 1, opcoesGrupos: [] }];
    });
  };

  const removerSemOpcoes = (itemId) => {
    setCarrinho((prev) => {
      const existente = prev.find((e) => e.uid === itemId);
      if (existente?.qty === 1) return prev.filter((e) => e.uid !== itemId);
      return prev.map((e) => e.uid === itemId ? { ...e, qty: e.qty - 1 } : e);
    });
  };

  const incrementarEntrada = (uid) =>
    setCarrinho((prev) => prev.map((e) => e.uid === uid ? { ...e, qty: e.qty + 1 } : e));

  const decrementarEntrada = (uid) =>
    setCarrinho((prev) => {
      const e = prev.find((x) => x.uid === uid);
      if (e?.qty === 1) return prev.filter((x) => x.uid !== uid);
      return prev.map((x) => x.uid === uid ? { ...x, qty: x.qty - 1 } : x);
    });

  const limparCarrinho = () => { setCarrinho([]); setConfirmandoLimpeza(false); };

  const fecharCarrinho = () => { setCarrinhoAberto(false); setConfirmandoLimpeza(false); };

  const enviarPedidoWhatsApp = () => {
    if (!menu?.restaurant?.whatsapp) return;
    const linhas = carrinho.map((e) => {
      const opStr = (e.opcoesGrupos || [])
        .filter((g) => g.opcoesSelecionadas.length > 0)
        .map((g) => g.opcoesSelecionadas.map((o) => o.opcaoNome).join(', '))
        .join(' · ');
      const preco = (calcularPrecoUnitario(e) * e.qty).toFixed(2);
      return `• ${e.name}${opStr ? ` (${opStr})` : ''} x${e.qty} — R$ ${preco}`;
    });
    const mensagem = [`Olá! Gostaria de fazer um pedido:`, '', ...linhas, '', `*Total: R$ ${totalDoCarrinho.toFixed(2)}*`].join('\n');
    window.open(`https://wa.me/55${menu.restaurant.whatsapp}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // ── Modal de produto ────────────────────────────────────────────────────────

  const abrirModal = (item) => {
    setItemModal(item);
    setSelecoes({});
    setQtdModal(1);
  };

  const fecharModal = () => setItemModal(null);

  const toggleOpcao = (grupo, opcaoId) => {
    const atual = selecoes[grupo.id] || [];
    if (grupo.max_qty === 1) {
      // radio: substitui
      setSelecoes({ ...selecoes, [grupo.id]: [opcaoId] });
    } else {
      // checkbox: adiciona/remove até max_qty
      if (atual.includes(opcaoId)) {
        setSelecoes({ ...selecoes, [grupo.id]: atual.filter((id) => id !== opcaoId) });
      } else if (atual.length < grupo.max_qty) {
        setSelecoes({ ...selecoes, [grupo.id]: [...atual, opcaoId] });
      }
    }
  };

  const modalValido = () => {
    if (!itemModal) return false;
    return (itemModal.option_groups || []).every((g) => {
      if (!g.required) return true;
      return (selecoes[g.id] || []).length >= (g.min_qty || 1);
    });
  };

  const precoModal = () => {
    if (!itemModal) return 0;
    const acrescimos = (itemModal.option_groups || []).reduce((soma, g) => {
      return soma + (selecoes[g.id] || []).reduce((s, optId) => {
        const opt = g.options.find((o) => o.id === optId);
        return s + parseFloat(opt?.price_add || 0);
      }, 0);
    }, 0);
    return (parseFloat(itemModal.price) + acrescimos) * qtdModal;
  };

  const adicionarDoModal = () => {
    if (!modalValido()) return;
    const opcoesGrupos = (itemModal.option_groups || []).map((g) => ({
      grupoId: g.id,
      grupoNome: g.name,
      opcoesSelecionadas: (selecoes[g.id] || []).map((optId) => {
        const opt = g.options.find((o) => o.id === optId);
        return { opcaoId: optId, opcaoNome: opt?.name || '', acrescimo: opt?.price_add || 0 };
      }),
    }));

    // fingerprint para deduplicar entradas com as mesmas opções
    const fp = opcoesGrupos.map((g) => g.opcoesSelecionadas.map((o) => o.opcaoId).join(',')).join('|');
    const uid = `${itemModal.id}_${fp}`;

    setCarrinho((prev) => {
      const existente = prev.find((e) => e.uid === uid);
      if (existente) return prev.map((e) => e.uid === uid ? { ...e, qty: e.qty + qtdModal } : e);
      return [...prev, { uid, id: itemModal.id, name: itemModal.name, price: itemModal.price, qty: qtdModal, opcoesGrupos }];
    });
    fecharModal();
  };

  // ────────────────────────────────────────────────────────────────────────────

  if (carregando) return (
    <div className="public-loading"><div className="spinner" /><p>Carregando cardápio...</p></div>
  );
  if (naoEncontrado) return (
    <div className="public-notfound"><h2>Cardápio não encontrado</h2><p>O link que você acessou não existe ou foi removido.</p></div>
  );

  const { restaurant, categories } = menu;

  return (
    <div className="public-menu">
      {/* ── Cabeçalho ────────────────────────────────────────── */}
      <header className="public-header">
        <div className="restaurant-row">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="public-logo" />
          ) : (
            <div className="public-logo" style={{ background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 28 }}>
              {restaurant.name.charAt(0)}
            </div>
          )}
          <div>
            <div style={{ font: '500 11px var(--sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>Cardápio</div>
            <h1>{restaurant.name}</h1>
          </div>
        </div>
      </header>

      {categories.length === 0 ? (
        <div className="public-empty">Cardápio em breve...</div>
      ) : (
        <>
          {/* ── Abas de categoria ──────────────────────────── */}
          <div ref={measureRef} className="cat-measure" aria-hidden="true">
            {categories.map((cat) => <button key={cat.id} className="cat-tab">{cat.name}</button>)}
          </div>
          <nav ref={navRef} className="category-nav">
            {categories.map((cat, i) =>
              corte === null || i < corte ? (
                <button key={cat.id} className={`cat-tab ${categoriaAtiva === cat.id ? 'active' : ''}`}
                  onClick={() => setCategoriaAtiva(cat.id)}>{cat.name}</button>
              ) : null
            )}
            {corte !== null && (
              <div className="cat-mais-wrapper">
                <button className={`cat-mais ${categories.slice(corte).some((c) => c.id === categoriaAtiva) ? 'active' : ''}`}
                  onClick={() => setDropdownAberto((a) => !a)}>
                  {categories.slice(corte).some((c) => c.id === categoriaAtiva)
                    ? categories.find((c) => c.id === categoriaAtiva)?.name : 'Mais'} ▾
                </button>
                {dropdownAberto && (
                  <div className="cat-dropdown">
                    {categories.slice(corte).map((cat) => (
                      <button key={cat.id} className={`cat-dropdown-item ${categoriaAtiva === cat.id ? 'active' : ''}`}
                        onClick={() => { setCategoriaAtiva(cat.id); setDropdownAberto(false); }}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* ── Itens ──────────────────────────────────────── */}
          <div className="menu-content">
            {categories.map((categoria) => (
              <section key={categoria.id} className={`category-section ${categoriaAtiva === categoria.id ? '' : 'hidden'}`}>
                <div className="category-header">
                  <div className="category-eyebrow">{categoria.items.length} {categoria.items.length === 1 ? 'item' : 'itens'}</div>
                  <div className="category-title-serif">{categoria.name}</div>
                </div>
                {categoria.items.length === 0 ? (
                  <p className="public-empty-cat">Nenhum item disponível nesta categoria.</p>
                ) : (
                  <div className="menu-list">
                    {categoria.items.map((item) => {
                      const temOpcoes = item.option_groups?.length > 0;
                      const entradaSemOpcoes = !temOpcoes ? carrinho.find((e) => e.uid === item.id) : null;
                      return (
                        <div key={item.id} className="menu-item">
                          <div className="menu-item-body">
                            <div className="menu-item-row">
                              <span className="menu-item-name">{item.name}</span>
                              <span className="menu-item-leader" aria-hidden="true" />
                              <span className="menu-item-price">R$ {formatarPreco(item.price)}</span>
                            </div>
                            {item.description && <p className="menu-item-desc">{item.description}</p>}
                            {restaurant.whatsapp && (
                              temOpcoes ? (
                                <button className="menu-item-add" onClick={() => abrirModal(item)}>
                                  + Escolher
                                </button>
                              ) : entradaSemOpcoes ? (
                                <div className="qty-control">
                                  <button className="qty-btn" onClick={() => removerSemOpcoes(item.id)}>−</button>
                                  <span className="qty-value">{entradaSemOpcoes.qty}</span>
                                  <button className="qty-btn" onClick={() => adicionarSemOpcoes(item)}>+</button>
                                </div>
                              ) : (
                                <button className="menu-item-add" onClick={() => adicionarSemOpcoes(item)}>
                                  + Adicionar
                                </button>
                              )
                            )}
                          </div>
                          {item.image_url && (
                            <img className="menu-item-photo" src={item.image_url} alt={item.name}
                              onClick={temOpcoes ? () => abrirModal(item) : undefined}
                              style={temOpcoes ? { cursor: 'pointer' } : undefined} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {/* ── FAB (mobile) via portal ───────────────────────── */}
      {restaurant.whatsapp && isMobile && createPortal(
        <button className="cart-fab" onClick={() => setCarrinhoAberto(true)}
          aria-label={quantidadeNoCarrinho > 0 ? `Ver carrinho — ${quantidadeNoCarrinho} itens` : 'Carrinho vazio'}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
          </svg>
          {quantidadeNoCarrinho > 0 && <span className="cart-fab-count">{quantidadeNoCarrinho}</span>}
        </button>,
        document.body
      )}

      {/* ── Barra inferior (tablet/pc) ───────────────────── */}
      {restaurant.whatsapp && !isMobile && (
        <div className="order-bar">
          {carrinho.length === 0 ? (
            <div className="order-bar-empty">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
              </svg>
              Seu pedido está vazio
            </div>
          ) : (
            <button className="order-bar-btn" onClick={() => setCarrinhoAberto(true)}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span className="order-bar-count">{quantidadeNoCarrinho}</span>Ver pedido
              </span>
              <span className="order-bar-total">R$ {formatarPreco(totalDoCarrinho)}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Gaveta do carrinho ────────────────────────────── */}
      {carrinhoAberto && (
        <div className="cart-overlay" onClick={fecharCarrinho}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <div>
                <div style={{ font: '500 11px var(--sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>Seu pedido</div>
                <h3>Comanda</h3>
              </div>
              <button className="cart-close" onClick={fecharCarrinho}>✕</button>
            </div>

            <div className="cart-items">
              {carrinho.map((entrada) => (
                <div key={entrada.uid} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{entrada.name}</span>
                    {entrada.opcoesGrupos?.some((g) => g.opcoesSelecionadas.length > 0) && (
                      <span className="cart-item-opcoes">
                        {entrada.opcoesGrupos
                          .filter((g) => g.opcoesSelecionadas.length > 0)
                          .map((g) => g.opcoesSelecionadas.map((o) => o.opcaoNome).join(', '))
                          .join(' · ')}
                      </span>
                    )}
                    <span className="cart-item-price">
                      R$ {formatarPreco(calcularPrecoUnitario(entrada) * entrada.qty)}
                    </span>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => decrementarEntrada(entrada.uid)}>−</button>
                    <span className="qty-value">{entrada.qty}</span>
                    <button className="qty-btn" onClick={() => incrementarEntrada(entrada.uid)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <strong>R$ {formatarPreco(totalDoCarrinho)}</strong>
              </div>
              <button className="btn-whatsapp" onClick={enviarPedidoWhatsApp}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.4-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.5.6 2.1.7 2.9.5.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.6-.2zM12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.4C8.8 21.5 10.4 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z" />
                </svg>
                Pedir via WhatsApp
              </button>
              {confirmandoLimpeza ? (
                <div className="btn-clear-confirm">
                  <span>Limpar o carrinho?</span>
                  <div className="btn-clear-confirm-actions">
                    <button className="btn-clear-sim" onClick={limparCarrinho}>Sim, limpar</button>
                    <button className="btn-clear-nao" onClick={() => setConfirmandoLimpeza(false)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn-clear" onClick={() => setConfirmandoLimpeza(true)}>Limpar carrinho</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de produto (com opções) ─────────────────── */}
      {itemModal && (
        <div className="produto-modal-overlay" onClick={fecharModal}>
          <div className="produto-modal" onClick={(e) => e.stopPropagation()}>
            {/* Scroll area */}
            <div className="produto-modal-scroll">
              {itemModal.image_url && (
                <img className="produto-modal-foto" src={itemModal.image_url} alt={itemModal.name} />
              )}
              <div className="produto-modal-info">
                <h2 className="produto-modal-nome">{itemModal.name}</h2>
                {itemModal.description && <p className="produto-modal-desc">{itemModal.description}</p>}
                <span className="produto-modal-preco-base">A partir de R$ {formatarPreco(itemModal.price)}</span>
              </div>

              {(itemModal.option_groups || []).map((grupo) => {
                const sels = selecoes[grupo.id] || [];
                return (
                  <div key={grupo.id} className="option-group">
                    <div className="option-group-header">
                      <span className="option-group-nome">{grupo.name}</span>
                      <span className={`option-group-tag ${grupo.required ? 'required' : 'optional'}`}>
                        {grupo.required ? 'Obrigatório' : 'Opcional'}
                      </span>
                    </div>
                    <div className="option-group-hint">
                      {grupo.max_qty === 1 ? 'Escolha 1 opção' : `Escolha até ${grupo.max_qty} opções`}
                    </div>

                    {grupo.options.map((opt) => {
                      const selecionado = sels.includes(opt.id);
                      const desabilitado = !selecionado && sels.length >= grupo.max_qty;
                      return (
                        <label key={opt.id} className={`option-label ${selecionado ? 'selected' : ''} ${desabilitado ? 'disabled' : ''}`}>
                          <input
                            type={grupo.max_qty === 1 ? 'radio' : 'checkbox'}
                            name={`group_${grupo.id}`}
                            checked={selecionado}
                            disabled={desabilitado}
                            onChange={() => toggleOpcao(grupo, opt.id)}
                          />
                          <span className="option-check" />
                          <span className="option-nome">{opt.name}</span>
                          <span className="option-price">
                            {parseFloat(opt.price_add) > 0 ? `+R$ ${formatarPreco(opt.price_add)}` : 'Grátis'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer fixo */}
            <div className="produto-modal-footer">
              <div className="produto-modal-qty">
                <button className="qty-btn" onClick={() => setQtdModal((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-value">{qtdModal}</span>
                <button className="qty-btn" onClick={() => setQtdModal((q) => q + 1)}>+</button>
              </div>
              <button
                className={`produto-modal-add-btn ${!modalValido() ? 'disabled' : ''}`}
                onClick={adicionarDoModal}
                disabled={!modalValido()}
              >
                Adicionar · R$ {formatarPreco(precoModal())}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="public-footer">
        <p>Cardápio digital por <strong>MenuQR</strong></p>
      </footer>
    </div>
  );
}
