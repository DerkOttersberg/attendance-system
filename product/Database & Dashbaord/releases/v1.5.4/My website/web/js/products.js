// Product Management Functions
function showProductsModal() {
    const modal = document.getElementById('productsModal');
    if (!modal) return;
    renderProductsModal();
    modal.classList.add('active');
}

function closeProductsModal(event) {
    if (!event || event.target.id === 'productsModal') {
        document.getElementById('productsModal').classList.remove('active');
    }
}

async function renderProductsModal() {
    const container = document.getElementById('productsModalContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading products...</div>';
    try {
        const products = await API.fetchProducts();
        container.innerHTML = `
            <h2 style="margin-bottom:0.5rem;">Manage Products</h2>
            <p style="margin-top:0;margin-bottom:1rem;color:#475569;">Add or remove products. Removing clears the product from users.</p>
            <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
                <input id="newProductName" type="text" placeholder="New product name" style="flex:1;padding:0.5rem;border:1px solid #e2e8f0;border-radius:6px;" />
                <button class="btn btn-primary" onclick="submitAddProduct()">Add</button>
            </div>
            <div style="max-height:300px;overflow:auto;">
                <ul style="list-style:none;padding:0;margin:0;">
                    ${products.map(p => `<li style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid #eef2ff;"><span>${p.name}</span><button class=\"btn btn-secondary\" onclick=\"deleteProduct(${p.id})\">Delete</button></li>`).join('')}
                </ul>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load products:', err);
        container.innerHTML = '<div class="error">Failed to load products</div>';
    }
}

async function submitAddProduct() {
    const input = document.getElementById('newProductName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert('Enter a product name');
    try {
        await API.createProduct(name);
        input.value = '';
        await renderProductsModal();
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to add product:', err);
        alert('Failed to add product');
    }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product? This will clear the product from any users that used it.')) return;
    try {
        await API.deleteProduct(id);
        await renderProductsModal();
        if (window.loadAllData) await window.loadAllData();
    } catch (err) {
        console.error('Failed to delete product:', err);
        alert('Failed to delete product');
    }
}
