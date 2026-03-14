<!-- 최종 확인일: 2026-03-14 -->

# CNSA Simulation Platform

> Interactive science simulations for CNSA education

| Item | Value |
|------|-------|
| **Deploy** | Vercel |
| **URL** | simul.cnsatools.com |
| **GitHub** | github.com/fbwiqb/simul-hub |
| **Stack** | Static HTML/JS (vanilla) + Vercel Edge Middleware |
| **Backend** | None |

## Architecture

```
시뮬레이션/
├── index.html          # Hub page - simulation catalog (password-protected)
├── middleware.js        # Password auth for hub only (POST form, cookie-based)
├── vercel.json          # Empty config
├── .gitignore
│
├── thermalbalance/     # Thermal equilibrium (통합과학1)
├── spectrum/           # Light spectrum (통합과학1)
├── magnet/             # Magnetic field + Faraday's law (통합과학1)
├── ecosystem/          # Predator-prey population (통합과학2)
├── enso-simulation/    # El Nino/La Nina climate (통합과학2)
├── neuronsimul/        # Neuron action potential (생명과학)
├── musclesimul/        # Muscle contraction (생명과학)
├── Evosnail/           # Natural selection evolution (생명과학)
├── glycolysis/         # Cellular respiration: glycolysis + TCA (생명과학, 26 SVG images)
└── acid-base/          # Acid-base titration (화학)
```

## Auth

- Hub page (`/`) only: password `cnsa2026` via POST form
- Individual simulations (`/spectrum/`, etc.): public, no auth
- Cookie `hub_auth=1` (24-hour expiry)
- Students receive direct simulation URLs, cannot browse hub

## Simulations by Subject

### 통합과학1 (Matter & Energy)
| Simulation | Path | Description |
|-----------|------|-------------|
| 열평형 | `/thermalbalance/` | Heat transfer between two objects |
| 스펙트럼 | `/spectrum/` | Emission/absorption spectra |
| 자기장 | `/magnet/` | Magnetic field + Faraday's law (7 images) |

### 통합과학2 (Systems & Interactions)
| Simulation | Path | Description |
|-----------|------|-------------|
| 생태계 | `/ecosystem/` | Predator-prey population dynamics |
| 엘니뇨 | `/enso-simulation/` | ENSO climate model (15 images) |

### 생명과학 (Life Science)
| Simulation | Path | Description |
|-----------|------|-------------|
| 뉴런 | `/neuronsimul/` | Action potential propagation |
| 근수축 | `/musclesimul/` | Sliding filament theory |
| 진화 | `/Evosnail/` | Snail shell color natural selection |
| 세포 호흡 | `/glycolysis/` | Glycolysis + TCA cycle step-by-step (26 SVG images) |

### 화학 (Chemistry)
| Simulation | Path | Description |
|-----------|------|-------------|
| 산-염기 적정 | `/acid-base/` | Neutralization and pH curve |

## Notes

- Each simulation is a single `index.html` with embedded CSS/JS
- `magnet/` and `enso-simulation/` have additional image assets
- All simulations are self-contained, no external dependencies
- Previously individual GitHub repos, consolidated 2026-02-06
