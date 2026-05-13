
const API = window.location.port === '5000' ? window.location.origin : 'http://localhost:5000';

let users = [
  { name: 'Ahmet Kaya', role: 'Yönetici', color: '#1f6feb', icon: '👨‍💼', pwd: '1234' },
  { name: 'Fatma Öz', role: 'Şef Barista', color: '#1d9e75', icon: '👩‍🍳', pwd: '1234' },
  { name: 'Murat Demir', role: 'Stok Sorumlusu', color: '#ba7517', icon: '📦', pwd: '1234' },
  { name: 'Zeynep Ak', role: 'Kasiyer', color: '#8250df', icon: '💳', pwd: '1234' }
];

let currentUser = users[0];
let stokData = [];
let urunler = [];
let tariflerData = {};
let aiAnalysis = null;
let stokChart = null;
let malzemeChart = null;

// ── USER MANAGEMENT ────────────────────────────────
function renderUsers() {
  const list = document.getElementById('userList');
  if(!list) return;
  list.innerHTML = users.map((u, i) => `
    <div class="user-opt ${u.name === currentUser.name ? 'selected' : ''}" 
         onclick="selectUser(this, '${u.name}')"
         data-color="${u.color}">
      <div class="uo-icon">${u.icon || '👤'}</div>
      <div class="uo-name">${u.name}</div>
      <div class="uo-role">${u.role}</div>
    </div>
  `).join('');
}

function selectUser(el, name) {
  document.querySelectorAll('.user-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  currentUser = users.find(u => u.name === name);
}

function showRegister() {
  const loginPage = document.getElementById('loginPage');
  const registerPage = document.getElementById('registerPage');
  if(loginPage) loginPage.style.display = 'none';
  if(registerPage) registerPage.style.display = 'flex';
}

function hideRegister() {
  const loginPage = document.getElementById('registerPage');
  const registerPage = document.getElementById('loginPage');
  if(loginPage) loginPage.style.display = 'none';
  if(registerPage) registerPage.style.display = 'flex';
}

function doRegister() {
  const name = document.getElementById('regName').value;
  const role = document.getElementById('regRole').value;
  const icon = document.getElementById('regIcon').value;
  const color = document.getElementById('regColor').value;
  const pwd = document.getElementById('regPwd').value || '1234';
  
  if(!name) { alert('Lütfen isim giriniz!'); return; }
  
  users.push({ name, role, icon, color, pwd });
  alert('Kullanıcı başarıyla oluşturuldu! Şifreniz: ' + pwd);
  renderUsers();
  hideRegister();
}

function doLogin() {
  const inputPwd = document.getElementById('loginPwd').value;
  
  if (currentUser && inputPwd === currentUser.pwd) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    initApp();
  } else {
    alert('Hatalı şifre! Lütfen seçtiğiniz kullanıcıya ait şifreyi girin.');
  }
}

function doLogout() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

// ── NAVIGATION ────────────────────────────────────
function showPage(id, event) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const page = document.getElementById('page-' + id);
  if(page) page.classList.add('active');
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  
  if (id === 'malzeme') loadMalzeme();
  if (id === 'tarifler') loadTarifler();
  if (id === 'urunler') loadUretim();
  if (id === 'personel') loadPersonelTable();
  if (id === 'finans') loadFinans();
  if (id === 'dashboard') { loadStok(); loadFinans(); loadDashboardAnaliz(); }
}

// ── INIT ───────────────────────────────────────────
async function initApp() {
  const avatarEl = document.getElementById('avatarEl');
  if(avatarEl) {
    avatarEl.textContent = currentUser.name.split(' ').map(w=>w[0]).join('');
    avatarEl.style.background = currentUser.color + '22';
    avatarEl.style.color = currentUser.color;
  }
  
  const userNameEl = document.getElementById('userNameEl');
  const userRoleEl = document.getElementById('userRoleEl');
  if(userNameEl) userNameEl.textContent = currentUser.name;
  if(userRoleEl) userRoleEl.textContent = currentUser.role;
  
  const dashDate = document.getElementById('dashDate');
  if(dashDate) dashDate.textContent = new Date().toLocaleDateString('tr-TR', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  // ADMIN KONTROLÜ
  const adminMenu = document.getElementById('adminMenu');
  if (adminMenu) {
    adminMenu.style.display = (currentUser.role === 'Yönetici') ? 'block' : 'none';
  }

  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('satisTarih')) document.getElementById('satisTarih').value = today;
  if(document.getElementById('stokTarih')) document.getElementById('stokTarih').value = today;

  await loadStok();
  await loadFinans();
  await loadDashboardAnaliz();
  await loadUrunSelect();
  renderStokChart();
}

