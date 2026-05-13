from flask import Flask, jsonify, request, send_from_directory
import sqlite3
import os

app = Flask(__name__)
DB_PATH = 'stokzeka_guncel.db'

# ===========================================================
# TARİF KİTABI (uygulama kodundaki canonical tarif)
# Miktar birimleri: g, ml veya adet
# ===========================================================
TARIFLER_SABIT = {
    "P001": {"H001": 3,   "H002": 200,  "H003": 1},
    "P002": {"H004": 7,   "H002": 80,   "H005": 1},
    "P003": {"H006": 18,  "H007": 200,  "H008": 1},
    "P004": {"H006": 18,  "H007": 180,  "H009": 80,  "H010": 1, "H011": 1},
    "P005": {"H006": 18,  "H002": 180,  "H008": 1},
    "P006": {"H006": 18,  "H002": 150,  "H009": 100, "H010": 1, "H011": 1},
    "P007": {"H006": 18,  "H007": 120,  "H008": 1},
    "P008": {"H012": 1.5, "H013": 20,   "H002": 250, "H009": 60, "H008": 1, "H011": 1},
    "P009": {"H006": 18,  "H005": 1},
    "P010": {"H014": 15,  "H002": 250,  "H008": 1},
    "P011": {"H006": 18,  "H007": 180,  "H015": 20,  "H008": 1},
    "P012": {"H016": 10,  "H007": 80,   "H005": 1},
    "P013": {"H017": 20,  "H007": 200,  "H013": 10,  "H008": 1},
    "P014": {"H018": 8,   "H007": 200,  "H019": 1,   "H008": 1},
    "P015": {"H006": 18,  "H007": 130,  "H008": 1},
    "P016": {"H006": 18,  "H007": 30,   "H005": 1},
    "P017": {"H020": 15,  "H007": 200,  "H019": 0.5, "H008": 1},
    "P018": {"H021": 5,   "H022": 10,   "H002": 250, "H012": 0.5, "H008": 1},
    "P019": {"H023": 30,  "H002": 200,  "H009": 100, "H024": 10,  "H010": 1, "H011": 1},
    "P020": {"H014": 10,  "H007": 100,  "H009": 150, "H010": 1,  "H011": 1},
    "P021": {"H007": 200, "H025": 100,  "H013": 10,  "H010": 1,  "H011": 1},
    "P022": {"H006": 18,  "H007": 150,  "H015": 20,  "H009": 100,"H010": 1, "H011": 1},
    "P023": {"H026": 3,   "H008": 1,    "H011": 1},
    "P024": {"H027": 200, "H012": 0.5,  "H028": 1,   "H010": 1,  "H011": 1},
    "P025": {"H029": 50,  "H009": 200,  "H024": 20,  "H010": 1,  "H011": 1},
    "P026": {"H030": 60,  "H031": 0.5,  "H032": 40,  "H033": 1},
    "P027": {"H034": 50,  "H035": 30,   "H006": 5,   "H033": 1},
    "P028": {"H036": 40,  "H037": 30,   "H038": 20,  "H031": 0.5,"H033": 1},
    "P029": {"H039": 30,  "H038": 40,   "H019": 2,   "H040": 5,  "H033": 1},
    "P030": {"H036": 50,  "H037": 15,   "H031": 1,   "H033": 1},
    "P031": {"H041": 60,  "H042": 15,   "H033": 1},
    "P032": {"H043": 80,  "H037": 20,   "H033": 1},
    "P033": {"H041": 30,  "H032": 40,   "H015": 30,  "H033": 1},
}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def hesapla_birim_maliyet(h_id, miktar, birim, birim_maliyet_tl):
    if birim == 'adet':
        return miktar * birim_maliyet_tl
    else:
        return (miktar / 1000.0) * birim_maliyet_tl

def convert_unit(val, unit):
    if unit == 'g':
        return val / 1000.0, 'kg'
    elif unit == 'ml':
        return val / 1000.0, 'L'
    return val, unit

