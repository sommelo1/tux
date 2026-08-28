<script setup>
import { ref } from 'vue';

const PRODUCTS = [
  { id: 'p1', name: 'Trail Shoes', price: '119 €' },
  { id: 'p2', name: 'Rain Jacket', price: '89 €' },
];

const route = ref(window.location.pathname);
const tab = ref('all');
const modalOpen = ref(false);

window.onpopstate = () => {
  route.value = window.location.pathname;
};
const navigate = (href) => (event) => {
  event.preventDefault();
  window.history.pushState(null, '', href);
  route.value = href;
};
</script>

<template>
  <nav data-tux-component="MainNav">
    <a href="/" @click="navigate('/')">Home</a>
    <a href="/products" @click="navigate('/products')">Products</a>
    <a href="/checkout" @click="navigate('/checkout')">Checkout</a>
  </nav>
  <main>
    <template v-if="route === '/products'">
      <h1>Products</h1>
      <div data-tux-component="ProductTabs" :data-tux-state-tab="tab">
        <div role="tablist">
          <button v-for="t in ['all', 'featured']" :key="t" role="tab"
            :aria-selected="tab === t" :data-tab="t" @click="tab = t">{{ t }}</button>
        </div>
        <ul data-tux-component="ProductList" :style="tab === 'featured' ? { display: 'none' } : {}">
          <li v-for="p in PRODUCTS" :key="p.id" data-tux-component="ProductCard" :data-tux-instance="p.id">
            <span :data-tux-id="`product-name-${p.id}`">{{ p.name }}</span>
            <span :data-tux-id="`product-price-${p.id}`" data-tux-component="PriceLabel">{{ p.price }}</span>
          </li>
        </ul>
      </div>
    </template>
    <template v-else-if="route === '/checkout'">
      <h1>Checkout</h1>
      <div data-tux-component="CheckoutActions">
        <button data-tux-id="coupon-open" @click="modalOpen = true">Add coupon</button>
        <button data-tux-id="checkout-submit" data-tux-component="SubmitButton">Complete purchase</button>
      </div>
      <div v-if="modalOpen" role="dialog" aria-modal="true" aria-label="Coupon" data-tux-component="CouponModal">
        <p>Add a coupon code.</p>
        <input data-tux-id="coupon-input" placeholder="Code" />
        <button data-tux-id="coupon-apply" @click="modalOpen = false">Apply</button>
      </div>
    </template>
    <template v-else>
      <h1>Home</h1>
    </template>
  </main>
</template>
