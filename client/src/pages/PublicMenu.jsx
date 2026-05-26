import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PublicMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  useEffect(() => {
    api.get(`/menu/${slug}`)
      .then(({ data }) => {
        setMenu(data);
        if (data.categories.length > 0) {
          setCategoriaAtiva(data.categories[0].id);
        }
      })
      .catch(() => setNaoEncontrado(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  const adicionarAoCarrinho = (item) => {
    setCarrinho((anterior) => {
      const itemExistente = anterior.find((i) => i.id === item.id);
      if (itemExistente) return anterior.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...anterior, { ...item, qty: 1 }];
    });
  };

  const removerDoCarrinho = (idDoItem) => {
    setCarrinho((anterior) => {
      const itemExistente = anterior.find((i) => i.id === idDoItem);
      if (itemExistente?.qty === 1) return anterior.filter((i) => i.id !== idDoItem);
      return anterior.map((i) => i.id === idDoItem ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const limparCarrinho = () => setCarrinho([]);

  const totalDoCarrinho = carrinho.reduce((soma, i) => soma + parseFloat(i.price) * i.qty, 0);
  const quantidadeNoCarrinho = carrinho.reduce((soma, i) => soma + i.qty, 0);

  const formatarPreco = (valor) =>
    parseFloat(valor).toFixed(2).replace('.', ',');

  const enviarPedidoWhatsApp = () => {
    if (!menu?.restaurant?.whatsapp) return;
    const linhasDoPedido = carrinho.map(
      (i) => `• ${i.name} x${i.qty} — R$ ${(parseFloat(i.price) * i.qty).toFixed(2)}`
    );
    const mensagem = [
      `Olá! Gostaria de fazer um pedido:`,
      ``,
      ...linhasDoPedido,
      ``,
      `*Total: R$ ${totalDoCarrinho.toFixed(2)}*`,
    ].join('\n');
    const numero = `55${menu.restaurant.whatsapp}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  if (carregando) {
    return (
      <div className="public-loading">
        <div className="spinner" />
        <p>Carregando cardápio...</p>
      </div>
    );
  }

  if (naoEncontrado) {
    return (
      <div className="public-notfound">
        <h2>Cardápio não encontrado</h2>
        <p>O link que você acessou não existe ou foi removido.</p>
      </div>
    );
  }

  const { restaurant, categories } = menu;

  return (
    <div className="public-menu">
      {/* ── Cabeçalho do restaurante ──────────────────────────── */}
      <header className="public-header">
        <div className="restaurant-row">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="public-logo" />
          ) : (
            <div className="public-logo" style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 28,
            }}>
              {restaurant.name.charAt(0)}
            </div>
          )}
          <div>
            <div style={{
              font: '500 11px var(--sans)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              marginBottom: 4,
            }}>
              Cardápio
            </div>
            <h1>{restaurant.name}</h1>
          </div>
        </div>
      </header>

      {categories.length === 0 ? (
        <div className="public-empty">Cardápio em breve...</div>
      ) : (
        <>
          {/* ── Abas de categoria ─────────────────────────────── */}
          <nav className="category-nav">
            {categories.map((categoria) => (
              <button
                key={categoria.id}
                className={`cat-tab ${categoriaAtiva === categoria.id ? 'active' : ''}`}
                onClick={() => setCategoriaAtiva(categoria.id)}
              >
                {categoria.name}
              </button>
            ))}
          </nav>

          {/* ── Itens do cardápio ─────────────────────────────── */}
          <div className="menu-content">
            {categories.map((categoria) => (
              <section
                key={categoria.id}
                className={`category-section ${categoriaAtiva === categoria.id ? '' : 'hidden'}`}
              >
                <div className="category-header">
                  <div className="category-eyebrow">{categoria.items.length} {categoria.items.length === 1 ? 'item' : 'itens'}</div>
                  <div className="category-title-serif">{categoria.name}</div>
                </div>

                {categoria.items.length === 0 ? (
                  <p className="public-empty-cat">Nenhum item disponível nesta categoria.</p>
                ) : (
                  <div className="menu-list">
                    {categoria.items.map((item) => {
                      const estaNoCarrinho = carrinho.find((i) => i.id === item.id);
                      return (
                        <div key={item.id} className="menu-item">
                          <div className="menu-item-body">
                            <div className="menu-item-row">
                              <span className="menu-item-name">{item.name}</span>
                              <span className="menu-item-leader" aria-hidden="true" />
                              <span className="menu-item-price">R$ {formatarPreco(item.price)}</span>
                            </div>
                            {item.description && (
                              <p className="menu-item-desc">{item.description}</p>
                            )}
                            {restaurant.whatsapp && (
                              estaNoCarrinho ? (
                                <div className="qty-control">
                                  <button className="qty-btn" onClick={() => removerDoCarrinho(item.id)}>−</button>
                                  <span className="qty-value">{estaNoCarrinho.qty}</span>
                                  <button className="qty-btn" onClick={() => adicionarAoCarrinho(item)}>+</button>
                                </div>
                              ) : (
                                <button className="menu-item-add" onClick={() => adicionarAoCarrinho(item)}>
                                  + Adicionar
                                </button>
                              )
                            )}
                          </div>
                          {item.image_url && (
                            <img className="menu-item-photo" src={item.image_url} alt={item.name} />
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

      {/* ── Barra de pedido (aparece quando há itens no carrinho) ── */}
      {restaurant.whatsapp && carrinho.length > 0 && (
        <div className="order-bar">
          <button className="order-bar-btn" onClick={() => setCarrinhoAberto(true)}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="order-bar-count">{quantidadeNoCarrinho}</span>
              Ver pedido
            </span>
            <span className="order-bar-total">R$ {formatarPreco(totalDoCarrinho)}</span>
          </button>
        </div>
      )}

      {/* ── Gaveta do carrinho ────────────────────────────────── */}
      {carrinhoAberto && (
        <div className="cart-overlay" onClick={() => setCarrinhoAberto(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <div>
                <div style={{
                  font: '500 11px var(--sans)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  marginBottom: 4,
                }}>
                  Seu pedido
                </div>
                <h3>Comanda</h3>
              </div>
              <button className="cart-close" onClick={() => setCarrinhoAberto(false)}>✕</button>
            </div>

            <div className="cart-items">
              {carrinho.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">
                      R$ {formatarPreco(parseFloat(item.price) * item.qty)}
                    </span>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => removerDoCarrinho(item.id)}>−</button>
                    <span className="qty-value">{item.qty}</span>
                    <button className="qty-btn" onClick={() => adicionarAoCarrinho(item)}>+</button>
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
              <button className="btn-clear" onClick={limparCarrinho}>Limpar carrinho</button>
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