def get_stoklar():
    conn = get_db_connection()
    try:
        rows = conn.execute("""
            SELECT h.Hammadde_ID, h.Hammadde_Adi, h.Birim, h.Kritik_Stok,
                IFNULL(SUM(sh.Miktar), 0) as mevcut_stok
            FROM Hammaddeler h
            LEFT JOIN Stok_Hareketleri sh ON h.Hammadde_ID = sh.Hammadde_ID
            GROUP BY h.Hammadde_ID
        """).fetchall()
        return {r['Hammadde_ID']: dict(r) for r in rows}
    finally:
        conn.close()

def get_hammadde_info():
    conn = get_db_connection()
    try:
        rows = conn.execute("""
            SELECT h.Hammadde_ID, h.Hammadde_Adi, h.Birim, h.Kritik_Stok,
                   ht.Birim_Maliyet_TL, ht.Tedarik_Suresi_Gun, ht.Min_Siparis_Miktari
            FROM Hammaddeler h
            LEFT JOIN Hammadde_Tedarik ht ON h.Hammadde_ID = ht.Hammadde_ID
        """).fetchall()
        return {r['Hammadde_ID']: dict(r) for r in rows}
    finally:
        conn.close()

def get_urunler():
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT Urun_ID, Urun_Adi, Kategori FROM Urunler").fetchall()
        return {r['Urun_ID']: dict(r) for r in rows}
    finally:
        conn.close()

def get_son_tarih():
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT MAX(Tarih) as son FROM Satislar").fetchone()
        return row['son'] if row and row['son'] else 'now'
    finally:
        conn.close()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('.', path)

@app.route('/stok/mevcut')
def get_stok_mevcut():
    conn = get_db_connection()
    try:
        rows = conn.execute("""
            SELECT 
                h.Hammadde_ID as urun_id,
                h.Hammadde_Adi as urun_adi,
                h.Birim,
                h.Kritik_Stok as kritik_esik,
                IFNULL(SUM(sh.Miktar), 0) as mevcut_stok,
                t.Tedarikci_Adi,
                ht.Tedarik_Suresi_Gun
            FROM Hammaddeler h
            LEFT JOIN Stok_Hareketleri sh ON h.Hammadde_ID = sh.Hammadde_ID
            LEFT JOIN Hammadde_Tedarik ht ON h.Hammadde_ID = ht.Hammadde_ID
            LEFT JOIN Tedarikciler t ON ht.Tedarikci_ID = t.Tedarikci_ID
            GROUP BY h.Hammadde_ID
        """).fetchall()

        urunler = []
        kritik = dusuk = yeterli = 0
        for row in rows:
            d = dict(row)
            val, unit = convert_unit(d['mevcut_stok'], d['Birim'])
            esik, _ = convert_unit(d['kritik_esik'], d['Birim'])
            d['mevcut_stok'] = round(val, 3)
            d['kritik_esik'] = round(esik, 3)
            d['Birim'] = unit

            if d['mevcut_stok'] <= d['kritik_esik']:
                d['durum'] = 'Kritik'; kritik += 1
            elif d['mevcut_stok'] <= d['kritik_esik'] * 1.5:
                d['durum'] = 'Düşük'; dusuk += 1
            else:
                d['durum'] = 'Yeterli'; yeterli += 1
            urunler.append(d)

        return jsonify({
            "urunler": urunler,
            "ozet": {"toplam": len(urunler), "kritik": kritik, "dusuk": dusuk, "yeterli": yeterli}
        })
    finally:
        conn.close()

@app.route('/urunler')
def get_urunler_list():
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT Urun_ID, Urun_Adi FROM Urunler").fetchall()
        return jsonify({"urunler": [dict(r) for r in rows]})
    finally:
        conn.close()

