"""Curated gazetteer of major petroleum ports.

Maps UN/LOCODEs and common port names to (lon, lat). Deliberately small and
curated — unresolved destinations return None so the frontend fades the
vessel instead of inventing a route.
"""
from __future__ import annotations

# (lon, lat) — a compact set of the busiest crude/product/LNG ports.
_PORTS: dict[str, tuple[float, float]] = {
    "NLRTM": (4.10, 51.95),   # Rotterdam
    "SGSIN": (103.85, 1.26),  # Singapore
    "CNSHA": (121.80, 31.05), # Shanghai
    "CNNGB": (121.85, 29.87), # Ningbo
    "AEFJR": (56.35, 25.13),  # Fujairah
    "AEJEA": (55.03, 24.98),  # Jebel Ali
    "SAJUB": (49.66, 27.02),  # Jubail
    "SARAB": (49.58, 27.48),  # Ras Tanura
    "USHOU": (-95.05, 29.62), # Houston
    "USLOOP": (-90.02, 28.88),# LOOP (Louisiana)
    "KRYOS": (129.38, 35.10), # Yeosu / Ulsan area
    "JPCHB": (140.05, 35.55), # Chiba
    "INJAM": (69.72, 22.35),  # Sikka/Jamnagar
    "EGSUZ": (32.55, 29.93),  # Suez
    "RUPRI": (34.78, 44.62),  # Primorsk (approx)
    "RUNVS": (37.80, 44.72),  # Novorossiysk
    "TRCEY": (35.90, 36.88),  # Ceyhan
    "DZARZ": (0.30, 35.85),   # Arzew (LNG)
    "QARLF": (51.55, 25.90),  # Ras Laffan (LNG)
    "AUKAR": (116.13, -20.58),# Karratha (NW Shelf LNG)
    "USSAB": (-93.87, 29.73), # Sabine Pass (LNG)
    "GBMLF": (-5.05, 51.70),  # Milford Haven
    "BEZEE": (3.20, 51.35),   # Zeebrugge (LNG)
    "FRFOS": (4.90, 43.42),   # Fos-sur-Mer
    "MYPKG": (101.35, 3.00),  # Port Klang
    "NGBON": (7.17, 4.45),    # Bonny (LNG)
}

# Common name fragments → LOCODE (checked with `in`, longest first).
_NAME_TO_CODE: dict[str, str] = {
    "ROTTERDAM": "NLRTM", "SINGAPORE": "SGSIN", "SHANGHAI": "CNSHA",
    "NINGBO": "CNNGB", "FUJAIRAH": "AEFJR", "JEBEL ALI": "AEJEA",
    "JUBAIL": "SAJUB", "RAS TANURA": "SARAB", "HOUSTON": "USHOU",
    "LOOP": "USLOOP", "YEOSU": "KRYOS", "ULSAN": "KRYOS", "CHIBA": "JPCHB",
    "JAMNAGAR": "INJAM", "SIKKA": "INJAM", "SUEZ": "EGSUZ",
    "PRIMORSK": "RUPRI", "NOVOROSSIYSK": "RUNVS", "CEYHAN": "TRCEY",
    "ARZEW": "DZARZ", "RAS LAFFAN": "QARLF", "KARRATHA": "AUKAR",
    "SABINE": "USSAB", "MILFORD": "GBMLF", "ZEEBRUGGE": "BEZEE",
    "FOS": "FRFOS", "PORT KLANG": "MYPKG", "BONNY": "NGBON",
}


def resolve_destination(text: str | None) -> tuple[float, float] | None:
    if not text:
        return None
    key = text.strip().upper()
    if not key:
        return None
    if key in _PORTS:
        return _PORTS[key]
    for fragment in sorted(_NAME_TO_CODE, key=len, reverse=True):
        if fragment in key:
            return _PORTS[_NAME_TO_CODE[fragment]]
    return None
