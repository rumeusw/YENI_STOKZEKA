import sqlite3
from datetime import datetime, timedelta

DB_PATH = 'stokzeka_guncel.db'
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Start from the day after the last sale
start_date = datetime.strptime('2026-01-01', '%Y-%m-%d')
days = [
    ('2026-01-01', 'Perşembe', 0, 'Güneşli', 15, 0, 'Yok'),
    ('2026-01-02', 'Cuma', 0, 'Yağmurlu', 12, 0, 'Yok'),
    ('2026-01-03', 'Cumartesi', 1, 'Bulutlu', 14, 0, 'Yok'),
    ('2026-01-04', 'Pazar', 1, 'Güneşli', 18, 1, 'Hafta Sonu İndirimi'),
    ('2026-01-05', 'Pazartesi', 0, 'Güneşli', 16, 0, 'Yok'),
    ('2026-01-06', 'Salı', 0, 'Güneşli', 28, 0, 'Yok'), # Sıcak bir gün
    ('2026-01-07', 'Çarşamba', 0, 'Yağmurlu', 10, 0, 'Yok'), # Soğuk ve yağmurlu
]

cursor.executemany("INSERT INTO DisFaktorler (Tarih, Gun_Adi, Hafta_Sonu_Mu, Hava_Durumu, Sicaklik, Kampanya_Var_Mi, Kampanya_Turu) VALUES (?, ?, ?, ?, ?, ?, ?)", days)
conn.commit()
conn.close()
print("Mock external factors added for the next week.")