@app.route('/finans/analiz')
def get_finans_analiz():
    hammadde_info = get_hammadde_info()
    conn = get_db_connection()
    try:
        urunler_rows = conn.execute("SELECT Urun_ID, Urun_Adi FROM Urunler").fetchall()
        satis_rows = conn.execute(
            "SELECT Urun_ID, AVG(Birim_Fiyat_TL) as ort, SUM(Adet) as toplam_adet, SUM(Toplam_Satis_TL) as ciro FROM Satislar GROUP BY Urun_ID"
        ).fetchall()
        satis_stats = {r['Urun_ID']: dict(r) for r in satis_rows}
        toplam_ciro_row = conn.execute("SELECT SUM(Toplam_Satis_TL) as c FROM Satislar").fetchone()
        toplam_ciro = toplam_ciro_row['c'] or 0
        toplam_maliyet = 0
        analiz = []
        LOJISTIK_EK_ORAN = 0.20
        PERSONEL_BIRIM_MALIYET = 15.0

        for urun in urunler_rows:
            urun_id = urun['Urun_ID']
            tarif_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (urun_id,)).fetchall()
            hammadde_maliyeti = 0
            for t in tarif_rows:
                h_id = t['Hammadde_ID']
                h = hammadde_info.get(h_id, {})
                if h.get('Birim_Maliyet_TL'):
                    hammadde_maliyeti += hesapla_birim_maliyet(h_id, t['Miktar'], h['Birim'], h['Birim_Maliyet_TL'])
            lojistik_maliyeti = hammadde_maliyeti * LOJISTIK_EK_ORAN
            toplam_birim_maliyet = hammadde_maliyeti + lojistik_maliyeti + PERSONEL_BIRIM_MALIYET
            st = satis_stats.get(urun_id, {})
            ort_fiyat = st.get('ort', 0) or 0
            toplam_adet = st.get('toplam_adet', 0) or 0
            toplam_maliyet += toplam_birim_maliyet * toplam_adet
            analiz.append({
                "urun_id": urun_id,
                "urun_adi": urun['Urun_Adi'],
                "birim_maliyet": round(toplam_birim_maliyet, 2),
                "hammadde_maliyeti": round(hammadde_maliyeti, 2),
                "ortalama_satis_fiyat": round(ort_fiyat, 2)
            })
        return jsonify({
            "analiz": analiz,
            "toplam_ciro": round(toplam_ciro, 2),
            "toplam_maliyet": round(toplam_maliyet, 2),
            "net_kar": round(toplam_ciro - toplam_maliyet, 2)
        })
    finally:
        conn.close()

@app.route('/urunler/kapasite')
def get_uretim_kapasite():
    stoklar = get_stoklar()
    conn = get_db_connection()
    try:
        urunler_rows = conn.execute("SELECT Urun_ID, Urun_Adi, Kategori FROM Urunler").fetchall()
        kapasite_list = []
        for urun in urunler_rows:
            u_id = urun['Urun_ID']
            tarif_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (u_id,)).fetchall()
            if not tarif_rows: continue
            max_uretilebilir = float('inf')
            kisitlayici = None
            for t in tarif_rows:
                si = stoklar.get(t['Hammadde_ID'])
                if not si or t['Miktar'] <= 0: continue
                uretilebilir = si['mevcut_stok'] / t['Miktar']
                if uretilebilir < max_uretilebilir:
                    max_uretilebilir = uretilebilir
                    kisitlayici = si['Hammadde_Adi']
            kapasite = int(max_uretilebilir) if max_uretilebilir != float('inf') else 0
            eksik_h = []
            for t in tarif_rows:
                si = stoklar.get(t['Hammadde_ID'])
                if si and si['mevcut_stok'] < t['Miktar']:
                    val, unit = convert_unit(t['Miktar'], si['Birim'])
                    s_val, _ = convert_unit(si['mevcut_stok'], si['Birim'])
                    eksik_h.append({
                        "hammadde_adi": si['Hammadde_Adi'],
                        "birim": unit,
                        "gereken": round(val, 3),
                        "mevcut": round(s_val, 3),
                        "eksik": round(val - s_val, 3)
                    })
            kapasite_list.append({
                "urun_id": u_id,
                "urun_adi": urun['Urun_Adi'],
                "kategori": urun['Kategori'],
                "kapasite": kapasite,
                "kisitlayici_hammadde_adi": kisitlayici,
                "eksik_hammaddeler": eksik_h
            })
        return jsonify({"kapasite": kapasite_list})
    finally:
        conn.close()

