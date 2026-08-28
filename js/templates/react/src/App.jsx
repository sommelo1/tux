import React, { useState } from 'react';

const PRODUCTS = [
  { id: 'p1', name: 'Trail Shoes', price: '119 €' },
  { id: 'p2', name: 'Rain Jacket', price: '89 €' },
];

function ProductCard({ product }) {
  return (
    <li data-tux-component="ProductCard" data-tux-instance={product.id}>
      <span data-tux-id={`product-name-${product.id}`}>{product.name}</span>
      <span data-tux-id={`product-price-${product.id}`} data-tux-component="PriceLabel">
        {product.price}
      </span>
    </li>
  );
}

function CouponModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Coupon" data-tux-component="CouponModal">
      <p>Add a coupon code.</p>
      <input data-tux-id="coupon-input" placeholder="Code" />
      <button data-tux-id="coupon-apply" onClick={onClose}>Apply</button>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [tab, setTab] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  window.onpopstate = () => setRoute(window.location.pathname);
  const navigate = (href) => (e) => {
    e.preventDefault();
    window.history.pushState(null, '', href);
    setRoute(href);
  };

  return (
    <>
      <nav data-tux-component="MainNav">
        <a href="/" onClick={navigate('/')}>Home</a>
        <a href="/products" onClick={navigate('/products')}>Products</a>
        <a href="/checkout" onClick={navigate('/checkout')}>Checkout</a>
      </nav>
      <main>
        {route === '/products' && (
          <>
            <h1>Products</h1>
            <div data-tux-component="ProductTabs" data-tux-state-tab={tab}>
              <div role="tablist">
                {['all', 'featured'].map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} data-tab={t}
                    onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              <ul data-tux-component="ProductList" style={tab === 'featured' ? { display: 'none' } : {}}>
                {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} />)}
              </ul>
            </div>
          </>
        )}
        {route === '/checkout' && (
          <>
            <h1>Checkout</h1>
            <div data-tux-component="CheckoutActions">
              <button data-tux-id="coupon-open" onClick={() => setModalOpen(true)}>Add coupon</button>
              <button data-tux-id="checkout-submit" data-tux-component="SubmitButton">Complete purchase</button>
            </div>
            <CouponModal open={modalOpen} onClose={() => setModalOpen(false)} />
          </>
        )}
        {route === '/' && <h1>Home</h1>}
      </main>
    </>
  );
}
