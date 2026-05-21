# Escalation Report — Vulnerabilities Without Clean Fix Paths

**Date:** 2026-05-21

The following packages cannot be patched by bumping a manifest entry alone.
Overrides would mechanically resolve them but were NOT applied automatically.
Review each item and decide whether to apply the suggested override.

---

## Item 1 — ws (MODERATE)

| Field | Value |
|-------|-------|
| Package | `ws@8.17.1` |
| Severity | MODERATE |
| Advisory IDs | GHSA-58qx-3vcg-4xpx |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.ws = "8.20.1"` |

- **GHSA-58qx-3vcg-4xpx**: ws: Uninitialized memory disclosure

## Item 2 — brace-expansion (MODERATE)

| Field | Value |
|-------|-------|
| Package | `brace-expansion@1.1.12` |
| Severity | MODERATE |
| Advisory IDs | GHSA-f886-m6hf-6m8v |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.brace-expansion = "2.0.3"` |

- **GHSA-f886-m6hf-6m8v**: brace-expansion: Zero-step sequence causes process hang and memory exhaustion

## Item 3 — minimatch (HIGH)

| Field | Value |
|-------|-------|
| Package | `minimatch@3.1.2` |
| Severity | HIGH |
| Advisory IDs | GHSA-7r86-cg39-jmmj, GHSA-3ppc-4f35-3m26, GHSA-23c5-xmqv-rm74 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.minimatch = "9.0.7"` |

- **GHSA-7r86-cg39-jmmj**: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segmen
- **GHSA-3ppc-4f35-3m26**: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern
- **GHSA-23c5-xmqv-rm74**: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions

## Item 4 — @openzeppelin/contracts (CRITICAL)

| Field | Value |
|-------|-------|
| Package | `@openzeppelin/contracts@3.4.2-solc-0.7` |
| Severity | CRITICAL |
| Advisory IDs | GHSA-88g8-f5mf-f5rj, GHSA-7grf-83vw-6f5x, GHSA-9c22-pwxw-p6hx, GHSA-fg47-3c2x-m2wr, GHSA-mx2q-35m2-x2rh |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.@openzeppelin/contracts = "?"` |

- **GHSA-88g8-f5mf-f5rj**: Improper Initialization in OpenZeppelin
- **GHSA-7grf-83vw-6f5x**: OpenZeppelin Contracts ERC165Checker unbounded gas consumption
- **GHSA-9c22-pwxw-p6hx**: OpenZeppelin Contracts initializer reentrancy may lead to double initialization

## Item 5 — ajv (MODERATE)

| Field | Value |
|-------|-------|
| Package | `ajv@6.12.6` |
| Severity | MODERATE |
| Advisory IDs | GHSA-2g4f-4pwh-qvx6 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.ajv = "6.14.0"` |

- **GHSA-2g4f-4pwh-qvx6**: ajv has ReDoS when using `$data` option

## Item 6 — picomatch (HIGH)

| Field | Value |
|-------|-------|
| Package | `picomatch@2.3.1` |
| Severity | HIGH |
| Advisory IDs | GHSA-c2c7-rcm5-vvqj, GHSA-3v7f-55p6-f55p |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.picomatch = "4.0.4"` |

- **GHSA-c2c7-rcm5-vvqj**: Picomatch has a ReDoS vulnerability via extglob quantifiers
- **GHSA-3v7f-55p6-f55p**: Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching

## Item 7 — axios (HIGH)

| Field | Value |
|-------|-------|
| Package | `axios@1.13.2` |
| Severity | HIGH |
| Advisory IDs | GHSA-62hf-57xw-28j9, GHSA-vf2m-468p-8v99, GHSA-3p68-rc4w-qgx5, GHSA-m7pr-hjqh-92cm, GHSA-pf86-5x62-jrwf |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.axios = "1.15.2"` |

- **GHSA-62hf-57xw-28j9**: Axios: unbounded recursion in toFormData causes DoS via deeply nested request data
- **GHSA-vf2m-468p-8v99**: Axios: HTTP adapter streamed responses bypass maxContentLength
- **GHSA-3p68-rc4w-qgx5**: Axios has a NO_PROXY Hostname Normalization Bypass that Leads to SSRF

## Item 8 — bigint-buffer (HIGH)

| Field | Value |
|-------|-------|
| Package | `bigint-buffer@1.1.5` |
| Severity | HIGH |
| Advisory IDs | GHSA-3gc7-fjrx-p6mg |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.bigint-buffer = "?"` |

- **GHSA-3gc7-fjrx-p6mg**: bigint-buffer Vulnerable to Buffer Overflow via toBigIntLE() Function

## Item 9 — cookie (LOW)

| Field | Value |
|-------|-------|
| Package | `cookie@0.4.2` |
| Severity | LOW |
| Advisory IDs | GHSA-pxg6-pf52-xh8x |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.cookie = "0.7.0"` |

- **GHSA-pxg6-pf52-xh8x**: cookie accepts cookie name, path, and domain with out of bounds characters

## Item 10 — diff (LOW)

| Field | Value |
|-------|-------|
| Package | `diff@5.2.0` |
| Severity | LOW |
| Advisory IDs | GHSA-73rr-hh4g-fpgx |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.diff = "5.2.2"` |

- **GHSA-73rr-hh4g-fpgx**: jsdiff has a Denial of Service vulnerability in parsePatch and applyPatch

## Item 11 — elliptic (LOW)

