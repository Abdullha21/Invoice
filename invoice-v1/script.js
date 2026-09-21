// script.js — ABDULLAH DIGITAL STORE
import { db } from './firebase.js';
import {
  ref, set, get, push, update, remove, query,
  orderByChild, equalTo, startAt, endAt
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ============================================================
//  ⚙️ CONFIG — এখানে আপনার সব link বসান
// ============================================================
export const CONFIG = {
  // 🔴 আপনার logo image link এখানে বসান (না দিলে "A" দেখাবে)
  LOGO_URL: "https://www.image2url.com/r2/default/images/1786765708686-cd1cda4a-5889-437e-9768-20204165b150.jpg",

  WEBSITE: "https://allpremiumfuturebuy.edgeone.app",
  WHATSAPP: "https://wa.me/881874613165",
  TELEGRAM: "https://t.me/abdullha2",

  DEVELOPER: "MD ABDULLAH KHAN"
};

// Logo apply করবে header-এ
export function applyLogo(){
  const els = document.querySelectorAll('#headerLogo');
  if (CONFIG.LOGO_URL && CONFIG.LOGO_URL.trim()){
    els.forEach(el => {
      el.innerHTML = `<img src="${CONFIG.LOGO_URL}" alt="Logo"
        onerror="this.parentNode.textContent='A'">`;
    });
  }
}

// ============ STATE ============
let products = [];
let selectedProducts = [];
let deliveryInvoiceId = null;
let currentInvoiceForDelivery = null;
let firebaseReady = false;
let instanceCounter = 0;

// ============ TOAST ============
export function showToast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2600);
}
window.showToast = showToast;

// ============ MODAL ============
export function openModal(id){ document.getElementById(id)?.classList.add('active'); }
export function closeModal(id){ document.getElementById(id)?.classList.remove('active'); }
window.openModal = openModal;
window.closeModal = closeModal;

// ============ PAGE NAV ============
export function showPage(id){
  document.querySelectorAll('.page-section').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+id)?.classList.add('active');
  document.querySelectorAll('.nav-tab[data-page]').forEach(el=>{
    el.classList.toggle('active', el.dataset.page === id);
  });
  if (id === 'dashboard') loadInvoiceList();
  if (id === 'products')  renderProducts();
  if (id === 'create')    renderProductSelectList();
}
window.showPage = showPage;

// ============================================================
//  LOAD PRODUCTS
// ============================================================
export async function loadProducts(){
  console.log('🔄 Loading products...');
  const container = document.getElementById('productsListContainer');
  if (container && !products.length){
    container.innerHTML = '<div class="flex-center" style="padding:40px;">Loading products…</div>';
  }
  try {
    const snap = await get(ref(db, 'products'));
    products = [];
    if (snap.exists()) {
      snap.forEach(child => {
        const v = child.val();
        products.push({
          id: child.key,
          name: v.name || 'Unnamed',
          fields: Array.isArray(v.fields) ? v.fields : [],
          price: parseFloat(v.price) || 0,
          createdAt: v.createdAt || 0
        });
      });
      products.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    }
    console.log('📦 Products loaded:', products);
    firebaseReady = true;

    if (document.getElementById('page-products')?.classList.contains('active')) renderProducts();
    if (document.getElementById('page-create')?.classList.contains('active'))   renderProductSelectList();

  } catch (err) {
    console.error('❌ loadProducts:', err);
    if (container){
      container.innerHTML = `<div class="card" style="padding:24px;color:#991b1b;background:#fee2e2;">
        <strong>⚠️ Firebase Error:</strong> ${err.message}</div>`;
    }
  }
}