def get_adjustment_multiplier(urun_adi, kategori, factors):
    if not factors:
        return 1.0
        
    total_multiplier = 0
    
    # Sıcak/Soğuk kategorizasyonu
    sicak_icecekler = ['Çay', 'Kahve', 'Latte', 'Americano', 'Cappuccino', 'Mocha', 'Salep', 'Çikolata', 'Bitki', 'Filtre', 'Sıcak']
    soguk_icecekler = ['Ice', 'Limonata', 'Soğuk', 'Frappe', 'Milkshake', 'Iced', 'Suyu', 'Churchill', 'Frozen']
    
    is_sicak = any(x.lower() in urun_adi.lower() for x in sicak_icecekler)
    is_soguk = any(x.lower() in urun_adi.lower() for x in soguk_icecekler)

    for f in factors:
        day_m = 1.0
        
        # Hava Durumu Etkisi
        if f['Hava_Durumu'] == 'Güneşli':
            day_m *= 1.1
        elif f['Hava_Durumu'] == 'Yağmurlu':
            day_m *= 0.85
        elif f['Hava_Durumu'] == 'Karlı':
            day_m *= 0.7

        # Sıcaklık Etkisi
        temp = f['Sicaklik']
        if temp > 25:
            if is_soguk: day_m *= 1.3
            if is_sicak: day_m *= 0.7
        elif temp < 12:
            if is_sicak: day_m *= 1.25
            if is_soguk: day_m *= 0.7

        # Hafta Sonu Etkisi
        if f['Hafta_Sonu_Mu']:
            day_m *= 1.25

        # Kampanya Etkisi
        if f['Kampanya_Var_Mi']:
            day_m *= 1.2
            
        total_multiplier += day_m
            
    # Günlük çarpanların ortalamasını al
    return total_multiplier / len(factors)

@app.route('/dashboard/analiz')
def get_dashboard_analiz():
    son_tarih = get_son_tarih()
    conn = get_db_connection()
    try:
        # Dış Faktörleri Al (Önümüzdeki 7 gün için)
        factors = conn.execute(f"SELECT * FROM DisFaktorler WHERE Tarih > date('{son_tarih}') ORDER BY Tarih LIMIT 7").fetchall()
        factors_list = [dict(f) for f in factors]

        tahminler_raw = conn.execute(f"SELECT u.Urun_ID, u.Urun_Adi, u.Kategori, IFNULL(SUM(s.Adet)/4.0, 0) as base_tahmin FROM Urunler u LEFT JOIN Satislar s ON u.Urun_ID = s.Urun_ID AND s.Tarih >= date('{son_tarih}', '-28 days') GROUP BY u.Urun_ID ORDER BY base_tahmin DESC").fetchall()
        
        tahminler = []
        for t in tahminler_raw:
            d = dict(t)
            mult = get_adjustment_multiplier(d['Urun_Adi'], d['Kategori'], factors_list)
            d['haftalik_tahmin'] = d['base_tahmin'] * mult
            tahminler.append(d)

        stoklar = get_stoklar()
        hammadde_ihtiyac = {}
        for t in tahminler:
            tarif_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (t['Urun_ID'],)).fetchall()
            for tr in tarif_rows:
                hammadde_ihtiyac[tr['Hammadde_ID']] = hammadde_ihtiyac.get(tr['Hammadde_ID'], 0) + tr['Miktar'] * t['haftalik_tahmin']
        
        tum_ihtiyac = []
        for h_id, gereken in hammadde_ihtiyac.items():
            si = stoklar.get(h_id)
            if not si: continue
            m_val, m_unit = convert_unit(si['mevcut_stok'], si['Birim'])
            g_val, _ = convert_unit(gereken, si['Birim'])
            tum_ihtiyac.append({
                "hammadde_id": h_id,
                "hammadde_adi": si['Hammadde_Adi'],
                "birim": m_unit,
                "mevcut_stok": round(m_val, 3),
                "gereken_stok": round(g_val, 3),
                "eksik": round(max(0, g_val - m_val), 3)
            })
        return jsonify({"haftalik_tahmin": tahminler, "tum_ihtiyac": sorted(tum_ihtiyac, key=lambda x: x['gereken_stok'], reverse=True)})
    finally:
        conn.close()

