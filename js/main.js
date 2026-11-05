const MENU_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTE2kF8aZ19v81B347585_9oQ8u3z668853T49y3v-9U23315995o7q_4T85888/pub?output=csv";
const BOT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3Y2v_56V_26K28c3132B4_4v5y1Z958w0u_6w5R2Y3389Z53k68o_x_O3Y2v_56V/pub?output=csv";

let STORE_DATA = { deals: [], menu: [], videos: [] };
let cartData = [];
try { 
    const stored = localStorage.getItem('amaza_cart_memory');
    if (stored) cartData = JSON.parse(stored);
} catch(e) {}

let payMethod = 'CashApp';
let activeCategory = 'ALL';

const DEFAULT_DATA = { deals: [], menu: [], videos: [] };

function saveCartToMemory() { 
    try { localStorage.setItem('amaza_cart_memory', JSON.stringify(cartData)); } catch(e){} 
}

function checkIOSPWA() {
    const isIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
        setTimeout(() => {
            const pwaBanner = document.getElementById('ios-pwa-banner');
            if(pwaBanner) pwaBanner.style.display = 'flex';
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let ageVerified = false;
    try { ageVerified = (localStorage.getItem('amazaAgeVerified') === 'true'); } catch(e){}
    
    const gate = document.getElementById('age-gate');
    if (ageVerified) {
        if(gate) gate.style.display = 'none';
        document.body.classList.remove('locked');
        checkIOSPWA();
    } else {
        if(gate) gate.style.display = 'flex';
        document.body.classList.add('locked');
    }
    
    updateUI(); 
    loadData();
});

window.verifyAge = function(isAdult) {
    if (isAdult) {
        try { localStorage.setItem('amazaAgeVerified', 'true'); } catch(e) {}
        const gate = document.getElementById('age-gate');
        if(gate) gate.style.display = 'none';
        document.body.classList.remove('locked');
        window.scrollTo(0, 0);
        checkIOSPWA();
    } else { 
        window.location.href = "https://www.google.com"; 
    }
};

document.addEventListener('input', function (e) {
    if (e.target.id === 'c_phone') {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    }
});

function loadData() {
    if (!MENU_CSV_URL || !BOT_CSV_URL) { STORE_DATA = DEFAULT_DATA; renderAll(); return; }
    
    Papa.parse(BOT_CSV_URL, {
        download: true, header: false, skipEmptyLines: true,
        complete: function(botRes) {
            let liveStock = {};
            botRes.data.forEach(r => {
                if (r && r.length >= 4) {
                    const sku = String(r[0]).trim(); const botName = String(r[1]).trim().toLowerCase(); const status = String(r[3]).trim(); 
                    if (sku) liveStock[`sku_${sku}`] = status; if (botName) liveStock[`name_${botName}`] = status;
                }
            });
            Papa.parse(MENU_CSV_URL, {
                download: true, header: true, skipEmptyLines: true,
                complete: function(menuRes) {
                    const data = menuRes.data;
                    if (!data || data.length === 0) return;
                    data.forEach(row => {
                        const tdVideo = row['Touchdowns'] ? String(row['Touchdowns']).trim() : "";
                        if (tdVideo.length > 5 && !STORE_DATA.videos.includes(tdVideo)) {
                            STORE_DATA.videos.push(tdVideo);
                        }

                        const firstColKey = Object.keys(row)[0]; 
                        let rawCat = row.Category || row[firstColKey] || 'menu'; 
                        const origCat = String(rawCat).toLowerCase().trim();
                        const rawVideo = row.Video ? String(row.Video).trim() : ""; 
                        
                        const rawName = row.Name ? String(row.Name).trim() : ""; const rawImg = row.Image ? String(row.Image).trim() : ""; 
                        if (!rawName || rawName.includes('#N/A') || rawName.includes('NAME MISMATCH') || !rawImg || rawImg.length < 5) return; 
                        let optionsArray = [];
                        if (row.Options) {
                            const rawOptions = row.Options.split(',');
                            rawOptions.forEach(opt => {
                                const parts = opt.split('|');
                                if (parts.length === 3) optionsArray.push({ value: parseInt(parts[0].trim()), label: parts[1].trim(), text: parts[2].trim() });
                            });
                        }
                        const itemSku = row.SKU ? String(row.SKU).trim() : ""; const finalName = itemSku ? `[${itemSku}] ${rawName}` : rawName; let itemNote = "";
                        if (itemSku && liveStock[`sku_${itemSku}`] !== undefined) itemNote = liveStock[`sku_${itemSku}`]; else if (rawName && liveStock[`name_${rawName.toLowerCase()}`] !== undefined) itemNote = liveStock[`name_${rawName.toLowerCase()}`];
                        if (itemNote === undefined || itemNote === "") itemNote = row['Old Note'] || row['Status'] || "";
                        const product = { id: row.ID || Math.random().toString(36).substr(2, 9), name: finalName, badge: row.Badge || "", img: row.Image, videoUrl: rawVideo, desc: row.Desc, note: itemNote, options: optionsArray, origCat: origCat };
                        if (origCat.includes('deals')) STORE_DATA.deals.push(product); else STORE_DATA.menu.push(product);
                    });
                    renderAll();
                }
            });
        }
    });
}

window.selectSize = function(productId, price, weightLabel, btnElem) {
    const container = btnElem.closest('.p-info');
    container.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));
    btnElem.classList.add('selected');
    const priceDisplay = container.querySelector('.price-display'); if(priceDisplay) priceDisplay.innerText = `$${price}`;
    const addBtn = container.querySelector('.btn-add'); if(addBtn) { addBtn.setAttribute('data-price', price); addBtn.setAttribute('data-weight', weightLabel); }
};