// ============================================================
//  RENDER PRODUCT LIST
// ============================================================
function renderProducts(){
  const c = document.getElementById('productsListContainer');
  if (!c) return;
  if (!firebaseReady){ c.innerHTML = '<div class="flex-center" style="padding:40px;">Connecting…</div>'; return; }

  if (!products.length){
    c.innerHTML = `
      <div class="flex-center" style="padding:60px;flex-direction:column;gap:16px;color:var(--gray-600);">
        <div style="font-size:3rem;">📦</div>
        <div><strong>No products yet.</strong></div>
        <button class="btn btn-primary" onclick="openAddProductModal()">+ Add Product</button>
      </div>`;
    return;
  }

  c.innerHTML = products.map(p => `
    <div class="product-list-item">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <strong style="color:var(--green);font-size:1.02rem;">${p.name}</strong>
          <span style="background:var(--orange-light);color:var(--orange);padding:3px 12px;border-radius:100px;font-size:0.82rem;font-weight:700;">
            $${p.price.toFixed(2)}
          </span>
        </div>
        ${p.fields.length
          ? `<div style="margin-top:8px;">${p.fields.map(f=>`<span class="field-tag">${f}</span>`).join(' ')}</div>`
          : '<div style="font-size:0.78rem;color:var(--gray-600);margin-top:4px;">No custom fields</div>'}
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">🗑 Delete</button>
    </div>
  `).join('');
}

// ============================================================
//  ADD PRODUCT
// ============================================================
window.openAddProductModal = ()=>{
  document.getElementById('newProductName').value = '';
  document.getElementById('newProductPrice').value = '0';
  document.getElementById('newProductFields').value = '';
  openModal('productModal');
  setTimeout(()=>document.getElementById('newProductName')?.focus(), 100);
};

window.saveNewProduct = async ()=>{
  const name  = document.getElementById('newProductName').value.trim();
  const price = parseFloat(document.getElementById('newProductPrice').value) || 0;
  const raw   = document.getElementById('newProductFields').value.trim();

  if (!name){ showToast('❌ Product name required'); return; }
  const fields = raw ? raw.split(',').map(f=>f.trim()).filter(Boolean) : [];

  const btn = document.querySelector('#productModal .btn-primary');
  if (btn){ btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const newRef = push(ref(db, 'products'));
    await set(newRef, { name, price, fields, createdAt: Date.now() });
    await loadProducts();
    closeModal('productModal');
    showToast('✅ Product saved!');
    renderProducts();
  } catch (err){
    showToast('❌ ' + err.message);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '💾 Save Product'; }
  }
};

window.deleteProduct = async (id)=>{
  if (!confirm('Delete this product permanently?')) return;
  try {
    await remove(ref(db, 'products/' + id));
    await loadProducts();
    renderProducts();
    showToast('🗑 Deleted');
  } catch (err){ showToast('❌ ' + err.message); }
};