@app.route('/ai/analiz')
def get_ai_analiz():
    stoklar = get_stoklar()
    hammadde_info = get_hammadde_info()
    son_tarih = get_son_tarih()
    conn = get_db_connection()
    try:
        # Dış Faktörleri Al
        factors = conn.execute(f"SELECT * FROM DisFaktorler WHERE Tarih > date('{son_tarih}') ORDER BY Tarih LIMIT 7").fetchall()
        factors_list = [dict(f) for f in factors]

        tahminler_raw = conn.execute(f"SELECT u.Urun_ID, u.Urun_Adi, u.Kategori, IFNULL(SUM(s.Adet)/4.0, 0) as base_tahmin, IFNULL(SUM(s.Adet)/28.0, 0) as gunluk_base FROM Urunler u LEFT JOIN Satislar s ON u.Urun_ID = s.Urun_ID AND s.Tarih >= date('{son_tarih}', '-28 days') GROUP BY u.Urun_ID").fetchall()
        
        tahminler = []
        hammadde_ihtiyac = {}
        for t in tahminler_raw:
            d = dict(t)
            mult = get_adjustment_multiplier(d['Urun_Adi'], d['Kategori'], factors_list)
            d['haftalik_tahmin'] = d['base_tahmin'] * mult
            d['gunluk_tahmin'] = d['gunluk_base'] * mult
            tahminler.append(d)
            
            tr_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (d['Urun_ID'],)).fetchall()
            for tr in tr_rows:
                hammadde_ihtiyac[tr['Hammadde_ID']] = hammadde_ihtiyac.get(tr['Hammadde_ID'], 0) + tr['Miktar'] * d['haftalik_tahmin']
        
        acil_siparisler = []
        uyarilar = []
        for h_id, gereken in hammadde_ihtiyac.items():
            si = stoklar.get(h_id)
            if not si: continue
            hi = hammadde_info.get(h_id, {})
            m_val, m_unit = convert_unit(si['mevcut_stok'], si['Birim'])
            g_val, _ = convert_unit(gereken, si['Birim'])
            k_val, _ = convert_unit(si['Kritik_Stok'], si['Birim'])
            eksik = g_val - m_val
            if eksik > 0:
                min_sip, _ = convert_unit(hi.get('Min_Siparis_Miktari', 0), si['Birim'])
                acil_siparisler.append({
                    "urun_adi": si['Hammadde_Adi'],
                    "birim": m_unit,
                    "mevcut_stok": round(m_val, 3),
                    "onerilen_siparis_miktari": round(max(eksik * 1.2, min_sip), 3),
                    "aciliyet": "kritik" if m_val <= k_val else "yuksek",
                    "neden": f"Haftalık ihtiyaç {round(g_val, 2)} {m_unit} (Dış faktörler dahil)"
                })
            elif m_val <= k_val * 1.5:
                uyarilar.append({"urun_adi": si['Hammadde_Adi'], "mesaj": f"Stok azalıyor: {round(m_val, 2)} {m_unit} kaldı"})
        
        # Özet metni dış faktörlere göre güncelle
        hava = factors_list[0]['Hava_Durumu'] if factors_list else "Bilinmiyor"
        temp = factors_list[0]['Sicaklik'] if factors_list else 0
        ozet = f"Önümüzdeki hafta hava {hava} ({temp}°C) olması bekleniyor. "
        if any(f['Kampanya_Var_Mi'] for f in factors_list):
            ozet += "Aktif kampanyalar nedeniyle talep artışı öngörülüyor. "
        ozet += f"{len(acil_siparisler)} hammadde için tedarik gerekiyor."

        return jsonify({
            "ozet": ozet, 
            "acil_siparisler": acil_siparisler, 
            "uyarilar": uyarilar,
            "haftalik_tahmin": tahminler
        })
    finally:
        conn.close()