| Field | Value |
|-------|-------|
| Package | `elliptic@6.6.1` |
| Severity | LOW |
| Advisory IDs | GHSA-848j-6mx2-7j84 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.elliptic = "?"` |

- **GHSA-848j-6mx2-7j84**: Elliptic Uses a Cryptographic Primitive with a Risky Implementation

## Item 12 — bn.js (MODERATE)

| Field | Value |
|-------|-------|
| Package | `bn.js@4.12.2` |
| Severity | MODERATE |
| Advisory IDs | GHSA-378v-28hj-76wf |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.bn.js = "4.12.3"` |

- **GHSA-378v-28hj-76wf**: bn.js affected by an infinite loop

## Item 13 — fast-uri (HIGH)

| Field | Value |
|-------|-------|
| Package | `fast-uri@3.1.0` |
| Severity | HIGH |
| Advisory IDs | GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.fast-uri = "3.1.2"` |

- **GHSA-q3j6-qgpj-74h6**: fast-uri vulnerable to path traversal via percent-encoded dot segments
- **GHSA-v39h-62p7-jpjc**: fast-uri vulnerable to host confusion via percent-encoded authority delimiters

## Item 14 — flatted (HIGH)

| Field | Value |
|-------|-------|
| Package | `flatted@3.3.3` |
| Severity | HIGH |
| Advisory IDs | GHSA-rf6f-7fwh-wjgh, GHSA-25h7-pfq9-p65f |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.flatted = "3.4.2"` |

- **GHSA-rf6f-7fwh-wjgh**: Prototype Pollution via parse() in NodeJS flatted
- **GHSA-25h7-pfq9-p65f**: flatted vulnerable to unbounded recursion DoS in parse() revive phase

## Item 15 — follow-redirects (MODERATE)

| Field | Value |
|-------|-------|
| Package | `follow-redirects@1.15.11` |
| Severity | MODERATE |
| Advisory IDs | GHSA-r4q5-vmmm-2653 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.follow-redirects = "1.16.0"` |

- **GHSA-r4q5-vmmm-2653**: follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets

## Item 16 — immutable (HIGH)

| Field | Value |
|-------|-------|
| Package | `immutable@4.3.7` |
| Severity | HIGH |
| Advisory IDs | GHSA-wf6x-7x77-mvgw |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.immutable = "4.3.8"` |

- **GHSA-wf6x-7x77-mvgw**: Immutable is vulnerable to Prototype Pollution

## Item 17 — lodash (HIGH)

| Field | Value |
|-------|-------|
| Package | `lodash@4.17.21` |
| Severity | HIGH |
| Advisory IDs | GHSA-xxjr-mmjv-4gpg, GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.lodash = "4.18.0"` |

- **GHSA-xxjr-mmjv-4gpg**: Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions
- **GHSA-r5fr-rjxr-66jc**: lodash vulnerable to Code Injection via `_.template` imports key names
- **GHSA-f23m-r3pf-42rh**: lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`

## Item 18 — postcss (MODERATE)

| Field | Value |
|-------|-------|
| Package | `postcss@8.5.6` |
| Severity | MODERATE |
| Advisory IDs | GHSA-qx2v-qp2m-jg93 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.postcss = "8.5.10"` |

- **GHSA-qx2v-qp2m-jg93**: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output

## Item 19 — rollup (HIGH)

| Field | Value |
|-------|-------|
| Package | `rollup@4.55.1` |
| Severity | HIGH |
| Advisory IDs | GHSA-mw96-cpmx-2vgc |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.rollup = "4.59.0"` |

- **GHSA-mw96-cpmx-2vgc**: Rollup 4 has Arbitrary File Write via Path Traversal

## Item 20 — serialize-javascript (HIGH)

| Field | Value |
|-------|-------|
| Package | `serialize-javascript@6.0.2` |
| Severity | HIGH |
| Advisory IDs | GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.serialize-javascript = "7.0.5"` |

- **GHSA-5c6j-r48x-rmvq**: Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.toISOString()
- **GHSA-qj8w-gfj5-8c6v**: Serialize JavaScript has CPU Exhaustion Denial of Service via crafted array-like objects

## Item 21 — tmp (LOW)

| Field | Value |
|-------|-------|
| Package | `tmp@0.0.33` |
| Severity | LOW |
| Advisory IDs | GHSA-52f5-9888-hmc6 |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.tmp = "0.2.4"` |

- **GHSA-52f5-9888-hmc6**: tmp allows arbitrary temporary file / directory write via symbolic link `dir` parameter

## Item 22 — undici (HIGH)

| Field | Value |
|-------|-------|
| Package | `undici@5.29.0` |
| Severity | HIGH |
| Advisory IDs | GHSA-v9p9-hfj2-hcw8, GHSA-g9mf-h72j-4rw9, GHSA-vrm6-8vpv-qv8q, GHSA-4992-7rv2-5pvq, GHSA-2mjp-6q6p-2qxm |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.undici = "6.24.0"` |

- **GHSA-v9p9-hfj2-hcw8**: Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits Validation
- **GHSA-g9mf-h72j-4rw9**: Undici has an unbounded decompression chain in HTTP responses on Node.js Fetch API via Content-Encod
- **GHSA-vrm6-8vpv-qv8q**: Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression

## Item 23 — vite (HIGH)

| Field | Value |
|-------|-------|
| Package | `vite@7.3.1` |
| Severity | HIGH |
| Advisory IDs | GHSA-p9ff-h696-f583, GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r |
| Dep path | unknown |
| Why no clean fix | Could not trace to a direct manifest ancestor |
| Override recipe | `overrides.vite = "7.3.2"` |

- **GHSA-p9ff-h696-f583**: Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket
- **GHSA-4w7w-66w2-5vf9**: Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling
- **GHSA-v2wj-q39q-566r**: Vite: `server.fs.deny` bypassed with queries

---

## Decision Required

For the items above, the only mechanical fix is an override.
Reply with package names or advisory IDs to override, or 'none' to leave them unresolved.