// ============================================================
//  PRODUCT SELECT
// ============================================================
function renderProductSelectList(){
  const c = document.getElementById('productSelectList');
  if (!c) return;
  if (!firebaseReady){ c.innerHTML = '<p style="color:var(--gray-600);">Connecting…</p>'; return; }
  if (!products.length){
    c.innerHTML = `
      <div style="padding:14px;background:var(--orange-light);border-radius:12px;border-left:4px solid var(--orange);font-size:0.9rem;">
        ⚠️ No products yet.
        <button class="btn btn-sm btn-orange" style="margin-left:8px;" onclick="showPage('products')">Add Product</button>
      </div>`;
    return;
  }

  c.innerHTML = products.map(p => `
    <div class="product-list-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
      <div class="flex-between w-100">
        <div>
          <strong style="color:var(--green);">${p.name}</strong>
          <span style="background:var(--orange-light);color:var(--orange);padding:2px 10px;border-radius:100px;font-size:0.78rem;font-weight:700;margin-left:8px;">
            $${p.price.toFixed(2)}
          </span>
        </div>
        <button class="btn btn-sm btn-primary" onclick="addProductInstance('${p.id}')">+ Add</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  MULTIPLE INSTANCE
// ============================================================
window.addProductInstance = (productId)=>{
  const prod = products.find(p => p.id === productId);
  if (!prod) return;
  instanceCounter++;
  const instanceId = 'inst_' + Date.now() + '_' + instanceCounter;
  selectedProducts.push({
    instanceId,
    productId: prod.id,
    name: prod.name,
    price: prod.price || 0,
    fields: (prod.fields || []).map(f => ({ label: f, value: '' }))
  });
  renderSelectedInstances();
  updateLivePreview();
};

window.removeProductInstance = (instanceId)=>{
  selectedProducts = selectedProducts.filter(s => s.instanceId !== instanceId);
  renderSelectedInstances();
  updateLivePreview();
};

function renderSelectedInstances(){
  let container = document.getElementById('selectedInstancesContainer');
  if (!container){
    container = document.createElement('div');
    container.id = 'selectedInstancesContainer';
    container.style.marginTop = '20px';
    document.getElementById('productSelectList')?.after(container);
  }

  if (!selectedProducts.length){ container.innerHTML = ''; return; }

  const grouped = {};
  selectedProducts.forEach(sp => {
    if (!grouped[sp.productId]) grouped[sp.productId] = [];
    grouped[sp.productId].push(sp);
  });

  let html = '<h4 style="margin-bottom:12px;color:var(--gray-600);font-size:0.95rem;">Selected Items</h4>';

  Object.keys(grouped).forEach(pid => {
    const instances = grouped[pid];
    const prod = products.find(p => p.id === pid);
    html += `
      <div style="background:var(--green-light);border-radius:12px;padding:12px;margin-bottom:12px;border-left:4px solid var(--green);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="color:var(--green);font-size:1rem;">
            ${prod.name} ${instances.length > 1 ? `× ${instances.length}` : ''}
          </strong>
          <span style="color:var(--orange);font-weight:700;">$${(prod.price * instances.length).toFixed(2)}</span>
        </div>
        ${instances.map((inst, idx) => `
          <div class="instance-row">
            <div class="instance-header">
              <span class="instance-number">#${idx + 1}</span>
              ${instances.length > 1
                ? `<button class="instance-remove" onclick="removeProductInstance('${inst.instanceId}')">×</button>`
                : ''}
            </div>
            ${(inst.fields || []).map(f => `
              <div class="form-group" style="margin-bottom:8px;">
                <label class="form-label" style="font-size:0.72rem;">${f.label}</label>
                <input type="text" class="form-control instance-field-input"
                       data-instance-id="${inst.instanceId}"
                       data-field="${f.label}"
                       value="${f.value || ''}"
                       placeholder="Enter ${f.label}">
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.instance-field-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const iid = e.target.dataset.instanceId;
      const label = e.target.dataset.field;
      const sp = selectedProducts.find(s => s.instanceId === iid);
      if (!sp) return;
      const f = sp.fields.find(x => x.label === label);
      if (f) f.value = e.target.value;
      updateLivePreview();
    });
  });
}

// ============================================================
//  LIVE PREVIEW
// ============================================================
function updateLivePreview(){
  const c = document.getElementById('livePreviewContainer');
  if (!c) return;
  if (!selectedProducts.length){
    c.innerHTML = '<div class="flex-center" style="padding:40px;color:var(--gray-600);">Select products to preview</div>';
    return;
  }

  const total = selectedProducts.reduce((sum, sp) => sum + (sp.price || 0), 0);

  c.innerHTML = renderInvoiceHTML({
    invoiceNumber: 'INV-XXXX-XXXX',
    date: new Date().toISOString(),
    status: 'Paid',
    paymentMethod: document.getElementById('paymentMethod')?.value || 'Crypto (USDT)',
    products: selectedProducts.map(sp => ({
      name: sp.name,
      quantity: 1,
      price: sp.price,
      fields: sp.fields
    })),
    total
  });
}

// ============================================================
//  INVOICE NUMBER
// ============================================================
async function generateInvoiceNumber(){
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');
  const prefix = `INV-${y}${m}${d}-`;

  const snap = await get(query(ref(db,'invoices'),
    orderByChild('invoiceNumber'), startAt(prefix), endAt(prefix+'\uf8ff')));

  let maxSeq = 0;
  if (snap.exists()){
    snap.forEach(c => {
      const num = c.val().invoiceNumber || '';
      if (num.startsWith(prefix)){
        const n = parseInt(num.replace(prefix,''), 10);
        if (n > maxSeq) maxSeq = n;
      }
    });
  }
  return prefix + String(maxSeq + 1).padStart(4, '0');
}

