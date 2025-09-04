<script>
  // 1️⃣ Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // 2️⃣ Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 3️⃣ Fetch and display products
  fetch('products.json')
    .then(res => res.json())
    .then(products => {
      const grid = document.getElementById('product-grid');
      products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="heart" onclick="toggleLike(${product.id}, this)">♡</div>
          <a href="product.html?id=${product.id}">
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
          </a>
          <p>$${(product.price / 100).toFixed(2)}</p>
          <button class="btn" onclick="addToCart(${product.id})">Add to Cart</button>
        `;
        grid.appendChild(card);
      });

      // Restore heart states after products are added
      restoreLikedHearts();
    })
    .catch(err => console.error("Failed to load products:", err));

  // 4️⃣ Add to Cart
  function addToCart(productId) {
    fetch('products.json')
      .then(res => res.json())
      .then(products => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        let cart = JSON.parse(localStorage.getItem("cart")) || [];
        const existing = cart.find(item => item.id === productId);
        if (existing) {
          existing.quantity++;
        } else {
          cart.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });
        }
        localStorage.setItem("cart", JSON.stringify(cart));
        alert(`${product.name} added to cart!`);
      });
  }

  // 5️⃣ Heart toggle for liked items
  function toggleLike(productId, el) {
    let liked = JSON.parse(localStorage.getItem("likedItems")) || [];
    if (liked.includes(productId)) {
      liked = liked.filter(id => id !== productId);
      el.textContent = "♡";
    } else {
      liked.push(productId);
      el.textContent = "♥";
    }
    localStorage.setItem("likedItems", JSON.stringify(liked));
  }

  // 6️⃣ Restore hearts on page load
  function restoreLikedHearts() {
    let liked = JSON.parse(localStorage.getItem("likedItems")) || [];
    document.querySelectorAll(".card").forEach(card => {
      const heart = card.querySelector(".heart");
      const productLink = card.querySelector("a");
      if (!productLink || !heart) return;
      const url = new URL(productLink.href, window.location.href);
      const id = parseInt(url.searchParams.get("id"));
      if (liked.includes(id)) {
        heart.textContent = "♥";
      }
    });
  }
</script>