function generateCardHTML(p, isDeal) {
    const firstOpt = p.options[0] || {value: 0, label: 'N/A', text: 'N/A'};
    const sizeBtns = p.options.map((opt, i) => {
        const selClass = i === 0 ? 'selected' : '';
        return `<div class="size-btn ${selClass}" onclick="selectSize('${p.id}', ${opt.value}, '${opt.label}', this)">${opt.label}</div>`;
    }).join('');
    
    const badgeHTML = p.badge ? `<div class="badge">${p.badge}</div>` : (isDeal ? `<div class="badge">DEAL</div>` : '');
    const videoBadge = p.videoUrl && p.videoUrl.length > 5 ? `<div class="vip-vid-badge" onclick="openDetailModal('${isDeal ? 'deals' : 'menu'}', '${p.id}', true)"><i class="fa-solid fa-play"></i> Video</div>` : '';
    const pricesData = p.options.map(o=>o.value).join(',');
    
    const stockHTML = p.note ? `<div class="stock-status">✓ ${p.note}</div>` : `<div class="stock-status">✓ In Stock</div>`;

    return `
    <div class="p-card" data-cat="${p.origCat}" data-name="${p.name.toLowerCase()}" data-prices="${pricesData}">
        ${badgeHTML}
        <div class="p-img-wrap">
            ${videoBadge}
            <img src="${p.img}" class="p-img" onclick="openDetailModal('${isDeal ? 'deals' : 'menu'}', '${p.id}', false)">
        </div>
        <div class="p-info">
            <h3 class="p-title" onclick="openDetailModal('${isDeal ? 'deals' : 'menu'}', '${p.id}', false)">${p.name}</h3>
            <div class="rating">★★★★★ 4.9</div>
            <div class="price-display">$${firstOpt.value}</div>
            <div class="size-grid">${sizeBtns}</div>
            ${stockHTML}
            <button class="btn-add" data-name="${p.name.replace(/"/g, '&quot;')}" data-price="${firstOpt.value}" data-weight="${firstOpt.label}" onclick="addFoolproof('${p.id}', this.getAttribute('data-name'), this)">Add to Cart</button>
        </div>
    </div>`;
}

