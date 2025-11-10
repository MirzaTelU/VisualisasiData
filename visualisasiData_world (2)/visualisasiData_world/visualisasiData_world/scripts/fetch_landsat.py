#!/usr/bin/env python3
"""
fetch_landsat.py

Script kecil untuk mengunduh dataset Statlog (Landsat Satellite) dari UCI menggunakan ucimlrepo
dan mengekspor ke CSV di folder data/landsat.csv sehingga frontend dapat memuatnya.

Usage (PowerShell):
    pip install ucimlrepo pandas
    python ./scripts/fetch_landsat.py

Output: ./data/landsat.csv
"""
import os
from ucimlrepo import fetch_ucirepo
import pandas as pd


def main():
    print('Fetching Statlog (Landsat Satellite) from UCI (id=146) ...')
    try:
        ds = fetch_ucirepo(id=146)
    except Exception as e:
        print('Error fetching dataset:', e)
        raise
    X = ds.data.features
    y = ds.data.targets

    # print metadata & variable information for debugging (similar to your snippet)
    try:
        print('\n--- metadata ---')
        print(ds.metadata)
    except Exception:
        print('No metadata available')
    try:
        print('\n--- variables ---')
        print(ds.variables)
    except Exception:
        print('No variable information available')

    # X may be a pandas DataFrame already (ucimlrepo typical structure). Make a copy and attach target
    try:
        df = X.copy()
    except Exception:
        df = pd.DataFrame(X)

    # ensure targets available and attach as 'class' or original name if present
    if hasattr(y, 'name') and y.name:
        target_name = y.name
    else:
        target_name = 'class'

    df[target_name] = y

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'landsat.csv')
    df.to_csv(out_path, index=False)
    print(f'Wrote {out_path} ({len(df)} rows, {len(df.columns)} columns)')


if __name__ == '__main__':
    main()