// ── ADMIN ÖZEL ────────────────────────────────────
function loadPersonelTable() {
  const tbody = document.getElementById('personelTable');
  if(!tbody) return;
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td><span class="badge ${u.role === 'Yönetici' ? 'badge-purple' : 'badge-blue'}">${u.role}</span></td>
      <td><div style="width:12px;height:12px;border-radius:50%;background:${u.color}"></div></td>
      <td><span class="badge badge-green">Aktif</span></td>
      <td>
        ${u.name !== 'Ahmet Kaya' ? `<button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteUser(${i})">Sil</button>` : '-'}
      </td>
    </tr>
  `).join('');
}

function deleteUser(idx) {
  if (confirm(users[idx].name + ' personeli silinsin mi?')) {
    users.splice(idx, 1);
    loadPersonelTable();
    renderUsers();
  }
}

async function loadFinans() {
  const list = document.getElementById('karAnalizList');
  const finCiro = document.getElementById('finCiro');
  const finMaliyet = document.getElementById('finMaliyet');
  const finKar = document.getElementById('finKar');
  
  try {
    const r = await fetch(API + '/finans/analiz');
    if (!r.ok) throw new Error('Sunucu yanıt vermedi');
    const d = await r.json();
    
    // Üst kartları güncelle
    if(finCiro) finCiro.textContent = d.toplam_ciro.toLocaleString('tr-TR') + ' TL';
    if(finMaliyet) finMaliyet.textContent = Math.round(d.toplam_maliyet).toLocaleString('tr-TR') + ' TL';
    if(finKar) finKar.textContent = Math.round(d.net_kar).toLocaleString('tr-TR') + ' TL';

    if(!list) return;
    list.innerHTML = d.analiz.map(u => {
      const totalCost = Math.round(u.birim_maliyet || 0);
      const rawCost = Math.round(u.hammadde_maliyeti || 0);
      const price = Math.round(u.ortalama_satis_fiyat || 0);
      const profit = price - totalCost;
      return `
        <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text)">${u.urun_adi || 'Bilinmeyen Ürün'}</div>
            <div style="font-size:11px;color:var(--text3); margin-top:2px;">
              Hammadde: <span style="color:var(--text2)">${rawCost} TL</span> | 
              <span title="Personel + Lojistik + Sabit Gider">Genel Gider Dahil:</span> <span style="color:var(--blue); font-weight:500;">${totalCost} TL</span>
            </div>
            <div style="font-size:11px;color:var(--text3)">Ort. Satış: <span style="color:var(--green)">${price} TL</span></div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; justify-content:center;">
            <div style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700; font-size:15px;">${profit >= 0 ? '+' : ''}${profit} TL</div>
            <div style="font-size:10px;color:var(--text3); font-weight:500;">Birim Net Kâr</div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    console.error('Finans yükleme hatası:', e);
  }
}

// Sayfa yüklendiğinde kullanıcıları listele
window.onload = () => {
  renderUsers();
};

// ── LOAD STOK ─────────────────────────────────────
async function loadStok() {
  try {
    const r = await fetch(API + '/stok/mevcut');
    if (!r.ok) throw new Error();
    const d = await r.json();
    stokData = d.urunler;
    const oz = d.ozet;
    
    const elements = {
        'mToplam': oz.toplam,
        'mKritik': oz.kritik,
        'mDusuk': oz.dusuk,
        'mYeterli': oz.yeterli,
        'kritikBadge': oz.kritik,
        'uyariBadge': oz.kritik + ' ürün'
    };

    for (let id in elements) {
        const el = document.getElementById(id);
        if(el) el.textContent = elements[id];
    }

    renderStokTable(stokData);
    renderUyariler(stokData.filter(u => u.durum === 'Kritik'));
  } catch(e) {
    useDemoData();
  }
}