function renderAll() {
    const dealsHtml = STORE_DATA.deals.filter(p => !((p.note || '').trim().toUpperCase().includes('SOLD'))).map(p => generateCardHTML(p, true)).join('');
    document.getElementById('dynamic-deals').innerHTML = dealsHtml;

    const flowerHtml = STORE_DATA.menu.filter(p => { 
        const status = (p.note || '').trim().toUpperCase(); 
        return !status.includes('SOLD') && !p.origCat.includes('product'); 
    }).map(p => generateCardHTML(p, false)).join('');
    document.getElementById('dynamic-flower').innerHTML = flowerHtml;
    
    const productHtml = STORE_DATA.menu.filter(p => { 
        const status = (p.note || '').trim().toUpperCase(); 
        return !status.includes('SOLD') && p.origCat.includes('product'); 
    }).map(p => generateCardHTML(p, false)).join('');
        
    const prodContainer = document.getElementById('dynamic-product');
    const prodSection = document.getElementById('menu-product');
    if(prodContainer) {
        prodContainer.innerHTML = productHtml;
        if(prodSection) prodSection.style.display = productHtml.length === 0 ? 'none' : 'block';
    }
}

window.liveSearchFilter = function(event) {
    const searchInput = document.getElementById('live-search');
    if (!searchInput) return;
    
    const rawInput = searchInput.value.toLowerCase().trim();
    const inputNoDollar = rawInput.replace(/\$/g, '');
    const isNumeric = rawInput.length > 0 && /^\$?\d+$/.test(rawInput);
    const searchVal = isNumeric ? parseInt(inputNoDollar) : NaN;

    const menuCards = document.querySelectorAll('.p-card');
    let fCount = 0, pCount = 0, dCount = 0;

    menuCards.forEach(card => {
        const cCat = (card.getAttribute('data-cat') || '').toLowerCase();
        const cName = (card.getAttribute('data-name') || '').toLowerCase();
        const pricesArr = (card.getAttribute('data-prices') || '').split(',').map(Number);
        
        let catMatch = true;
        if (activeCategory === 'FLOWER') catMatch = (cCat.includes('flower') || cCat.includes('menu') || cCat === '' || !cCat.includes('product')); 
        else if (activeCategory === 'PRODUCT') catMatch = cCat.includes('product'); 

        let matchesSearch = false;
        if (cName.includes(inputNoDollar)) matchesSearch = true;
        else if (isNumeric && !isNaN(searchVal)) matchesSearch = pricesArr.some(p => p >= searchVal - 100 && p <= searchVal + 100);

        if (catMatch && matchesSearch) { 
            card.style.display = ''; 
            if(card.closest('#dynamic-flower')) fCount++;
            if(card.closest('#dynamic-product')) pCount++;
            if(card.closest('#dynamic-deals')) dCount++;
        } else { 
            card.style.display = 'none'; 
        }
    });
    
    const sFlower = document.getElementById('menu-flower');
    const sProduct = document.getElementById('menu-product');
    const sDeals = document.getElementById('deals');
    
    if(sFlower) sFlower.style.display = (fCount > 0) ? 'block' : 'none';
    if(sProduct) sProduct.style.display = (pCount > 0) ? 'block' : 'none';
    if(sDeals) sDeals.style.display = (dCount > 0) ? 'block' : 'none';

    if (event && event.key === 'Enter') searchInput.blur();
};

window.filterMenu = function(category, btnElem) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); 
    btnElem.classList.add('active');
    activeCategory = category;
    liveSearchFilter();
    window.scrollTo({ top: 0, behavior: "smooth" }); 
};

