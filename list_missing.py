import sqlite3

def list_missing_stock():
    conn = sqlite3.connect('stokzeka_guncel.db')
    conn.row_factory = sqlite3.Row
    
    query = """
    SELECT 
        h.Hammadde_Adi, 
        h.Birim,
        IFNULL(SUM(sh.Miktar), 0) as mevcut
    FROM Hammaddeler h
    LEFT JOIN Stok_Hareketleri sh ON h.Hammadde_ID = sh.Hammadde_ID
    GROUP BY h.Hammadde_ID
    HAVING mevcut < 0
    """
    
    rows = conn.execute(query).fetchall()
    print("--- SIFIRLAMAK İÇİN GEREKEN MİKTARLAR ---")
    for row in rows:
        missing = abs(row['mevcut'])
        if row['Birim'] == 'g' or row['Birim'] == 'ml':
            print(f"{row['Hammadde_Adi']}: {missing/1000.0:.3f} {row['Birim'].replace('g','kg').replace('ml','L')} eklenmeli.")
        else:
            print(f"{row['Hammadde_Adi']}: {int(missing)} {row['Birim']} eklenmeli.")
    conn.close()

if __name__ == "__main__":
    list_missing_stock()
