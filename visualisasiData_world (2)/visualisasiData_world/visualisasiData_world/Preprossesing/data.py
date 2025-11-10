import pandas as pd
import glob
import os

# Folder tempat file CSV disimpan
folder = "data"
output_file = os.path.join(folder, "world_happiness.csv")

# Cari semua file CSV di folder data
files = sorted(glob.glob(os.path.join(folder, "*.csv")))

all_data = []

for file in files:
    # Ekstrak tahun dari nama file (misal '2015.csv' -> 2015)
    year = os.path.basename(file).split(".")[0]
    df = pd.read_csv(file)
    df["Year"] = int(year)

    # Normalisasi nama kolom antar tahun
    df.columns = df.columns.str.strip().str.lower()

    # Kolom yang umum di semua tahun
    possible_cols = {
        "country": ["country", "country name", "country or region"],
        "region": ["region"],
        "score": ["happiness score", "score", "happiness.rank", "happiness score (0-10)"],
        "gdp": ["economy (gdp per capita)", "gdp per capita", "logged gdp per capita"],
        "life_expectancy": ["health (life expectancy)", "healthy life expectancy"],
        "freedom": ["freedom", "freedom to make life choices"],
        "corruption": ["trust (government corruption)", "perceptions of corruption"],
    }

    # Map kolom ke nama seragam
    new_cols = {}
    for key, candidates in possible_cols.items():
        for c in candidates:
            if c in df.columns:
                new_cols[c] = key
                break

    df = df.rename(columns=new_cols)

    # Simpan hanya kolom penting
    keep_cols = ["country", "region", "year", "score", "gdp", "life_expectancy", "freedom", "corruption"]
    df = df[[c for c in keep_cols if c in df.columns]]

    all_data.append(df)

# Gabungkan semua tahun
merged = pd.concat(all_data, ignore_index=True)

# Hapus duplikat dan nilai kosong
merged = merged.drop_duplicates().dropna(subset=["country", "score"])

# Simpan hasil akhir
merged.to_csv(output_file, index=False)
print(f"✅ Data gabungan berhasil disimpan ke: {output_file}")
print(f"Total baris: {len(merged)}")
print("Preview:")
print(merged.head())
