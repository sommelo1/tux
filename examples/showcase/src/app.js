// TUX showcase — multipage clickable design (vanilla SPA, History-API routing).
// Demonstrates: multi-route feedback, component vs. instance targeting,
// tab state, and modal ui_state capture.

const view = document.getElementById('view');

const PRODUCTS = [
  { id: 'card-1', name: 'Aurora Lamp', price: '129 €', featured: true, href: '/product/aurora-lamp' },
  { id: 'card-2', name: 'Ember Speaker', price: '89 €', featured: false },
  { id: 'card-3', name: 'Nimbus Clock', price: '49 €', featured: true },
];

function homePage() {
  return `
    <section class="hero" data-tux-component="Hero">
      <p class="eyebrow">TUX showcase</p>
      <h1>Light up your review cycle.</h1>
      <p class="lede">A multipage clickable design. Press Alt+T or click the
        ⬢ launcher, pick any element and leave structured feedback — markers
        survive reloads and SPA navigation.</p>
      <button class="cta" data-tux-id="hero-cta">Start reviewing</button>
    </section>
    <section class="features" data-tux-component="Features">
      <article><h3>Multi-route</h3><p>Feedback is captured per route and restores on navigation.</p></article>
      <article><h3>Component-aware</h3><p>Targets resolve to components and instances, not screenshots.</p></article>
      <article><h3>Machine-readable</h3><p>Every comment is canonical JSON — CLI and agents read the same store.</p></article>
    </section>`;
}

function productsPage() {
  return `
    <h1>Products</h1>
    <section data-tux-component="ProductTabs">
      <div role="tablist" class="tabs">
        <button role="tab" aria-selected="true" data-tab="all">All</button>
        <button role="tab" aria-selected="false" data-tab="featured">Featured</button>
      </div>
      <div class="grid" id="product-grid">
        ${PRODUCTS.map((p) => `
          <article class="card" data-tux-component="ProductCard" data-tux-instance="${p.id}" data-featured="${p.featured}">
            <div class="thumb"></div>
            <h3>${p.href ? `<a href="${p.href}">${p.name}</a>` : p.name}</h3>
            <span class="price" data-tux-id="price-${p.id}">${p.price}</span>
          </article>`).join('')}
      </div>
    </section>`;
}

function detailPage() {
  return `
    <article data-tux-component="ProductDetail" data-tux-instance="aurora-lamp">
      <div class="detail-media"></div>
      <div class="detail-info">
        <p class="eyebrow">Aurora Lamp</p>
        <h1>Atmosphere light with three moods</h1>
        <div class="price-row">
          <span class="price" data-tux-id="product-price">129 €</span>
          <span class="badge" data-tux-id="product-badge">Bestseller</span>
        </div>
        <p>Warm, dimmable light with a handmade ceramic shade.
           Ships with a linen cable and a brass dimmer.</p>
        <button class="cta" data-tux-id="add-to-cart">Add to cart</button>
        <a class="link" href="/checkout">Go to checkout</a>
      </div>
      <section class="detail-tabs" data-tux-component="ProductTabs" data-tux-instance="aurora-lamp">
        <div role="tablist" class="tabs">
          <button role="tab" aria-selected="true" data-tab="specs" data-tux-id="specs-tab">Specs</button>
          <button role="tab" aria-selected="false" data-tab="reviews" data-tux-id="reviews-tab">Reviews</button>
        </div>
        <div class="panel" data-panel="specs">Dimensions 34 × 18 cm · ceramic, linen, brass · E27, 6 W, dimmable.</div>
        <div class="panel" data-panel="reviews" hidden>“The warmest light in our studio.” — 4.9 of 5, 212 reviews.</div>
      </section>
    </article>`;
}

function checkoutPage() {
  return `
    <h1>Checkout</h1>
    <form class="checkout" data-tux-component="CheckoutForm">
      <label>Name <input value="Anonymous"></label>
      <label>Address <input placeholder="Street, city"></label>
      <div class="row">
        <button type="button" class="ghost" data-tux-id="coupon-open">Add coupon</button>
        <button type="button" class="cta" data-tux-id="checkout-submit">Complete purchase</button>
      </div>
    </form>
    <dialog id="coupon-modal" class="modal" data-tux-component="CouponModal">
      <h3>Add a coupon</h3>
      <input data-tux-id="coupon-input" placeholder="Code">
      <div class="row">
        <button type="button" class="ghost" data-tux-id="coupon-cancel">Cancel</button>
        <button type="button" class="cta" data-tux-id="coupon-apply">Apply</button>
      </div>
    </dialog>`;
}

function render() {
  const route = location.pathname;
  if (route === '/products') view.innerHTML = productsPage();
  else if (route === '/product/aurora-lamp') view.innerHTML = detailPage();
  else if (route === '/checkout') view.innerHTML = checkoutPage();
  else view.innerHTML = homePage();
  bind();
}

function bind() {
  // tabs (both product grids and the detail page)
  view.querySelectorAll('[role="tablist"]').forEach((list) => {
    const wrap = list.closest('[data-tux-component]');
    list.querySelectorAll('[role="tab"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        list.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === btn)));
        if (wrap) wrap.dataset.tuxStateTab = btn.dataset.tab;
        view.querySelectorAll(`[data-panel]`).forEach((p) => {
          p.hidden = p.dataset.panel !== btn.dataset.tab;
        });
        const grid = document.getElementById('product-grid');
        if (grid) {
          grid.querySelectorAll('[data-featured]').forEach((card) => {
            card.style.display = btn.dataset.tab === 'featured' && card.dataset.featured !== 'true' ? 'none' : '';
          });
        }
      });
    });
  });
  // coupon modal
  const open = view.querySelector('[data-tux-id="coupon-open"]');
  const modal = view.querySelector('#coupon-modal');
  if (open && modal) {
    open.addEventListener('click', () => modal.showModal());
    view.querySelector('[data-tux-id="coupon-cancel"]').addEventListener('click', () => modal.close());
    view.querySelector('[data-tux-id="coupon-apply"]').addEventListener('click', () => modal.close());
  }
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
