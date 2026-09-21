// script.js — ABDULLAH DIGITAL STORE
import { db, auth } from './firebase.js';
import {
  ref, set, get, push, update, remove, query,
  orderByChild, equalTo, startAt, endAt
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ============ STATE ============
let products = [];
let selectedProducts = [];
let deliveryInvoiceId = null;
let currentInvoiceForDelivery = null;

// ============ DEFAULT PRODUCTS ============
const DEFAULT_PRODUCTS = [
  { name:'X Premium',         fields:['X Profile Link'] },
  { name:'X Premium Plus',    fields:['X Profile Link'] },
  { name:'Canva Pro',         fields:['Gmail Address'] },
  { name:'Amazon Prime Video',fields:['Email Address'] },
  { name:'ChatGPT Plus',      fields:['Gmail Address'] },
  { name:'Gemini Premium',    fields:['Gmail Address'] },
  { name:'Telegram Premium',  fields:['Telegram Username'] }
];

// ============ TOAST ============
export function showToast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2400);
}
window.showToast = showToast;

// ============ MODAL ============
export function openModal(id){ document.getElementById(id).classList.add('active'); }
export function closeModal(id){ document.getElementById(id).classList.remove('active'); }
window.openModal = openModal;
window.closeModal = closeModal;

// ============ PAGE NAV ============
export function showPage(id){
  document.querySelectorAll('.page-section').forEach(el=>el.classList.remove('active'));
  const target = document.getElementById('page-'+id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(el=>{
    el.classList.toggle('active', el.dataset.page === id);
  });
  if (id === 'dashboard') loadInvoiceList();
  if (id === 'products') renderProducts();
  if (id === 'create') renderProductSelectList();
}
window.showPage = showPage;

// ============ INVOICE NUMBER ============
async function generateInvoiceNumber(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const prefix = `INV-${yyyy}${mm}${dd}-`;

  const snap = await get(query(ref(db,'invoices'),
    orderByChild('invoiceNumber'), startAt(prefix), endAt(prefix+'\uf8ff')));
  let maxSeq = 0;
  if (snap.exists()) {
    snap.forEach(c=>{
      const num = c.val().invoiceNumber || '';
      if (num.startsWith(prefix)) {
        const n = parseInt(num.replace(prefix,''),10);
        if (n > maxSeq) maxSeq = n;
      }
    });
  }
  return prefix + String(maxSeq+1).padStart(4,'0');
}

// ============ LOAD PRODUCTS ============
export async function loadProducts(){
  const snap = await get(ref(db,'products'));
  products = [];
  if (snap.exists()) snap.forEach(c=>products.push({ id:c.key, ...c.val() }));
  if (products.length === 0){
    for (const p of DEFAULT_PRODUCTS){
      const newRef = push(ref(db,'products'));
      await set(newRef, { name:p.name, fields:p.fields });
      products.push({ id:newRef.key, ...p });
    }
  }
}

// ============ RENDER PRODUCT LIST (ADMIN) ============
function renderProducts(){
  const c = document.getElementById('productsListContainer');
  if (!c) return;
  if (!products.length){
    c.innerHTML = '<div class="flex-center" style="padding:40px;">No products.</div>';
    return;
  }
  c.innerHTML = products.map(p=>`
    <div class="product-list-item">
      <div>
        <strong>${p.name}</strong><br>
        <span style="font-size:0.8rem;color:var(--gray-600);">
          Fields: ${(p.fields||[]).join(', ')||'None'}
        </span>
      </div>
      <button class="btn btn-sm btn-outline" onclick="deleteProduct('${p.id}')">Delete</button>
    </div>
  `).join('');
}

window.deleteProduct = async (id)=>{
  if(!confirm('Delete this product?')) return;
  await remove(ref(db,'products/'+id));
  await loadProducts();
  renderProducts();
  showToast('Product deleted');
};

// ============ ADD PRODUCT ============
window.openAddProductModal = ()=>{
  document.getElementById('newProductName').value='';
  document.getElementById('newProductFields').value='';
  openModal('productModal');
};

window.saveNewProduct = async ()=>{
  const name = document.getElementById('newProductName').value.trim();
  const raw  = document.getElementById('newProductFields').value.trim();
  if(!name) return alert('Product name required');
  const fields = raw ? raw.split(',').map(f=>f.trim()).filter(Boolean) : [];
  await push(ref(db,'products'), { name, fields });
  await loadProducts();
  renderProducts();
  closeModal('productModal');
  showToast('✅ Product added');
};

// ============ PRODUCT SELECT (CREATE) ============
function renderProductSelectList(){
  const c = document.getElementById('productSelectList');
  if (!c) return;
  if (!products.length){
    c.innerHTML = '<p style="color:var(--gray-600);">No products available.</p>';
    return;
  }
  c.innerHTML = products.map(p=>`
    <div class="product-list-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
      <div class="flex-between w-100">
        <strong>${p.name}</strong>
        <button class="btn btn-sm btn-outline" onclick="addProductToInvoice('${p.id}')">+ Add</button>
      </div>
      <div id="fields-${p.id}" class="w-100 hidden">
        ${(p.fields||[]).map(f=>`
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label">${f}</label>
            <input type="text" class="form-control product-field-input"
                   data-product-id="${p.id}" data-field="${f}"
                   placeholder="Enter ${f}">
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

window.addProductToInvoice = (pid)=>{
  const prod = products.find(p=>p.id===pid);
  if (!prod) return;
  if (selectedProducts.find(s=>s.productId===pid)){
    return showToast('Product already added');
  }
  selectedProducts.push({
    productId: prod.id,
    name: prod.name,
    fields: (prod.fields||[]).map(f=>({ label:f, value:'' }))
  });
  const fc = document.getElementById('fields-'+pid);
  if (fc) fc.classList.remove('hidden');
  document.querySelectorAll(`.product-field-input[data-product-id="${pid}"]`)
    .forEach(input=>{
      input.addEventListener('input', e=>{
        const sp = selectedProducts.find(s=>s.productId===pid);
        if (!sp) return;
        const f = sp.fields.find(f=>f.label===e.target.dataset.field);
        if (f) f.value = e.target.value;
        updateLivePreview();
      });
    });
  updateLivePreview();
};

// ============ LIVE PREVIEW ============
function updateLivePreview(){
  const c = document.getElementById('livePreviewContainer');
  if (!c) return;
  if (!selectedProducts.length){
    c.innerHTML = '<div class="flex-center" style="padding:40px;color:var(--gray-600);">Select products to preview</div>';
    return;
  }
  c.innerHTML = renderInvoiceHTML({
    invoiceNumber: 'INV-XXXX-XXXX',
    date: new Date().toISOString(),
    status: 'Pending Payment',
    customer: {
      name:     document.getElementById('custName')?.value||'',
      email:    document.getElementById('custEmail')?.value||'',
      telegram: document.getElementById('custTelegram')?.value||''
    },
    products: selectedProducts.map(sp=>({
      name: sp.name,
      quantity: 1,
      price: 0,
      fields: sp.fields
    })),
    total: 0
  });
}

// ============ GENERATE INVOICE ============
window.generateInvoice = async ()=>{
  if (!selectedProducts.length) return alert('Add at least one product');

  const invoiceNumber = await generateInvoiceNumber();
  const data = {
    invoiceNumber,
    date: new Date().toISOString(),
    status: 'Pending Payment',
    customer: {
      name:     document.getElementById('custName')?.value||'',
      email:    document.getElementById('custEmail')?.value||'',
      telegram: document.getElementById('custTelegram')?.value||''
    },
    products: selectedProducts.map(sp=>({
      name: sp.name,
      quantity: 1,
      price: 0,
      fields: sp.fields
    })),
    total: 0,
    delivery: {}
  };

  const newRef = push(ref(db,'invoices'));
  await set(newRef, data);
  const id = newRef.key;

  showToast('✅ Invoice created: ' + invoiceNumber);

  // Reset
  selectedProducts = [];
  document.getElementById('custName').value = '';
  document.getElementById('custEmail').value = '';
  document.getElementById('custTelegram').value = '';
  renderProductSelectList();
  updateLivePreview();
  showPage('dashboard');

  // Offer share
  const link = `${location.origin}${location.pathname.replace('admin.html','')}invoice.html?id=${invoiceNumber}`;
  if (confirm(`Invoice created!\n\nCopy shareable link?\n${link}`)){
    navigator.clipboard.writeText(link);
    showToast('🔗 Link copied');
  }
};

// ============ LOAD INVOICE LIST ============
export async function loadInvoiceList(filter){
  const c = document.getElementById('invoiceListContainer');
  if (!c) return;
  c.innerHTML = '<div class="flex-center" style="padding:40px;">Loading…</div>';

  const snap = await get(ref(db,'invoices'));
  let invoices = [];
  if (snap.exists()){
    snap.forEach(ch=>invoices.push({ id: ch.key, ...ch.val() }));
  }
  invoices.sort((a,b)=> (b.invoiceNumber||'').localeCompare(a.invoiceNumber||''));

  if (filter){
    const f = filter.toLowerCase();
    invoices = invoices.filter(inv=>{
      return (inv.invoiceNumber||'').toLowerCase().includes(f)
        || (inv.customer?.name||'').toLowerCase().includes(f)
        || (inv.customer?.email||'').toLowerCase().includes(f)
        || (inv.products||[]).some(p=>p.name.toLowerCase().includes(f));
    });
  }

  if (!invoices.length){
    c.innerHTML = '<div class="flex-center" style="padding:40px;color:var(--gray-600);">No invoices found.</div>';
    return;
  }

  c.innerHTML = invoices.map(inv=>`
    <div class="product-list-item" style="flex-wrap:wrap;">
      <div>
        <strong style="color:var(--green);">${inv.invoiceNumber}</strong>
        <span class="status-badge ${statusClass(inv.status)}" style="margin-left:8px;">
          ${inv.status||'Pending Payment'}
        </span><br>
        <span style="font-size:0.85rem;color:var(--gray-600);">
          ${inv.customer?.name||'—'} · ${inv.customer?.email||'—'}
        </span><br>
        <span style="font-size:0.8rem;color:var(--gray-600);">
          ${(inv.products||[]).map(p=>p.name).join(', ')}
        </span>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        <select class="status-select" onchange="updateStatus('${inv.id}', this.value)">
          ${['Pending Payment','Paid','Processing','Delivered','Cancelled']
            .map(s=>`<option ${inv.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-outline" onclick="openDelivery('${inv.id}')">📦 Delivery</button>
        <button class="btn btn-sm btn-outline" onclick="viewInvoice('${inv.invoiceNumber}')">👁 View</button>
        <button class="btn btn-sm btn-outline" onclick="copyLink('${inv.invoiceNumber}')">🔗 Copy</button>
        <button class="btn btn-sm btn-outline" style="color:#991b1b;border-color:#fee2e2;"
                onclick="deleteInvoice('${inv.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function statusClass(s){
  if (s==='Paid' || s==='Delivered') return 'paid';
  if (s==='Processing') return 'processing';
  if (s==='Cancelled') return 'cancelled';
  return '';
}

// ============ SEARCH ============
window.searchInvoices = ()=>{
  const v = document.getElementById('searchInvoiceInput').value;
  loadInvoiceList(v);
};

// ============ UPDATE STATUS ============
window.updateStatus = async (id, status)=>{
  await update(ref(db,'invoices/'+id), { status });
  showToast('Status → ' + status);
};

// ============ VIEW INVOICE ============
window.viewInvoice = (invoiceNumber)=>{
  const base = location.pathname.replace(/\/[^/]*$/,'/');
  window.open(`${base}invoice.html?id=${invoiceNumber}`, '_blank');
};

// ============ COPY LINK ============
window.copyLink = (invoiceNumber)=>{
  const base = location.origin + location.pathname.replace(/\/[^/]*$/,'/');
  const link = `${base}invoice.html?id=${invoiceNumber}`;
  navigator.clipboard.writeText(link);
  showToast('🔗 Link copied');
};

// ============ DELETE ============
window.deleteInvoice = async (id)=>{
  if (!confirm('Delete this invoice permanently?')) return;
  await remove(ref(db,'invoices/'+id));
  showToast('Invoice deleted');
  loadInvoiceList();
};

// ============ DELIVERY MODAL ============
window.openDelivery = async (id)=>{
  deliveryInvoiceId = id;
  const snap = await get(ref(db,'invoices/'+id));
  if (!snap.exists()) return;
  const inv = snap.val();
  currentInvoiceForDelivery = inv;
  const existing = inv.delivery || {};

  const fields = (inv.products||[]).map((p,i)=>{
    return `
      <div class="form-group">
        <label class="form-label">${p.name} — Delivery Info</label>
        <input type="text" class="form-control delivery-input"
               data-index="${i}" value="${existing[p.name]||''}"
               placeholder="e.g. Delivered To / Added To / Activated On">
      </div>
    `;
  }).join('');

  document.getElementById('deliveryFormFields').innerHTML =
    fields || '<p>No products in this invoice.</p>';
  openModal('deliveryModal');
};

window.saveDeliveryInfo = async ()=>{
  if (!deliveryInvoiceId) return;
  const inputs = document.querySelectorAll('.delivery-input');
  const delivery = {};
  inputs.forEach(inp=>{
    const p = currentInvoiceForDelivery.products[inp.dataset.index];
    if (p && inp.value.trim()) delivery[p.name] = inp.value.trim();
  });
  await update(ref(db,'invoices/'+deliveryInvoiceId), { delivery });
  closeModal('deliveryModal');
  showToast('📦 Delivery info saved');
  loadInvoiceList();
};

// ============ PUBLIC INVOICE ============
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
  snap.forEach(c=>{ invoice = { id:c.key, ...c.val() }; });
  display.innerHTML = renderInvoiceHTML(invoice);
};

// ============ RENDER INVOICE HTML ============
export function renderInvoiceHTML(inv){
  const invNum = inv.invoiceNumber || 'INV-XXXX-XXXX';
  const date = inv.date ? new Date(inv.date).toLocaleDateString('en-GB',{
    day:'2-digit', month:'short', year:'numeric'
  }) : '—';
  const status = inv.status || 'Pending Payment';
  const cust = inv.customer || {};
  const products = inv.products || [];
  const delivery = inv.delivery || {};
  const total = inv.total || 0;

  const statusCls =
    (status==='Paid'||status==='Delivered') ? 'paid' :
    status==='Processing' ? 'processing' :
    status==='Cancelled' ? 'cancelled' : '';

  const rows = products.map(p=>{
    const fieldLines = (p.fields||[])
      .filter(f=>f.value)
      .map(f=>`<span class="custom-field-value">${f.label}: <strong>${f.value}</strong></span>`)
      .join(' ');
    const deliveryLine = delivery[p.name]
      ? `<div class="delivery-info-block">📦 <strong>Delivery:</strong> ${delivery[p.name]}</div>`
      : '';
    return `
      <tr>
        <td>
          <span class="product-name">${p.name}</span>
          ${fieldLines ? '<div style="margin-top:6px;">'+fieldLines+'</div>' : ''}
          ${deliveryLine}
        </td>
        <td>${p.quantity||1}</td>
        <td>$${(p.price||0).toFixed(2)}</td>
        <td>$${((p.price||0)*(p.quantity||1)).toFixed(2)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="invoice-preview">
      <div class="invoice-header">
        <div class="invoice-header-left">
          <div class="logo-icon">A</div>
          <div>
            <div class="store-name">ABDULLAH <span>DIGITAL</span> STORE</div>
            <div style="font-size:0.75rem;color:var(--gray-600);">
              Premium Digital Services
            </div>
          </div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-number">${invNum}</div>
          <div class="status-badge ${statusCls}">${status}</div>
          <div style="font-size:0.8rem;color:var(--gray-600);margin-top:6px;">
            Date: <strong>${date}</strong>
          </div>
        </div>
      </div>

      <div class="payment-info" style="background:var(--gray-100);border-left-color:var(--orange);">
        <div class="payment-item">
          <div class="payment-label">Bill To</div>
          <div class="payment-value">${cust.name||'—'}</div>
          <div style="font-size:0.8rem;color:var(--gray-600);">
            ${cust.email||''} ${cust.email&&cust.telegram?'·':''} ${cust.telegram||''}
          </div>
        </div>
        <div class="payment-item">
          <div class="payment-label">Invoice Date</div>
          <div class="payment-value">${date}</div>
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:50%;">Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
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

      <div class="payment-info">
        <div class="payment-item">
          <div class="payment-label">Payment Method</div>
          <div class="payment-value">Bkash / Nagad / Bank</div>
        </div>
        <div class="payment-item">
          <div class="payment-label">Payment Status</div>
          <div class="payment-value">${status}</div>
        </div>
      </div>

      <div class="notes-box">
        <h4>📌 Important Notes</h4>
        <ul style="padding-left:18px;font-size:0.9rem;color:#3d2400;">
          <li>Delivery time: 5–30 minutes after payment confirmation.</li>
          <li>Keep this invoice link safe for future reference.</li>
          <li>Do not share your account credentials with anyone.</li>
          <li>For support, contact us via email below.</li>
        </ul>
      </div>

      <div class="support-email">
        Need help? Contact us: <strong>kff138241@gmail.com</strong>
      </div>
    </div>
  `;
}

// ============ AUTO INIT ============
(async function init(){
  await loadProducts();
  // If on admin page
  if (document.getElementById('invoiceListContainer')){
    loadInvoiceList();
    // Nav tab listeners
    document.querySelectorAll('.nav-tab[data-page]').forEach(t=>{
      t.addEventListener('click', ()=> showPage(t.dataset.page));
    });
  }
  // If on index (public viewer)
  if (document.getElementById('publicInvoiceSearch')){
    // nothing else — user clicks button
  }
})();