function useDemoData() {
  const demo = [
    {urun_id:'P001',urun_adi:'Çay',mevcut_stok:386,kritik_esik:50,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:3},
    {urun_id:'P002',urun_adi:'Türk Kahvesi',mevcut_stok:105,kritik_esik:30,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P003',urun_adi:'Latte',mevcut_stok:80,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:3},
    {urun_id:'P004',urun_adi:'Ice Latte',mevcut_stok:252,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Yerel İçecek Dağıtım',Tedarik_Suresi_Gun:2},
    {urun_id:'P005',urun_adi:'Americano',mevcut_stok:17,kritik_esik:25,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P006',urun_adi:'Ice Americano',mevcut_stok:42,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P007',urun_adi:'Cappuccino',mevcut_stok:22,kritik_esik:20,durum:'Düşük',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P008',urun_adi:'Limonata',mevcut_stok:12,kritik_esik:20,durum:'Kritik',Tedarikci_Adi:'Yerel Dağıtım',Tedarik_Suresi_Gun:3},
    {urun_id:'P009',urun_adi:'Espresso',mevcut_stok:0,kritik_esik:20,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P010',urun_adi:'Filtre Kahve',mevcut_stok:55,kritik_esik:30,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P011',urun_adi:'Mocha',mevcut_stok:38,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P026',urun_adi:'San Sebastian',mevcut_stok:88,kritik_esik:15,durum:'Yeterli',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
    {urun_id:'P027',urun_adi:'Tiramisu',mevcut_stok:8,kritik_esik:15,durum:'Kritik',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
    {urun_id:'P028',urun_adi:'Brownie',mevcut_stok:45,kritik_esik:20,durum:'Yeterli',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
    {urun_id:'P032',urun_adi:'Kruvasan',mevcut_stok:47,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
  ];
  stokData = demo;
  urunler = demo;
  const kritikSay = demo.filter(u=>u.durum==='Kritik').length;
  const dusukSay = demo.filter(u=>u.durum==='Düşük').length;
  const yeterliSay = demo.filter(u=>u.durum==='Yeterli').length;
  
  const elMap = {'mToplam':demo.length, 'mKritik':kritikSay, 'mDusuk':dusukSay, 'mYeterli':yeterliSay, 'kritikBadge':kritikSay, 'uyariBadge': kritikSay + ' ürün'};
  for(let id in elMap) {
      const el = document.getElementById(id);
      if(el) el.textContent = elMap[id];
  }

  renderStokTable(stokData);
  renderUyariler(stokData.filter(u=>u.durum==='Kritik'));
  populateSelects(demo);
}

function renderUyariler(kritikler) {
  const el = document.getElementById('uyariListesi');
  if(!el) return;
  if (!kritikler.length) { el.innerHTML = '<div class="alert alert-ok"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-title">Tüm stoklar yeterli</div></div></div>'; return; }
  el.innerHTML = kritikler.map(u => `
    <div class="alert alert-critical">
      <div class="alert-icon">🔴</div>
      <div class="alert-body">
        <div class="alert-title" style="color:var(--red)">${u.urun_adi}</div>
        <div class="alert-desc">Mevcut: <strong>${u.mevcut_stok}</strong> | Kritik eşik: ${u.kritik_esik} | Tedarik: ${u.Tedarik_Suresi_Gun || '?'} gün</div>
      </div>
    </div>
  `).join('');
}

function getArrivalDate(days) {
  if (!days) return '-';
  const date = new Date();
  date.setDate(date.getDate() + parseInt(days));
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function renderStokTable(data) {
  const tbody = document.getElementById('stokTable');
  if(!tbody) return;
  tbody.innerHTML = data.map(u => {
    const pct = Math.min(100, Math.round((u.mevcut_stok / (u.kritik_esik * 3)) * 100));
    const col = u.durum === 'Kritik' ? 'var(--red)' : u.durum === 'Düşük' ? 'var(--amber)' : 'var(--green)';
    const badge = u.durum === 'Kritik' ? 'badge-red' : u.durum === 'Düşük' ? 'badge-amber' : 'badge-green';
    const arrival = getArrivalDate(u.Tedarik_Suresi_Gun);
    
    return `<tr>
      <td style="font-weight:500">${u.urun_adi}</td>
      <td><strong>${u.mevcut_stok} ${u.Birim}</strong></td>
      <td>${u.kritik_esik} ${u.Birim}</td>
      <td style="min-width:100px">
        <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${pct}%</div>
      </td>
      <td><span class="badge ${badge}">${u.durum}</span></td>
      <td style="color:var(--text2)">${u.Tedarikci_Adi || '-'}</td>
      <td>
        <div style="font-size:12px;color:var(--text2)">🚚 ${u.Tedarik_Suresi_Gun || '?'} Gün (Lojistik)</div>
        <div style="font-size:11px;color:var(--blue);font-weight:500">📅 Varış: ${arrival}</div>
      </td>
    </tr>`;
  }).join('');
}

function filterStok(q) {
  const filtered = stokData.filter(u => u.urun_adi.toLowerCase().includes(q.toLowerCase()));
  renderStokTable(filtered);
}

function renderStokChart() {
  if (!stokData.length) return;
  const kritik = stokData.filter(u=>u.durum==='Kritik').length;
  const dusuk = stokData.filter(u=>u.durum==='Düşük').length;
  const yeterli = stokData.filter(u=>u.durum==='Yeterli').length;
  const ctx = document.getElementById('stokChart');
  if(!ctx || typeof Chart === 'undefined') return;
  
  if (stokChart) stokChart.destroy();
  stokChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Kritik','Düşük','Yeterli'],
      datasets: [{ data: [kritik, dusuk, yeterli], backgroundColor: ['#f85149','#e3b341','#3fb950'], borderWidth: 2, borderColor: '#161b22', hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b949e', font: { size: 12 }, padding: 16 } } }
    }
  });
}

// ── AI ANALİZ ─────────────────────────────────────
async function typeWriter(text, elementId, speed = 15) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '';
  let i = 0;
  return new Promise(resolve => {
    function type() {
      if (i < text.length) {
        el.innerHTML += text.charAt(i);
        i++;
        setTimeout(type, speed);
      } else {
        resolve();
      }
    }
    type();
  });
}

function renderClaudeResult(d) {
  const mainEl = document.getElementById('aiOutputMain');
  const ozEl = document.getElementById('aiOzet');
  if(!mainEl || !ozEl) return;
  
  ozEl.innerHTML = `<span style="color:#38bdf8; font-weight:700;">✨ Claude AI:</span> ${d.ozet.substring(0, 80)}...`;

  mainEl.innerHTML = `
    <div id="aiMainText" style="margin-bottom:20px; font-weight:500; font-size:15px; color:#f1f5f9; line-height:1.7; background: rgba(56, 189, 248, 0.05); padding: 18px; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.15); box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.05); white-space: pre-line;"></div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="ai-insight-card" style="border-color: #f85149; background: rgba(248, 81, 73, 0.03); border-radius: 12px; border-width: 1px; border-left-width: 4px; white-space: pre-line;">
        <div class="ai-insight-label" style="color:#f85149; font-size:10px; letter-spacing:1px;">🚨 Kritik Riskler</div>
        <div id="aiRisks" style="font-size:13px; color:#cbd5e1; line-height:1.5;"></div>
      </div>
      <div class="ai-insight-card" style="border-color: #3fb950; background: rgba(63, 185, 80, 0.03); border-radius: 12px; border-width: 1px; border-left-width: 4px; white-space: pre-line;">
        <div class="ai-insight-label" style="color:#3fb950; font-size:10px; letter-spacing:1px;">💡 Stratejik Öneriler</div>
        <div id="aiActions" style="font-size:13px; color:#cbd5e1; line-height:1.5;"></div>
      </div>
    </div>
  `;

  typeWriter(d.ozet, 'aiMainText', 8).then(() => {
    const kritikler = (d.acil_siparisler || []).filter(s => s.aciliyet === 'kritik');
    const risks = kritikler.length > 0
      ? kritikler.map(s => `• ${s.urun_adi}: ${s.neden}`).join('\n')
      : (d.uyarilar || []).map(u => `• ${u.urun_adi}: ${u.mesaj}`).join('\n');
    typeWriter(risks || 'Kritik bir risk saptanmadı.', 'aiRisks', 5);

    const actions = (d.acil_siparisler || []).slice(0, 4)
      .map(t => `• ${t.urun_adi}: ${t.onerilen_siparis_miktari.toLocaleString()} ${t.birim} sipariş et`).join('\n');
    typeWriter(actions || 'Mevcut plan stabil görünüyor.', 'aiActions', 5);
  });

  renderSiparisCards(d);
}

async function runAI() {
  const mainEl = document.getElementById('aiOutputMain');
  if(!mainEl) return;
  mainEl.innerHTML = `
    <div class="ai-loading-wrap">
      <div class="ai-spinner"></div>
      <div style="color:#38bdf8; font-weight:600; letter-spacing:1px; margin-top:10px;">CLAUDE AI ANALİZ MOTORU ÇALIŞIYOR...</div>
    </div>
  `;

  setTimeout(async () => {
    try {
      const r = await fetch(API + '/ai/analiz');
      const d = await r.json();
      renderClaudeResult(d);
    } catch(e) {
      const demo = {
        ozet: "Mevcut veriler soğuk içecek grubunda %25 talep artışı öngörüyor. Stok seviyeleri kritik eşik sınırında seyrediyor. Lojistik optimizasyonu için toplu hammadde alımı önerilir.",
        acil_siparisler: [
          {urun: "Ice Latte", miktar: 150, neden: "Hava sıcaklığı artışı kaynaklı talep patlaması."},
          {urun: "Limonata", miktar: 100, neden: "Kritik stok seviyesinin %30 altında."}
        ],
        aylik_tedarik: [{malzeme: "Süt", miktar: 500, birim: "L"}, {malzeme: "Kahve", miktar: 50, birim: "kg"}]
      };
      renderClaudeResult(demo);
    }
  }, 1200);
}

// ── TAHMİN ────────────────────────────────────────
async function runTahmin() {
  const grid = document.getElementById('tahminGrid');
  const mHafta = document.getElementById('malzemeHafta');
  if(!grid || !mHafta) return;
  
  grid.innerHTML = '<div style="color:var(--text3)"><span class="pulse"></span> Satış tahminleri hesaplanıyor...</div>';
  mHafta.innerHTML = '<div style="color:var(--text3)"><span class="pulse"></span> Malzeme ihtiyacı hesaplanıyor...</div>';
  
  try {
    const r = await fetch(API + '/ai/analiz');
    const d = await r.json();
    if(d.haftalik_tahmin) {
        renderTahminGrid(d.haftalik_tahmin);
        // backend'den gelen tum_ihtiyac verisini dashboard/analiz'den çekmek daha doğru olabilir 
        // veya burada d.haftalik_tahmin üzerinden frontend'de hesaplayabiliriz.
        // Kullanıcı hem ürünleri hem malzemeleri ayrı ayrı görmek istiyor.
        const rDash = await fetch(API + '/dashboard/analiz');
        const dDash = await rDash.json();
        renderMalzemeHafta(dDash.tum_ihtiyac);
    } else {
        renderDemoTahmin();
    }
  } catch(e) {
    renderDemoTahmin();
  }
}

function renderTahminGrid(tahminler) {
  const el = document.getElementById('tahminGrid');
  if (!el) return;
  if (!tahminler || !tahminler.length) { el.innerHTML = '<div style="color:var(--text3)">Veri yok</div>'; return; }
  
  el.innerHTML = tahminler.map(t => {
    const urun = t.Urun_Adi || t.urun || 'Bilinmeyen';
    const satis = Math.round(t.haftalik_tahmin || t.tahmini_satis || 0);
    const gunluk = Math.round(t.gunluk_tahmin || satis/7);
    const trend = t.trend || 'stabil';
    const tc = trend==='artiyor'?'trend-up':trend==='azaliyor'?'trend-down':'trend-stable';
    const ti = trend==='artiyor'?'↑':trend==='azaliyor'?'↓':'→';
    
    return `<div class="forecast-card">
      <div class="forecast-name">${urun}</div>
      <div class="forecast-val">${satis}</div>
      <div class="forecast-row"><span>Haftalık Satış (Tahmin)</span><span class="${tc}">${ti} ${trend}</span></div>
      <div class="forecast-row"><span>Günlük Ortalama</span><span>${gunluk}</span></div>
    </div>`;
  }).join('');
}

function renderMalzemeHafta(malzemeler) {
  const el = document.getElementById('malzemeHafta');
  if (!el) return;
  if (!malzemeler || !malzemeler.length) { el.innerHTML = '<div style="color:var(--text3)">Malzeme ihtiyacı saptanmadı.</div>'; return; }

  el.innerHTML = `
    <div style="font-size:12px; color:var(--text3); margin-bottom:12px;">Haftalık satış tahminlerine göre stoktan düşülmesi veya tedarik edilmesi gereken toplam miktarlar:</div>
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:10px;">
      ${malzemeler.map(h => {
        const isKritik = h.eksik > 0;
        return `
          <div style="background:var(--bg3); border:1px solid ${isKritik ? 'var(--red)' : 'var(--border)'}; border-radius:8px; padding:12px; position:relative; overflow:hidden;">
            ${isKritik ? '<div style="position:absolute; top:0; right:0; background:var(--red); color:white; font-size:9px; padding:2px 6px; border-bottom-left-radius:6px; font-weight:700;">STOK YETERSİZ</div>' : ''}
            <div style="font-size:13px; font-weight:600; color:var(--text2); margin-bottom:4px;">${h.hammadde_adi}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <div>
                <div style="font-size:10px; color:var(--text3);">Gereken Miktar</div>
                <div style="font-size:18px; font-weight:700; color:var(--blue);">${h.gereken_stok} <span style="font-size:12px; font-weight:400;">${h.birim}</span></div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:10px; color:var(--text3);">Mevcut Stok</div>
                <div style="font-size:14px; font-weight:600; color:${isKritik ? 'var(--red)' : 'var(--green)'};">${h.mevcut_stok} ${h.birim}</div>
              </div>
            </div>
            ${isKritik ? `<div style="margin-top:8px; font-size:11px; color:var(--red); border-top:1px solid rgba(248,81,73,0.1); padding-top:6px;">⚠️ Eksik: <strong>${h.eksik} ${h.birim}</strong> tedarik edilmeli.</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDemoTahmin() {
  const grid = document.getElementById('tahminGrid');
  const mHafta = document.getElementById('malzemeHafta');
  if(grid) grid.innerHTML = '<div style="color:var(--amber)">⚠️ API bağlantısı yok - Demo veriler gösteriliyor.</div>';
  
  const demoProducts = [
    {urun: 'Çay', haftalik: 420, trend: 'stabil'},
    {urun: 'Latte', haftalik: 185, trend: 'artiyor'},
    {urun: 'San Sebastian', haftalik: 92, trend: 'stabil'},
    {urun: 'Americano', haftalik: 150, trend: 'azaliyor'}
  ];
  
  renderTahminGrid(demoProducts.map(p => ({Urun_Adi: p.urun, haftalik_tahmin: p.haftalik, trend: p.trend})));
  
  const demoMaterials = [
    {hammadde_adi: 'Süt', gereken_stok: 120, mevcut_stok: 45, birim: 'L', eksik: 75},
    {hammadde_adi: 'Espresso Çekirdeği', gereken_stok: 12.5, mevcut_stok: 15, birim: 'kg', eksik: 0},
    {hammadde_adi: 'Şeker', gereken_stok: 5, mevcut_stok: 2, birim: 'kg', eksik: 3}
  ];
  renderMalzemeHafta(demoMaterials);
}

// ── MALZEME TÜKETİMİ ─────────────────────────────
async function loadMalzeme() {
  const select = document.getElementById('malzemeDon');
  const gun = select ? select.value : 30;
  try {
    const r = await fetch(`${API}/ai/malzeme-tuketimi?gunler=${gun}`);
    if(!r.ok) throw new Error();
    const d = await r.json();
    renderMalzemeChartData(d.malzeme_tuketimi);
    renderAylikTedarikFromData(d.malzeme_tuketimi);
  } catch(e) { renderDemoMalzeme(); }
}

function renderDemoMalzeme() {
  const demo = {
    'Espresso Çekirdeği (g)': 125400, 'Süt (ml)': 892000, 'Su (ml)': 445000,
    'Çay Yaprağı (g)': 38400, 'Şeker (g)': 28500, 'Buz (g)': 185000,
    'Bardak (M)': 4200, 'Bardak (L)': 2800, 'Bardak (S)': 1600,
    'Pipet': 3200, 'Fincan': 1800, 'Un (g)': 48000,
    'Yumurta (adet)': 920, 'Tereyağı (g)': 22000, 'Çikolata (g)': 18500,
    'Tatlı Tabağı': 1200
  };
  renderMalzemeChartData(demo);
  renderAylikTedarikFromData(demo);
}

function renderMalzemeChartData(data) {
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k])=>k.length>20?k.slice(0,18)+'..':k);
  const values = sorted.map(([,v])=>Math.round(v));

  const ctx = document.getElementById('malzemeChart');
  if(!ctx || typeof Chart === 'undefined') return;
  if (malzemeChart) malzemeChart.destroy();
  malzemeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tüketim',
        data: values,
        backgroundColor: 'rgba(88,166,255,0.6)',
        borderColor: '#58a6ff',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', font:{size:11} }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#e6edf3', font:{size:11} }, grid: { display: false } }
      }
    }
  });

  const tableEl = document.getElementById('malzemeTable');
  if(!tableEl) return;
  const all = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  tableEl.innerHTML = all.map(([k,v]) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="color:var(--text2)">${k}</span>
      <span style="font-weight:500;color:var(--blue)">${Math.round(v).toLocaleString()}</span>
    </div>`).join('');
}

function renderAylikTedarikFromData(data) {
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  const el = document.getElementById('aylikTedarik');
  if(!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">
      ${sorted.map(([k,v]) => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px 12px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${k}</div>
          <div style="font-size:16px;font-weight:600;color:var(--amber)">${Math.round(v*1.2).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text3)">+%20 güvenlik payı</div>
        </div>`).join('')}
    </div>`;
}

async function loadUretim() {
  const el = document.getElementById('uretimGrid');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--text3)"><span class="pulse"></span> Kapasite hesaplanıyor...</div>';
  
  try {
    const r = await fetch(API + '/urunler/kapasite');
    if(!r.ok) throw new Error();
    const d = await r.json();
    
    el.innerHTML = d.kapasite.map(u => {
      const cap = u.kapasite;
      const col = cap === 0 ? 'var(--red)' : cap < 30 ? 'var(--amber)' : 'var(--blue)';
      const durum = cap === 0 ? 'badge-red' : cap < 30 ? 'badge-amber' : 'badge-green';
      const durumText = cap === 0 ? 'ÜRETİLEMEZ' : cap < 30 ? 'Sınırlı' : 'Yeterli';

      let eksikHtml = '';
      if (cap === 0 && u.eksik_hammaddeler && u.eksik_hammaddeler.length > 0) {
        eksikHtml = `<div style="margin-top:8px; padding:6px 8px; background:rgba(248,81,73,0.08); border-radius:6px; border:1px solid rgba(248,81,73,0.2);">
          <div style="font-size:10px; color:var(--red); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Eksik Hammadde</div>
          ${u.eksik_hammaddeler.map(h => `
            <div style="font-size:11px; color:var(--text2); display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.04)">
              <span>${h.hammadde_adi}</span>
              <span style="color:var(--red)">Eksik: ${h.eksik.toLocaleString()} ${h.birim}</span>
            </div>`).join('')}
        </div>`;
      } else if (cap > 0 && u.kisitlayici_hammadde_adi) {
        eksikHtml = `<div style="margin-top:6px; font-size:11px; color:var(--text3)">
          Kısıt: <span style="color:var(--amber)">${u.kisitlayici_hammadde_adi}</span>
        </div>`;
      }

      return `<div class="forecast-card" style="${cap === 0 ? 'border-color:rgba(248,81,73,0.4); background:rgba(248,81,73,0.04);' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div class="forecast-name">${u.urun_adi}</div>
          <span class="badge ${durum}" style="font-size:10px">${durumText}</span>
        </div>
        <div class="forecast-val" style="color:${col}; font-size:28px">${cap}</div>
        <div class="forecast-row"><span style="font-size:11px; color:var(--text3)">Üretilebilecek adet (mevcut stokla)</span></div>
        ${eksikHtml}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:var(--red)">Kapasite verileri yüklenemedi.</div>';
  }
}

async function loadDashboardAnaliz() {
  const tGrid = document.getElementById('tahminGridDash'); 
  const kList = document.getElementById('kritikHaftalikList'); 
  
  try {
    const r = await fetch(API + '/dashboard/analiz');
    if(!r.ok) throw new Error();
    const d = await r.json();
    
    if(tGrid) {
      tGrid.innerHTML = d.haftalik_tahmin.map(t => `
        <div class="forecast-card" style="padding:10px">
          <div style="font-size:12px;color:var(--text2)">${t.Urun_Adi}</div>
          <div style="font-size:18px;font-weight:700;color:var(--blue)">${Math.round(t.haftalik_tahmin)}</div>
          <div style="font-size:10px;color:var(--text3)">tahmini satış</div>
        </div>
      `).join('');
    }
    
    if(kList) {
      const data = d.tum_ihtiyac || d.kritik_hammaddeler;
      if(!data || data.length === 0) {
        kList.innerHTML = '<div class="alert alert-ok"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-title">Önümüzdeki hafta için tüm stoklar yeterli.</div></div></div>';
      } else {
        kList.innerHTML = `
          <div style="font-size:11px; color:var(--text3); margin-bottom:10px; padding-left:5px;">Haftalık toplam malzeme ve ekipman gereksinimi:</div>
          ` + data.map(h => {
          const isKritik = h.eksik > 0;
          return `
          <div class="alert ${isKritik ? 'alert-critical' : 'alert-ok'}" style="margin-bottom:6px; padding: 8px 12px;">
            <div class="alert-icon">${isKritik ? '⚠️' : '📦'}</div>
            <div class="alert-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="alert-title" style="color:${isKritik ? 'var(--red)' : 'var(--text)'}; margin-bottom:0;">${h.hammadde_adi}</div>
                <div style="font-size:13px; font-weight:600; color:${isKritik ? 'var(--red)' : 'var(--blue)'}">${h.gereken_stok} ${h.birim || ''}</div>
              </div>
              <div class="alert-desc" style="font-size:10px;">
                ${isKritik ? `Eksik: <strong style="color:var(--red)">${h.eksik}</strong> | ` : ''}Stok: ${h.mevcut_stok}
              </div>
            </div>
          </div>
        `}).join('');
      }
    }
  } catch(e) {
    console.error('Dashboard analiz hatası:', e);
    if(kList) kList.innerHTML = '<div style="color:var(--text3); font-size:12px; padding:10px;">Veriler yüklenemedi. API bağlantısını kontrol edin.</div>';
  }
}

// ── TARİFLER ─────────────────────────────────────
async function loadTarifler() {
  const RECIPE_BOOK = {
    "Çay": {"Çay Yaprağı (g)": "3 g", "Su (ml)": "200 ml", "Bardak (S)": "1 adet"},
    "Türk Kahvesi": {"Türk Kahvesi Tozu (g)": "7 g", "Su (ml)": "80 ml", "Fincan": "1 adet"},
    "Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "200 ml", "Bardak (M)": "1 adet"},
    "Ice Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Buz (g)": "80 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Americano": {"Espresso Çekirdeği (g)": "18 g", "Su (ml)": "180 ml", "Bardak (M)": "1 adet"},
    "Ice Americano": {"Espresso Çekirdeği (g)": "18 g", "Su (ml)": "150 ml", "Buz (g)": "100 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Cappuccino": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "120 ml", "Bardak (M)": "1 adet"},
    "Limonata": {"Limon (adet)": "1.5 adet", "Şeker (g)": "20 g", "Su (ml)": "250 ml", "Buz (g)": "60 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Espresso": {"Espresso Çekirdeği (g)": "18 g", "Fincan": "1 adet"},
    "Filtre Kahve": {"Filtre Kahve Tozu (g)": "15 g", "Su (ml)": "250 ml", "Bardak (M)": "1 adet"},
    "Mocha": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Çikolata Sosu (ml)": "20 ml", "Bardak (M)": "1 adet"},
    "Menengiç Kahvesi": {"Menengiç (g)": "10 g", "Süt (ml)": "80 ml", "Fincan": "1 adet"},
    "Sıcak Çikolata": {"Kakao Tozu (g)": "20 g", "Süt (ml)": "200 ml", "Şeker (g)": "10 g", "Bardak (M)": "1 adet"},
    "Salep": {"Salep Tozu (g)": "8 g", "Süt (ml)": "200 ml", "Tarçın (g)": "1 g", "Bardak (M)": "1 adet"},
    "Flat White": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "130 ml", "Bardak (M)": "1 adet"},
    "Cortado": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "30 ml", "Fincan": "1 adet"},
    "Chai Tea Latte": {"Chai Mix (g)": "15 g", "Süt (ml)": "200 ml", "Tarçın (g)": "0.5 g", "Bardak (M)": "1 adet"},
    "Kış Çayı": {"Bitki Mix (g)": "5 g", "Bal (ml)": "10 ml", "Su (ml)": "250 ml", "Limon (dilim)": "1 adet", "Bardak (M)": "1 adet"},
    "Soğuk Çay": {"Çay Özü (ml)": "30 ml", "Su (ml)": "200 ml", "Buz (g)": "100 g", "Şurup (ml)": "10 ml", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Frappe": {"Filtre Kahve Tozu (g)": "10 g", "Süt (ml)": "100 ml", "Buz (g)": "150 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Milkshake": {"Süt (ml)": "200 ml", "Dondurma (g)": "100 g", "Şeker (g)": "10 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Iced Mocha": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "150 ml", "Çikolata Sosu (ml)": "20 ml", "Buz (g)": "100 g", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "Portakal Suyu": {"Portakal (adet)": "3 adet", "Bardak (M)": "1 adet"},
    "Churchill": {"Soda (ml)": "200 ml", "Limon (adet)": "0.5 adet", "Tuz (g)": "1 g", "Bardak (M)": "1 adet"},
    "Frozen": {"Meyve Özü (ml)": "50 ml", "Buz (g)": "200 g", "Şurup (ml)": "20 ml", "Bardak (L)": "1 adet", "Pipet": "1 adet"},
    "San Sebastian": {"Krem Peynir (g)": "60 g", "Yumurta (adet)": "0.5 adet", "Krema (ml)": "40 ml", "Tatlı Tabağı": "1 adet"},
    "Tiramisu": {"Maskarpone (g)": "50 g", "Bisküvi (g)": "30 g", "Espresso Çekirdeği (g)": "5 g", "Tatlı Tabağı": "1 adet"},
    "Brownie": {"Çikolata (g)": "40 g", "Tereyağı (g)": "30 g", "Un (g)": "20 g", "Yumurta (adet)": "0.5 adet", "Tatlı Tabağı": "1 adet"},
    "Havuçlu Tarçınlı Kek": {"Havuç (g)": "30 g", "Un (g)": "40 g", "Tarçın (g)": "2 g", "Ceviz (g)": "5 g", "Tatlı Tabağı": "1 adet"},
    "Sufle": {"Çikolata (g)": "50 g", "Un (g)": "15 g", "Yumurta (adet)": "1 adet", "Tatlı Tabağı": "1 adet"},
    "Çikolatalı Cookie": {"Hamur (g)": "60 g", "Çikolata Parçacığı (g)": "15 g", "Peçete": "1 adet"},
    "Kruvasan": {"Kruvasan Hamuru (g)": "80 g", "Tereyağı (g)": "20 g", "Peçete": "1 adet"},
    "Profiterol": {"Hamur (g)": "30 g", "Krema (g)": "40 g", "Çikolata Sosu (g)": "30 g", "Tatlı Tabağı": "1 adet"},
  };
  tariflerData = RECIPE_BOOK;
  renderTarifler(RECIPE_BOOK);
}

function renderTarifler(data) {
  const el = document.getElementById('tarifGrid');
  if(!el) return;
  el.innerHTML = Object.entries(data).map(([name, ings]) => `
    <div class="recipe-card">
      <div class="recipe-name">☕ ${name}</div>
      ${Object.entries(ings).map(([k,v]) => `<div class="recipe-ing"><span>${k}</span><span style="color:var(--blue)">${v}</span></div>`).join('')}
    </div>`).join('');
}

function filterTarifler(q) {
  const filtered = {};
  Object.entries(tariflerData).forEach(([k,v]) => {
    if (k.toLowerCase().includes(q.toLowerCase())) filtered[k] = v;
  });
  renderTarifler(filtered);
}

// ── SELECTS ──────────────────────────────────────
async function loadUrunSelect() {
  try {
    // Satış ekranı için ürünleri getir
    const rUrunler = await fetch(API + '/urunler');
    const dUrunler = await rUrunler.json();
    urunler = dUrunler.urunler;
    
    // Stok girişi ekranı için hammaddeleri getir
    const rHammaddeler = await fetch(API + '/stok/hammaddeler');
    const dHammaddeler = await rHammaddeler.json();
    const hammaddeler = dHammaddeler.hammaddeler;

    populateSelects(urunler, hammaddeler);
  } catch(e) { 
    populateSelects(stokData, stokData); 
  }
}

function populateSelects(urunData, hammaddeData) {
  const sUrun = document.getElementById('satisUrun');
  const sGiris = document.getElementById('stokGirisUrun');
  if(sUrun) {
    sUrun.innerHTML = urunData.map(u => `<option value="${u.urun_id||u.Urun_ID}">${u.urun_adi||u.Urun_Adi}</option>`).join('');
  }
  if(sGiris) {
    sGiris.innerHTML = hammaddeData.map(h => `<option value="${h.Hammadde_ID}">${h.Hammadde_Adi} (${h.Birim})</option>`).join('');
  }
}

// ── KAYIT ────────────────────────────────────────
async function kaydetSatis() {
  const urunId = document.getElementById('satisUrun').value;
  const adet = parseInt(document.getElementById('satisAdet').value);
  const fiyat = parseFloat(document.getElementById('satisFiyat').value);
  const tarih = document.getElementById('satisTarih').value;

  const body = { tarih, urun_id: urunId, adet, birim_fiyat: fiyat };
  const el = document.getElementById('satisResult');
  
  try {
    const r = await fetch(API+'/satislar/kaydet',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error();
    const d = await r.json();
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--green)'; 
        el.textContent='✅ Satış kaydedildi! Toplam: '+(d.toplam_tutar_tl||0)+' TL';
    }
    // GÜNCELLEME: Refresh after sale
    await loadStok();
    await loadFinans();
    renderStokChart();
  } catch(e) {
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--amber)'; 
        el.textContent='⚠️ API bağlantısı yok — demo modunda kayıt simüle edildi.';
    }
  }
  setTimeout(()=>{ if(el) el.style.display='none' },3000);
}

async function kaydetStok() {
  const urunId = document.getElementById('stokGirisUrun').value;
  const miktarInput = document.getElementById('stokMiktar').value;
  const miktar = parseFloat(miktarInput);
  const tip = document.getElementById('stokTip').value;
  const tarih = document.getElementById('stokTarih').value;

  if(isNaN(miktar)) { alert('Lütfen geçerli bir miktar giriniz!'); return; }

  // Birim tespiti (basit yaklaşım: eğer miktar < 10 ve hammadde sıvıysa L olabilir, 
  // ama en iyisi server.py'nin g/ml beklemesi veya frontend'in kg seçeneği sunması)
  // Şimdilik kg/L desteğini opsiyonel bırakalım, server.py birim='g' varsayıyor.
  
  const body = { tarih, urun_id: urunId, miktar, islem_tipi: tip, birim: 'g' };
  const el = document.getElementById('stokResult');
  
  try {
    const r = await fetch(API+'/stok/giris',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
    });
    if(!r.ok) {
        const errorData = await r.json();
        throw new Error(errorData.message || 'Sunucu hatası');
    }
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--green)'; 
        el.textContent='✅ Stok hareketi başarıyla kaydedildi!';
    }
    await loadStok();
    await loadFinans();
    renderStokChart();
  } catch(e) {
    console.error('Stok Kayıt Hatası:', e);
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--red)'; 
        el.textContent='❌ Hata: ' + e.message;
    }
  }
  setTimeout(()=>{ if(el) el.style.display='none' },3000);
}

function renderSiparisCards(d) {
  const sList = document.getElementById('sipListesi');
  const uDetay = document.getElementById('uyariDetay');
  if(!sList && !uDetay) return;

  const acil = d.acil_siparisler || [];
  const uyari = d.uyarilar || [];
  const uretilemez = d.uretilemeyenler || [];

  if(sList) {
    let html = '';
    if(acil.length === 0) {
      html = '<div style="color:var(--green); padding:8px;">✅ Haftalık tahmine göre acil sipariş gerekmez.</div>';
    } else {
      html = acil.map(s => {
        const isKritik = s.aciliyet === 'kritik';
        const icon = isKritik ? '🚨' : '⚡';
        return `<div class="alert ${isKritik ? 'alert-critical' : 'alert-warn'}" style="margin-bottom:6px;">
          <div class="alert-icon">${icon}</div>
          <div class="alert-body">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="alert-title">${s.urun_adi}</div>
              <span class="badge ${isKritik ? 'badge-red' : 'badge-amber'}" style="font-size:10px">${isKritik ? 'Kritik' : 'Yüksek'}</span>
            </div>
            <div class="alert-desc" style="margin-top:3px">${s.neden}</div>
            <div style="font-size:11px; color:var(--blue); margin-top:3px;">
              Önerilen sipariş: <strong>${s.onerilen_siparis_miktari.toLocaleString()} ${s.birim}</strong>
              ${s.tedarik_suresi_gun ? ` · Tedarik: ${s.tedarik_suresi_gun} gün` : ''}
            </div>
          </div>
        </div>`;
      }).join('');
    }
    
    // Üretilemeyen ürünler
    if(uretilemez.length > 0) {
      html += `<div style="margin-top:12px; padding:8px 10px; background:rgba(248,81,73,0.07); border:1px solid rgba(248,81,73,0.3); border-radius:8px;">
        <div style="font-size:11px; font-weight:700; color:var(--red); text-transform:uppercase; margin-bottom:8px;">❌ Şu An Üretilemeyen Ürünler</div>
        ${uretilemez.map(u => `
          <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:13px; font-weight:600; color:var(--text);">${u.urun_adi} <span style="font-size:10px; color:var(--text3)">(${u.kategori})</span></div>
            ${u.eksik_hammaddeler.map(h => `
              <div style="font-size:11px; color:var(--text2); padding:1px 8px; display:flex; justify-content:space-between;">
                <span>${h.hammadde_adi}</span>
                <span style="color:var(--red)">Eksik: ${h.eksik || (h.gereken - h.mevcut).toFixed(1)} ${h.birim}</span>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;
    }
    
    sList.innerHTML = html;
  }

  if(uDetay) {
    uDetay.innerHTML = uyari.map(u => `
      <div class="alert alert-warn" style="margin-bottom:6px;">
        <div class="alert-icon">⚠️</div>
        <div class="alert-body">
          <div class="alert-title">${u.urun_adi}</div>
          <div class="alert-desc">${u.mesaj} · Tahmini ${u.tahmini_gun_kaldi} gün kaldı</div>
        </div>
      </div>`).join('') || '<div style="color:var(--green); padding:8px;">✅ Kritik uyarı yok.</div>';
  }
}

function handleCSV(input, type) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.trim().split('\n');
    const headers = lines[0].split(',').map(h=>h.trim());
    const rows = lines.slice(1).map(l => {
      const vals = l.split(',').map(v=>v.trim());
      const obj = {};
      headers.forEach((h,i) => obj[h] = vals[i]);
      return obj;
    });
    const elId = type==='satis'?'csvSatisResult':'csvStokResult';
    const el = document.getElementById(elId);
    if(!el) return;
    el.style.display = 'block';
    el.style.color = 'var(--blue)';
    el.innerHTML = `📊 <strong>${rows.length} satır</strong> okundu.<br><small style="color:var(--text3)">${headers.join(', ')}</small>`;
    
    if (type==='satis') {
      rows.forEach(async row => {
        try {
          await fetch(API+'/satislar/kaydet',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({tarih:row.tarih, urun_id:row.urun_id, adet:parseInt(row.adet), birim_fiyat:parseFloat(row.birim_fiyat||row.fiyat||75)})
          });
        } catch(err){}
      });
      setTimeout(()=>{ el.style.color='var(--green)'; el.textContent='✅ '+rows.length+' satış başarıyla yüklendi!'; loadStok(); loadFinans(); }, 500);
    }
  };
  reader.readAsText(file);
}