window.openDetailModal = function(category, id, forceVideo = false) {
    const product = STORE_DATA[category].find(item => item.id === id); if (!product) return;
    
    let imgEl = document.getElementById('detail-img'); let vidEl = document.getElementById('dynamic-detail-vid'); let overlayBtn = document.getElementById('modal-vid-overlay-btn');
    const hasVideo = product.videoUrl && product.videoUrl.length > 5;
    
    if (forceVideo && hasVideo) { 
        imgEl.style.display = 'none'; overlayBtn.style.display = 'none'; vidEl.src = product.videoUrl; vidEl.style.display = 'block'; vidEl.play().catch(()=>{}); 
    } else { 
        vidEl.style.display = 'none'; vidEl.src = ''; imgEl.style.display = 'block'; imgEl.src = product.img; 
        if (hasVideo) {
            overlayBtn.style.display = 'flex';
            overlayBtn.onclick = () => { imgEl.style.display = 'none'; overlayBtn.style.display = 'none'; vidEl.src = product.videoUrl; vidEl.style.display = 'block'; vidEl.play().catch(()=>{}); };
        } else { overlayBtn.style.display = 'none'; } 
    }
    
    document.getElementById('detail-title').innerText = product.name;
    const firstOpt = product.options[0] || {value: 0, label: 'N/A', text: 'N/A'};
    const sizeBtns = product.options.map((opt, i) => { const selClass = i === 0 ? 'selected' : ''; return `<div class="size-btn ${selClass}" onclick="selectSize('${product.id}', ${opt.value}, '${opt.label}', this)">${opt.label}</div>`; }).join('');
    
    const stockHTML = product.note ? `<div class="stock-status" style="margin-top: 10px;">✓ ${product.note}</div>` : `<div class="stock-status" style="margin-top: 10px;">✓ In Stock</div>`;

    const actionHtml = `
        <div class="price-display" style="font-size: 28px;">$${firstOpt.value}</div>
        <div class="size-grid">${sizeBtns}</div>
        ${stockHTML}
        <button class="btn-add" style="margin-top: 15px; padding: 12px; font-size: 16px;" data-name="${product.name.replace(/"/g, '&quot;')}" data-price="${firstOpt.value}" data-weight="${firstOpt.label}" onclick="addFoolproof('${product.id}', this.getAttribute('data-name'), this)">Add to Cart</button>
    `;
    document.getElementById('detail-actions').innerHTML = actionHtml; 
    document.getElementById('detail-modal').style.display = 'flex'; 
    document.body.classList.add('locked');
};

window.closeDetailModal = function() { document.getElementById('detail-modal').style.display = 'none'; document.body.classList.remove('locked'); let vidEl = document.getElementById('dynamic-detail-vid'); if (vidEl) { vidEl.pause(); vidEl.src = ''; vidEl.style.display = 'none'; } };

window.addFoolproof = function(id, baseName, btnElem) { 
    if (typeof navigator.vibrate === "function") { navigator.vibrate(15); }
    let price = parseInt(btnElem.getAttribute('data-price')); let weightText = btnElem.getAttribute('data-weight');
    if (!price || !weightText) return;
    let finalName = baseName + ' (' + weightText + ')'; let uniqueId = id + '-' + weightText.replace(/\s+/g, '');
    let item = cartData.find(i => i.id === uniqueId); if (item) item.qty++; else cartData.push({ id: uniqueId, name: finalName, price: price, qty: 1 }); saveCartToMemory(); updateUI();
    if (btnElem) { let originalText = btnElem.innerText; btnElem.innerText = "Added to Cart ✓"; btnElem.style.background = "#007600"; btnElem.style.color = "#fff"; setTimeout(() => { btnElem.innerText = originalText; btnElem.style.background = ""; btnElem.style.color = ""; }, 1000); }
};

window.changeQty = function(id, delta) { let item = cartData.find(i => i.id === id); if (!item) return; item.qty += delta; if (item.qty <= 0) cartData = cartData.filter(i => i.id !== id); saveCartToMemory(); updateUI(); };

