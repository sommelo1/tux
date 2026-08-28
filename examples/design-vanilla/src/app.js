// Clickable design (vanilla SPA with History-API routing).
const view = document.getElementById('view');

const PRODUCTS = [
  { id: 'p1', name: 'Trail Shoes', price: '119 €' },
  { id: 'p2', name: 'Rain Jacket', price: '89 €' },
];

function productsPage() {
  return `
    <h1>Products</h1>
    <div data-tux-component="ProductTabs" data-tux-state-tab="all">
      <div role="tablist">
        <button role="tab" aria-selected="true" data-tab="all">All</button>
        <button role="tab" aria-selected="false" data-tab="featured">Featured</button>
      </div>
      <ul id="product-list" data-tux-component="ProductList">
        ${PRODUCTS.map((p) => `
          <li data-tux-component="ProductCard" data-tux-instance="${p.id}">
            <span data-tux-id="product-name-${p.id}">${p.name}</span>
            <span data-tux-id="product-price-${p.id}" data-tux-component="PriceLabel">${p.price}</span>
          </li>`).join('')}
      </ul>
    </div>`;
}

function checkoutPage() {
  return `
    <h1>Checkout</h1>
    <div data-tux-component="CheckoutActions">
      <button data-tux-id="coupon-open">Add coupon</button>
      <button data-tux-id="checkout-submit" data-tux-component="SubmitButton">Complete purchase</button>
    </div>
    <dialog id="coupon-modal" data-tux-component="CouponModal">
      <p>Add a coupon code.</p>
      <input data-tux-id="coupon-input" placeholder="Code">
      <button data-tux-id="coupon-apply">Apply</button>
    </dialog>`;
}

function homePage() {
  return '<h1>Home</h1><p>Clickable TUX design.</p>';
}

function render() {
  const route = location.pathname;
  if (route === '/products') view.innerHTML = productsPage();
  else if (route === '/checkout') view.innerHTML = checkoutPage();
  else view.innerHTML = homePage();
  bind();
}

function bind() {
  view.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('[role=tablist]').querySelectorAll('[role=tab]').forEach((t) => {
        t.setAttribute('aria-selected', String(t === btn));
      });
      const wrap = btn.closest('[data-tux-component]');
      wrap.dataset.tuxStateTab = btn.dataset.tab;
      const list = document.getElementById('product-list');
      list.style.display = btn.dataset.tab === 'featured' ? 'none' : '';
    });
  });
  const open = document.querySelector('[data-tux-id=coupon-open]');
  const modal = document.getElementById('coupon-modal');
  if (open && modal) open.addEventListener('click', () => modal.showModal());
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a) return;
  e.preventDefault();
  history.pushState(null, '', a.getAttribute('href'));
  render();
});

window.addEventListener('popstate', render);
render();