// ============================================================
//  GENERATE INVOICE
// ============================================================
window.generateInvoice = async ()=>{
  if (!selectedProducts.length) return alert('Add at least one product');

  const invoiceNumber = await generateInvoiceNumber();
  const paymentMethod = document.getElementById('paymentMethod')?.value || 'Crypto (USDT)';
  const total = selectedProducts.reduce((sum, sp) => sum + (sp.price || 0), 0);

  const data = {
    invoiceNumber,
    date: new Date().toISOString(),
    status: 'Paid',
    paymentMethod,
    products: selectedProducts.map(sp => ({
      name: sp.name,
      quantity: 1,
      price: sp.price || 0,
      fields: sp.fields
    })),
    total,
    delivery: {}
  };

  const newRef = push(ref(db, 'invoices'));
  await set(newRef, data);

  showToast('✅ ' + invoiceNumber + ' created');

  selectedProducts = [];
  instanceCounter = 0;
  const sc = document.getElementById('selectedInstancesContainer');
  if (sc) sc.innerHTML = '';
  renderProductSelectList();
  updateLivePreview();
  showPage('dashboard');

  const base = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
  const link = `${base}invoice.html?id=${invoiceNumber}`;
  if (confirm(`Invoice created!\n\n${link}\n\nCopy link?`)){
    navigator.clipboard.writeText(link);
    showToast('🔗 Link copied');
  }
};