function updateUI() {
    let subtotal = 0, count = 0, html = '';
    if (cartData.length === 0) { html = '<div style="text-align:center;font-size:16px;color:#555;margin-top:40px;font-weight:700;">Your Amazon Cart is empty.</div>'; } else {
        cartData.forEach(item => { let total = item.price * item.qty; subtotal += total; count += item.qty; html += `<div class="cd-item"><div class="cd-item-name">${item.name}</div><div class="cd-item-row"><div style="font-size: 16px; font-weight: 800; color: #b12704;">$${total}</div><div style="display:flex; align-items:center; gap:10px; background:#f0f2f2; border:1px solid #d5d9d9; border-radius:4px; padding:2px 8px;"><button style="background:none; border:none; font-size:16px; cursor:pointer;" onclick="changeQty('${item.id}', -1)">-</button><span style="font-weight:700;">${item.qty}</span><button style="background:none; border:none; font-size:16px; cursor:pointer;" onclick="changeQty('${item.id}', 1)">+</button></div></div></div>`; });
    }
    document.getElementById('nav-count').innerText = count; document.getElementById('cart-items').innerHTML = html;
    
    let shipping = subtotal >= 150 ? 0 : 50; 
    document.getElementById('cart-sub').innerText = `$${subtotal}`; document.getElementById('sum-sub').innerText = `$${subtotal}`; document.getElementById('sum-ship').innerText = shipping === 0 ? 'FREE' : `$${shipping}`; document.getElementById('sum-total').innerText = `$${subtotal + shipping}`;
    
    const freeMsg = document.getElementById('free-ship-msg');
    if(freeMsg) {
        if(subtotal >= 150) { freeMsg.innerHTML = '🎉 You qualify for FREE Prime-Speed Shipping!'; freeMsg.style.background = '#e7f4e4'; freeMsg.style.color = '#007600'; }
        else { const away = 150 - subtotal; freeMsg.innerHTML = `Add <span style="color:#b12704;">$${away}</span> for FREE Expedited Shipping!`; freeMsg.style.background = '#fef8f2'; freeMsg.style.color = '#111'; }
    }
}

window.openCart = function() { document.getElementById('cart-drawer').classList.add('active'); document.getElementById('cart-bg').style.display = 'block'; };
window.closeCart = function() { document.getElementById('cart-drawer').classList.remove('active'); document.getElementById('cart-bg').style.display = 'none'; };
window.openCheckoutModal = function() { if (cartData.length === 0) return alert("Your cart is empty."); closeCart(); document.getElementById('checkout-view').style.display = 'flex'; document.body.classList.add('locked'); };
window.closeCheckoutModal = function() { document.getElementById('checkout-view').style.display = 'none'; document.body.classList.remove('locked'); };
window.pickPay = function(el, method) { document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected')); el.classList.add('selected'); payMethod = method; };

window.submitOrder = function() {
    const name = document.getElementById('c_name').value.trim(); const phone = document.getElementById('c_phone').value.trim(); const address = document.getElementById('c_address').value.trim();
    if (name.length < 2) { alert("Please enter a valid Name."); return; }
    const phoneDigits = phone.replace(/\D/g, ''); if (phoneDigits.length < 10) { alert("Please enter a valid 10-digit Phone Number."); return; }
    if (address.length < 10) { alert("Please enter your complete Delivery Address."); return; }

    let itemsText = ""; let subtotal = 0;
    cartData.forEach(item => { let lineTotal = item.price * item.qty; subtotal += lineTotal; itemsText += `▪️ ${item.name} x${item.qty} ($${lineTotal})\n`; });

    let shipping = subtotal >= 150 ? 0 : 50; let totalDue = subtotal + shipping;
    const finalOrderText = "--- NEW AMAZA ORDER ---\n👤 Name: " + name + "\n📞 Phone: " + phone + "\n📍 Address: " + address + "\n💳 Pay with: " + (payMethod || "Not Selected") + "\n\n📦 ITEMS:\n" + itemsText + "\n🚚 Shipping: $" + shipping + "\n💰 TOTAL DUE: $" + totalDue + "\n---------------------";
    const encodedOrder = encodeURIComponent(finalOrderText); const tgCheckoutUrl = `https://t.me/dontbenosy888?text=${encodedOrder}`;

    navigator.clipboard.writeText(finalOrderText).catch(()=>{});
    window.location.href = tgCheckoutUrl; 
    cartData = []; saveCartToMemory(); updateUI(); closeCheckoutModal();
};
