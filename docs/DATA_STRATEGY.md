# CrudeMap data strategy

## Reference target

CrudeMap's reference target is every country rendered by the map, with oil and
natural-gas production, consumption, imports, exports, and bilateral flows.
During 2026, current-year observations must be labelled **2026 YTD**. A 2026
annual total is not an observation until the year has closed; forecasts and
annualised run rates must remain visibly distinct from observations.

Run the measurable coverage audit from the repository root:

```bash
python backend/etl/audit_coverage.py
python backend/etl/audit_coverage.py --json
python backend/etl/audit_coverage.py --strict
```

`--strict` is the long-term acceptance gate. It intentionally fails while any
mapped country lacks a current oil/gas profile or **current-year** flow
coverage; an old route no longer satisfies the gate.

## Source hierarchy

1. **2026 monthly observations:** JODI Oil and JODI Gas. Both are free,
   country-reported, updated monthly, and publish assessment/quality codes.
2. **Complete annual baseline:** EIA International bulk data (2025 total
   petroleum and 2024 dry natural gas). It is the reproducible fallback when a
   country has not reported enough 2026 monthly observations. A newer national
   or Energy Institute observation may supersede it only with explicit
   provenance.
3. **Bilateral customs flows:** UN Comtrade, HS 2709 for crude oil and HS 271111
   for LNG. Reporter/import data should be preferred, mirror data should be
   flagged, and quantities must be reconciled to avoid double counting. The
   active keyless collector queries only officially available reporter-months
   and recursively splits every Preview response that reaches the 500-row cap;
   a capped response is never silently accepted.
4. **European bilateral customs flows:** Eurostat Comext DS-045409 physical
   quantities, updated monthly. These supersede Comtrade mirrors for European
   reporters and retain each reporter's actual latest month.
5. **Physical pipeline flows:** system operators and regional transparency
   platforms. ENTSOG daily physical flows are the active 2026 source for
   European TSO-to-TSO borders, because customs data does not reliably identify
   route or transport mode. Values are deduplicated across the two operator
   sides, annualised over the stated YTD period, and converted using 10.55
   kWh per standard cubic metre. They remain medium-confidence until point/day
   gross calorific values are applied.
6. **Country-by-country fallback:** national ministries, regulators, customs,
   and statistical agencies. Every manual value needs a source URL, period,
   retrieval date, unit conversion, and confidence note.

The machine-readable source register and current status live in
`backend/etl/data/data_manifest.json`.

## Non-negotiable quality rules

- Never replace missing data with zero. Zero means the source explicitly
  reported zero; missing means unknown.
- Never relabel a 2024 or 2025 value as 2026.
- Store observation period, publication/retrieval date, original unit, applied
  conversion, source URL, and source quality code.
- Keep observed, estimated, annualised, forecast, and mirror values distinct.
- Reconcile country totals against bilateral flows, allowing documented timing,
  stock, re-export, and product-scope differences.
- Preserve revisions: upstream energy data is routinely revised after first
  publication.

## Delivery sequence

1. Add normalized observations and provenance storage without breaking the
   current snapshot API.
2. Import EIA International as the complete reproducible annual baseline.
3. Import and aggregate JODI 2026 monthly oil and gas observations, preserving
   quality codes and the last reported month per country.
4. Import UN Comtrade monthly bilateral flows and reconcile reporter/mirror
   records.
5. Fill uncovered countries and physical pipeline flows source by source.
6. Expose period, freshness, source, and coverage status in the UI; only then
   describe CrudeMap as a reference dataset.
