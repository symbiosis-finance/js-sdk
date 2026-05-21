# Vulnerability Report

**Scan date:** 2026-05-21  
**Ecosystem:** npm  

## Summary

| Metric | Count |
|--------|-------|
| Pre-patch vulnerable (package, version) instances | 28 |
| Post-patch vulnerable instances | 7 |
| **Resolved** | **21** |

## Manifest Changes

```
```

## Remaining Vulnerabilities

| Package | Version | Severity | Advisory IDs |
|---------|---------|----------|-------------|
| ws | 8.17.1 | MODERATE | GHSA-58qx-3vcg-4xpx |
| @openzeppelin/contracts | 3.4.2-solc-0.7 | CRITICAL | GHSA-7grf-83vw-6f5x, GHSA-88g8-f5mf-f5rj, GHSA-9c22-pwxw-p6hx |
| axios | 1.13.2 | HIGH | GHSA-3p68-rc4w-qgx5, GHSA-3w6x-2g7m-8v23, GHSA-43fc-jf86-j433 |
| bigint-buffer | 1.1.5 | HIGH | GHSA-3gc7-fjrx-p6mg |
| elliptic | 6.6.1 | LOW | GHSA-848j-6mx2-7j84 |
| lodash | 4.17.23 | HIGH | GHSA-f23m-r3pf-42rh, GHSA-r5fr-rjxr-66jc |
| ws | 8.18.0 | MODERATE | GHSA-58qx-3vcg-4xpx |

## Escalations

### ws@8.17.1 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.ws = "8.20.1"`

### brace-expansion@1.1.12 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.brace-expansion = "2.0.3"`

### minimatch@3.1.2 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.minimatch = "9.0.7"`

### @openzeppelin/contracts@3.4.2-solc-0.7 (CRITICAL)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.@openzeppelin/contracts = "?"`

### ajv@6.12.6 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.ajv = "6.14.0"`

### picomatch@2.3.1 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.picomatch = "4.0.4"`

### axios@1.13.2 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.axios = "1.15.2"`

### bigint-buffer@1.1.5 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.bigint-buffer = "?"`

### cookie@0.4.2 (LOW)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.cookie = "0.7.0"`

### diff@5.2.0 (LOW)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.diff = "5.2.2"`

### elliptic@6.6.1 (LOW)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.elliptic = "?"`

### bn.js@4.12.2 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.bn.js = "4.12.3"`

### fast-uri@3.1.0 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.fast-uri = "3.1.2"`

### flatted@3.3.3 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.flatted = "3.4.2"`

### follow-redirects@1.15.11 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.follow-redirects = "1.16.0"`

### immutable@4.3.7 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.immutable = "4.3.8"`

### lodash@4.17.21 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.lodash = "4.18.0"`

### postcss@8.5.6 (MODERATE)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.postcss = "8.5.10"`

### rollup@4.55.1 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.rollup = "4.59.0"`

### serialize-javascript@6.0.2 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.serialize-javascript = "7.0.5"`

### tmp@0.0.33 (LOW)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.tmp = "0.2.4"`

### undici@5.29.0 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.undici = "6.24.0"`

### vite@7.3.1 (HIGH)
- **Path:** unknown
- **Why no fix:** Could not trace to a direct manifest ancestor
- **Override recipe:** `overrides.vite = "7.3.2"`

