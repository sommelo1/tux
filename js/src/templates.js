/**
 * Vanilla design template for `tux design create --framework vanilla`.
 * A small single-page app with History-API routing, a tab group and a
 * modal, annotated with TUX targeting attributes
 * (data-tux-id, data-tux-component, data-tux-instance, data-tux-state).
 *
 * @module templates
 */

export const VANILLA_PACKAGE_JSON = `{
  "name": "tux-design",
  "version": "0.1.0",
  "private": true,
  "description": "Clickable design (vanilla) — serve with: tux design serve"
}
`;

export const VANILLA_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Checkout Design</title>
  <link rel="stylesheet" href="src/styles.css">
</head>
<body>
  <nav data-tux-component="MainNav">
    <a href="/" data-tux-id="nav-home">Home</a>
    <a href="/products" data-tux-id="nav-products">Products</a>
    <a href="/checkout" data-tux-id="nav-checkout">Checkout</a>
  </nav>
  <main id="view"></main>
  <script type="module" src="src/app.js"></script>
</body>
</html>
`;

export const VANILLA_APP_JS = `// Clickable design (vanilla SPA with History-API routing).
const view = document.getElementById('view');

const PRODUCTS = [
  { id: 'p1', name: 'Trail Shoes', price: '119 €' },
  { id: 'p2', name: 'Rain Jacket', price: '89 €' },
];

function productsPage() {
  return \`
    <h1>Products</h1>
    <div data-tux-component="ProductTabs" data-tux-state-tab="all">
      <div role="tablist">
        <button role="tab" aria-selected="true" data-tab="all">All</button>
        <button role="tab" aria-selected="false" data-tab="featured">Featured</button>
      </div>
      <ul id="product-list" data-tux-component="ProductList">
        \${PRODUCTS.map((p) => \`
          <li data-tux-component="ProductCard" data-tux-instance="\${p.id}">
            <span data-tux-id="product-name-\${p.id}">\${p.name}</span>
            <span data-tux-id="product-price-\${p.id}" data-tux-component="PriceLabel">\${p.price}</span>
          </li>\`).join('')}
      </ul>
    </div>\`;
}

function checkoutPage() {
  return \`
    <h1>Checkout</h1>
    <div data-tux-component="CheckoutActions">
      <button data-tux-id="coupon-open">Add coupon</button>
      <button data-tux-id="checkout-submit" data-tux-component="SubmitButton">Complete purchase</button>
    </div>
    <dialog id="coupon-modal" data-tux-component="CouponModal">
      <p>Add a coupon code.</p>
      <input data-tux-id="coupon-input" placeholder="Code">
      <button data-tux-id="coupon-apply">Apply</button>
    </dialog>\`;
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
`;

export const VANILLA_STYLES_CSS = `/* Clickable design styles (minimal). */
:root { font-family: system-ui, sans-serif; }
body { margin: 0; color: #1e1e1e; }
nav { display: flex; gap: 16px; padding: 12px 20px; border-bottom: 1px solid rgba(0,0,0,.12); }
main { padding: 20px; }
[role=tablist] { display: flex; gap: 8px; margin-bottom: 12px; }
[role=tab] { padding: 6px 14px; border: 1px solid rgba(0,0,0,.12); background: #fff; border-radius: 999px; cursor: pointer; }
[role=tab][aria-selected=true] { background: #569cd6; color: #fff; border-color: #569cd6; }
li { margin: 8px 0; display: flex; gap: 12px; }
dialog { border: 1px solid rgba(0,0,0,.12); border-radius: 12px; padding: 20px; }
button { font: inherit; }
`;

export const VANILLA_README_MD = `# checkout (vanilla design)

Run: \`tux design serve\` from the project root (or this directory).
Routes: \`/\`, \`/products\` (tabs), \`/checkout\` (modal).
`;

/** Files for `tux design create --framework vanilla`. */
export function vanillaTemplate() {
  return {
    'package.json': VANILLA_PACKAGE_JSON,
    'index.html': VANILLA_INDEX_HTML,
    'src/app.js': VANILLA_APP_JS,
    'src/styles.css': VANILLA_STYLES_CSS,
    'README.md': VANILLA_README_MD,
  };
}

export const SUPPORTED_FRAMEWORKS = ['vanilla', 'react'];