@app.route('/ai/malzeme-tuketimi')
def get_malzeme_tuketimi():
    gunler = request.args.get('gunler', 30)
    son_tarih = get_son_tarih()
    conn = get_db_connection()
    try:
        rows = conn.execute(f"SELECT Urun_ID, SUM(Adet) as toplam_satis FROM Satislar WHERE Tarih >= date('{son_tarih}', '-{gunler} days') GROUP BY Urun_ID").fetchall()
        stoklar = get_stoklar()
        tuketim = {}
        for row in rows:
            tr_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (row['Urun_ID'],)).fetchall()
            for tr in tr_rows:
                si = stoklar.get(tr['Hammadde_ID'])
                if si:
                    val, unit = convert_unit(tr['Miktar'] * row['toplam_satis'], si['Birim'])
                    key = f"{si['Hammadde_Adi']} ({unit})"
                    tuketim[key] = tuketim.get(key, 0) + val
        return jsonify({"malzeme_tuketimi": tuketim})
    finally:
        conn.close()

@app.route('/satislar/kaydet', methods=['POST'])
def save_satis():
    data = request.json
    conn = get_db_connection()
    try:
        toplam = data['adet'] * data['birim_fiyat']
        conn.execute("INSERT INTO Satislar (Tarih, Urun_ID, Adet, Birim_Fiyat_TL, Toplam_Satis_TL) VALUES (?,?,?,?,?)", (data['tarih'], data['urun_id'], data['adet'], data['birim_fiyat'], toplam))
        tr_rows = conn.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (data['urun_id'],)).fetchall()
        for tr in tr_rows:
            conn.execute("INSERT INTO Stok_Hareketleri (Tarih, Hammadde_ID, Miktar, Islem_Tipi) VALUES (?,?,?,?)", (data['tarih'], tr['Hammadde_ID'], -tr['Miktar'] * data['adet'], 'Cikis'))
        conn.commit()
        return jsonify({"status": "success", "toplam_tutar_tl": toplam})
    finally:
        conn.close()

@app.route('/stok/hammaddeler')
def get_hammadde_list():
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT Hammadde_ID, Hammadde_Adi, Birim FROM Hammaddeler").fetchall()
        return jsonify({"hammaddeler": [dict(r) for r in rows]})
    finally:
        conn.close()

@app.route('/stok/giris', methods=['POST'])
def stok_giris():
    conn = get_db_connection()
    try:
        data = request.json
        print(f"Stok Girişi Verisi: {data}")
        
        miktar = float(data['miktar'])
        unit = data.get('birim', 'g')
        tip = data.get('islem_tipi', 'Giris')
        
        if unit == 'kg' or unit == 'L':
            miktar = miktar * 1000.0
            
        if tip in ['Cikis', 'Fire', 'Kullanilmis', 'Iade']:
            miktar = -abs(miktar)
        else:
            miktar = abs(miktar)
            
        conn.execute("""
            INSERT INTO Stok_Hareketleri (Tarih, Hammadde_ID, Miktar, Islem_Tipi) 
            VALUES (?, ?, ?, ?)
        """, (data['tarih'], data['urun_id'], miktar, tip))
        
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Stok Giriş Hatası: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