// ============================================================
//  INVOICE LIST — সব invoice দেখাবে
// ============================================================
export async function loadInvoiceList(filter){
  const c = document.getElementById('invoiceListContainer');
  if (!c) return;
  c.innerHTML = '<div class="flex-center" style="padding:40px;">Loading invoices…</div>';

  try {
    const snap = await get(ref(db, 'invoices'));
    let invoices = [];

    if (snap.exists()) {
      snap.forEach(ch => {
        const v = ch.val();
        invoices.push({
          id: ch.key,
          invoiceNumber: v.invoiceNumber || '',
          date: v.date || '',
          status: v.status || 'Paid',
          total: v.total || 0,
          paymentMethod: v.paymentMethod || '',
          products: v.products || []
        });
      });
    }

    // sort newest first
    invoices.sort((a,b)=> (b.invoiceNumber||'').localeCompare(a.invoiceNumber||''));

    if (filter){
      const f = filter.toLowerCase();
      invoices = invoices.filter(inv =>
        (inv.invoiceNumber||'').toLowerCase().includes(f) ||
        (inv.products||[]).some(p => (p.name||'').toLowerCase().includes(f))
      );
    }

    if (!invoices.length){
      c.innerHTML = `
        <div class="flex-center" style="padding:60px;flex-direction:column;gap:14px;color:var(--gray-600);">
          <div style="font-size:3rem;">📄</div>
          <div><strong>No invoices yet.</strong></div>
          <button class="btn btn-primary" onclick="showPage('create')">+ Create Invoice</button>
        </div>`;
      return;
    }

    // Header row
    let html = `
      <div style="padding:10px 16px;background:var(--gray-100);border-radius:12px;
                  display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 2.5fr;
                  gap:10px;font-size:0.75rem;font-weight:700;
                  text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-600);
                  margin-bottom:10px;">
        <div>Invoice #</div>
        <div>Date & Time</div>
        <div>Status</div>
        <div>Total</div>
        <div style="text-align:right;">Actions</div>
      </div>
    `;

    // Rows
    html += invoices.map(inv => {
      const dt = inv.date ? new Date(inv.date) : null;
      const dateStr = dt ? dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      const timeStr = dt ? dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
      const prodNames = (inv.products||[]).map(p=>p.name).join(', ') || '—';
      const isPaid = inv.status === 'Paid' || inv.status === 'Delivered';

      return `
        <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 2.5fr;
                    gap:10px;padding:14px 16px;background:#fff;
                    border:1px solid var(--gray-200);border-radius:12px;
                    margin-bottom:8px;align-items:center;">

          <div>
            <strong style="color:var(--green);">${inv.invoiceNumber}</strong>
            <div style="font-size:0.75rem;color:var(--gray-600);margin-top:3px;">
              ${prodNames}
            </div>
          </div>

          <div style="font-size:0.82rem;color:var(--gray-600);">
            ${dateStr}<br><span style="font-size:0.72rem;">🕐 ${timeStr}</span>
          </div>

          <div>
            <span class="status-badge ${statusClass(inv.status)}"
                  style="font-size:0.7rem;padding:4px 10px;margin:0;">
              ${inv.status} ${isPaid?'✓':''}
            </span>
          </div>

          <div style="font-weight:700;color:var(--orange);">
            $${(inv.total||0).toFixed(2)}
          </div>

          <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
            <select class="status-select" style="font-size:0.72rem;padding:4px 8px;"
                    onchange="updateStatus('${inv.id}', this.value)">
              ${['Pending Payment','Paid','Processing','Delivered','Cancelled']
                .map(s=>`<option ${inv.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-outline" title="Delivery"
                    onclick="openDelivery('${inv.id}')">📦</button>
            <button class="btn btn-sm btn-outline" title="View"
                    onclick="viewInvoice('${inv.invoiceNumber}')">👁</button>
            <button class="btn btn-sm btn-outline" title="Copy link"
                    onclick="copyLink('${inv.invoiceNumber}')">🔗</button>
            <button class="btn btn-sm btn-danger" title="Delete"
                    onclick="deleteInvoice('${inv.id}')">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    c.innerHTML = html;

  } catch (err){
    console.error('loadInvoiceList error:', err);
    c.innerHTML = `<div class="card" style="padding:24px;color:#991b1b;">⚠️ ${err.message}</div>`;}
}

function statusClass(s){
  if (s==='Paid' || s==='Delivered') return 'paid';
  if (s==='Processing') return 'processing';
  if (s==='Cancelled') return 'cancelled';
  return '';
}

window.searchInvoices = ()=>{
  const v = document.getElementById('searchInvoiceInput').value;
  loadInvoiceList(v);
};
window.updateStatus = async (id, status)=>{
  await update(ref(db, 'invoices/' + id), { status });
  showToast('Status → ' + status);
  loadInvoiceList();
};
window.viewInvoice = (num)=>{
  const base = location.pathname.replace(/\/[^/]*$/, '/');
  window.open(`${base}invoice.html?id=${num}`, '_blank');
};
window.copyLink = (num)=>{
  const base = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
  navigator.clipboard.writeText(`${base}invoice.html?id=${num}`);
  showToast('🔗 Link copied');
};
window.deleteInvoice = async (id)=>{
  if (!confirm('Delete permanently?')) return;
  await remove(ref(db, 'invoices/' + id));
  showToast('Deleted');
  loadInvoiceList();
};

// ============================================================
//  DELIVERY
// ============================================================
window.openDelivery = async (id)=>{
  deliveryInvoiceId = id;
  const snap = await get(ref(db, 'invoices/' + id));
  if (!snap.exists()) return;
  const inv = snap.val();
  currentInvoiceForDelivery = inv;
  const existing = inv.delivery || {};

  const groups = {};
  (inv.products||[]).forEach((p, i) => {
    if (!groups[p.name]) groups[p.name] = [];
    groups[p.name].push({ index: i, ...p });
  });

  let html = '';
  Object.keys(groups).forEach(name => {
    const items = groups[name];
    html += `<h4 style="margin:16px 0 8px;color:var(--green);font-size:0.95rem;">${name} ${items.length>1?`× ${items.length}`:''}</h4>`;
    items.forEach((it, idx) => {
      const key = items.length > 1 ? `${name} #${idx+1}` : name;
      html += `
        <div class="form-group">
          <label class="form-label">Instance #${idx+1} — Delivery Info</label>
          <input type="text" class="form-control delivery-input"
                 data-key="${key}"
                 value="${existing[key] || ''}"
                 placeholder="e.g. Delivered To / Added To">
        </div>`;
    });
  });

  document.getElementById('deliveryFormFields').innerHTML = html || '<p>No products</p>';
  openModal('deliveryModal');
};

window.saveDeliveryInfo = async ()=>{
  if (!deliveryInvoiceId) return;
  const inputs = document.querySelectorAll('.delivery-input');
  const delivery = {};
  inputs.forEach(inp => {
    if (inp.value.trim()) delivery[inp.dataset.key] = inp.value.trim();
  });
  await update(ref(db, 'invoices/' + deliveryInvoiceId), { delivery });
  closeModal('deliveryModal');
  showToast('📦 Delivery saved');
  loadInvoiceList();
};

// ============================================================
//  PUBLIC INVOICE
// ============================================================
window.loadPublicInvoice = async ()=>{
  const val = document.getElementById('publicInvoiceSearch').value.trim();
  if (!val) return;
  const display = document.getElementById('publicInvoiceDisplay');
  display.innerHTML = '<div class="flex-center" style="padding:60px;">Searching…</div>';

  const snap = await get(query(ref(db,'invoices'),
    orderByChild('invoiceNumber'), equalTo(val)));

  if (!snap.exists()){
    display.innerHTML = '<div class="card flex-center" style="padding:60px;">❌ Invoice not found.</div>';
    return;
  }
  let invoice;
  snap.forEach(c => { invoice = { id: c.key, ...c.val() }; });
  display.innerHTML = renderInvoiceHTML(invoice);
};

// ============================================================
//  RENDER INVOICE HTML
// ============================================================
export function renderInvoiceHTML(inv){
  const invNum = inv.invoiceNumber || 'INV-XXXX-XXXX';
  const dt = inv.date ? new Date(inv.date) : new Date();
  const date = dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  const time = dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const status = inv.status || 'Paid';
  const products = inv.products || [];
  const delivery = inv.delivery || {};
  const total = inv.total || products.reduce((s,p)=>s+(p.price||0)*(p.quantity||1),0);
  const paymentMethod = inv.paymentMethod || 'Crypto / Naira Bank Transfer';

  const isPaid = (status === 'Paid' || status === 'Delivered');
  const isDelivered = status === 'Delivered';

  const logoHTML = CONFIG.LOGO_URL && CONFIG.LOGO_URL.trim()
    ? `<img src="${CONFIG.LOGO_URL}" alt="Logo" onerror="this.parentNode.textContent='A'">`
    : 'A';

  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.name]) grouped[p.name] = [];
    grouped[p.name].push(p);
  });

  let rows = '';
  Object.keys(grouped).forEach(name => {
    const items = grouped[name];
    items.forEach((p, idx) => {
      const fieldLines = (p.fields||[]).filter(f=>f.value)
        .map(f => `<span class="custom-field-value">${f.label}: <strong>${f.value}</strong></span>`)
        .join(' ');
      const deliveryKey = items.length > 1 ? `${name} #${idx+1}` : name;
      const dInfo = delivery[deliveryKey];
      const deliveryLine = dInfo
        ? `<div class="delivery-info-block">📦 <strong>Delivery:</strong> ${dInfo}</div>` : '';
      rows += `
        <tr>
          <td>
            <span class="product-name">${p.name}${items.length>1?` <span style="font-size:0.72rem;color:var(--gray-600);">(#${idx+1} of ${items.length})</span>`:''}</span>
            ${fieldLines ? '<div style="margin-top:6px;">'+fieldLines+'</div>' : ''}
            ${deliveryLine}
          </td>
          <td>${p.quantity||1}</td>
          <td>$${(p.price||0).toFixed(2)}</td>
          <td>$${((p.price||0)*(p.quantity||1)).toFixed(2)}</td>
        </tr>`;
    });
  });

  return `
    <div class="invoice-preview">

      <div class="invoice-header">
        <div class="invoice-header-left">
          <div class="logo-icon">${logoHTML}</div>
          <div>
            <div class="store-name">ABDULLAH <span>DIGITAL</span> STORE</div>
            <div style="font-size:0.72rem;color:var(--gray-600);">Premium Digital Services</div>
          </div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-number">${invNum}</div>
          <div style="font-size:0.78rem;color:var(--gray-600);margin-top:8px;">
            📅 <strong>${date}</strong><br>🕐 <strong>${time}</strong>
          </div>
        </div>
      </div>

      ${isPaid ? `
      <div class="paid-hero">
        <div class="paid-hero-left">
          <div class="paid-check">✓</div>
          <div>
            <div class="paid-text-main">PAID</div>
            <div class="paid-text-sub">Payment received successfully</div>
          </div>
        </div>
        <div class="paid-hero-right">
          <div class="label">Total Amount</div>
          <div class="value">$${total.toFixed(2)}</div>
        </div>
      </div>
      ` : ''}

      ${isDelivered ? `
      <div class="delivery-complete-banner">
        <div class="icon">✓</div>
        <div>Delivery Complete — Your order has been delivered successfully.</div>
      </div>
      ` : ''}

      <div class="payment-info">
        <div class="payment-item">
          <div class="payment-label">Payment Method</div>
          <div class="payment-value">${paymentMethod}</div>
        </div>
        <div class="payment-item">
          <div class="payment-label">Payment Status</div>
          <div class="payment-value" style="color:${isPaid?'var(--green)':'inherit'};font-weight:700;">
            ${status} ${isPaid?'✓':''}
          </div>
        </div>
        <div class="payment-item">
          <div class="payment-label">Invoice Date</div>
          <div class="payment-value">${date} · ${time}</div>
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:50%;">Product / Details</th>
            <th>Qty</th><th>Price</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" class="flex-center">No products</td></tr>'}
          <tr class="total-row">
            <td colspan="3" style="text-align:right;">Grand Total</td>
            <td>$${total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="notes-box">
        <h4>📌 Important Notes</h4>
        <ul style="padding-left:18px;font-size:0.88rem;color:#3d2400;">
          <li>Keep this invoice link safe for future reference.</li>
          <li>Do not share your account credentials with anyone.</li>
          <li>For support, contact us through the channels below.</li>
        </ul>
      </div>

      <!-- SUPPORT: BUTTON + TEXT SIDE BY SIDE -->
      <div class="support-section">
        <div class="support-title">📞 Need Help? Contact Us</div>
        <div class="support-list">
          <a href="${CONFIG.WEBSITE}" target="_blank" class="support-row website">
            <span class="icon-circle">🌐</span>
            <span class="info">
              <span class="lbl">Website</span>
              <span class="val">${CONFIG.WEBSITE.replace(/^https?:\/\//,'')}</span>
            </span>
          </a>
          <a href="${CONFIG.WHATSAPP}" target="_blank" class="support-row whatsapp">
            <span class="icon-circle">W</span>
            <span class="info">
              <span class="lbl">WhatsApp</span>
              <span class="val">+881874613165</span>
            </span>
          </a>
          <a href="${CONFIG.TELEGRAM}" target="_blank" class="support-row telegram">
            <span class="icon-circle">T</span>
            <span class="info">
              <span class="lbl">Telegram</span>
              <span class="val">@abdullha2</span>
            </span>
          </a>
        </div>
      </div>

      <div class="dev-footer" style="border-top:1px dashed var(--gray-200);margin-top:16px;padding-top:14px;">
        Developed by <strong>${CONFIG.DEVELOPER}</strong>
      </div>

    </div>
  `;
}

// ============================================================
//  INIT
// ============================================================
(async function init(){
  console.log('🚀 ABDULLAH DIGITAL STORE init…');
  applyLogo();

  document.querySelectorAll('.nav-tab[data-page]').forEach(t => {
    t.addEventListener('click', ()=> showPage(t.dataset.page));
  });

  document.getElementById('paymentMethod')?.addEventListener('change', updateLivePreview);

  await loadProducts();

  if (document.getElementById('invoiceListContainer')) loadInvoiceList();
})();

  
