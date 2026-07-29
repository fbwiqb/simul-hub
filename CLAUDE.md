<!-- 최종 확인일: 2026-06-12 -->

# CNSA Simulation Platform

> **한 줄 설명**: 과학 교과 인터랙티브 시뮬레이션
> **카테고리**: 04_정적 호스팅 (Vercel 정적 호스팅; spectrum만 Firebase Firestore)
> **GitHub**: github.com/fbwiqb/simul-hub
> **배포 URL**: simul.cnsatools.com
> **마지막 동기화**: 2026-06-12

> Interactive science simulations for CNSA education

| Item | Value |
|------|-------|
| **Deploy** | Vercel (`simul.cnsatools.com`) |
| **URL** | simul.cnsatools.com |
| **GitHub** | github.com/fbwiqb/simul-hub |
| **Stack** | Static HTML/JS (vanilla) + Vercel Edge Middleware |
| **Backend** | None (except `spectrum/`: Firebase Firestore) |
| **Count** | 12 simulations (3 sections) |

## Architecture

```
과학-시뮬레이션/
├── index.html          # Hub page - simulation catalog (public)
├── vercel.json          # Static config
├── .gitignore
│
│  # 통합과학1 (물질과 에너지)
├── spectrum/           # Element emission/absorption spectra + Firebase realtime quiz/battle
├── stellar-evolution/  # Star life cycle and internal structure by mass
├── quake-volcano/      # Global earthquake/volcano/plate map (Leaflet + geojson; added 2026-06-12)
├── central-dogma/      # DNA→RNA→protein dice activity (transcription/translation, pair+solo; added 2026-06-12)
│  # 통합과학2 (시스템과 상호작용)
├── thermalbalance/     # Earth radiation balance
├── magnet/             # Magnetic field + Faraday's law (7 images)
├── Evosnail/           # Natural selection: snail shell color
├── enso-simulation/    # El Nino/La Nina climate (15 images)
├── acid-base/          # Acid-base titration + pH curve
│  # 생명과학 (생명 시스템)
├── neuronsimul/        # Neuron action potential
├── musclesimul/        # Muscle contraction / sliding filament
└── glycolysis/         # Cellular respiration: glycolysis + TCA (p5.js, 26 SVG images)
```

## Auth

- No auth anywhere. The hub (`/`) and every simulation are fully public.
- The former `middleware.js` password gate (`9544`, cookie `hub_auth=1`) was removed 2026-07-29.
- Only remaining gate: `spectrum/` teacher mode (`battle.html`, `quiz.html`) — client-side SHA-256 `TEACHER_HASH` compare, unrelated to the hub.

## Simulations by Subject

> Mirrors the live hub `index.html` (3 sections, 12 simulations).

### 통합과학1 (물질과 에너지)
| Simulation | Path | Description |
|-----------|------|-------------|
| 스펙트럼 | `/spectrum/` | Element emission/absorption spectra + Firebase realtime quiz & battle (index/play/quiz/battle.html, spectrum-core.js) |
| 별의 진화 | `/stellar-evolution/` | Star life cycle and internal structure by mass |
| 지진·화산 | `/quake-volcano/` | Global earthquake/volcano/plate-boundary map (Leaflet, geojson) |
| 유전정보의 흐름 | `/central-dogma/` | DNA→RNA→protein dice activity, transcription/translation drag+tap, pair/solo modes (self-contained; integrated from a shared file 2026-06-12) |

### 통합과학2 (시스템과 상호작용)
| Simulation | Path | Description |
|-----------|------|-------------|
| 지구시스템 복사 평형 | `/thermalbalance/` | Earth energy absorption/emission radiation balance |
| 자기장 | `/magnet/` | Magnetic field + Faraday's law (7 images) |
| 진화 | `/Evosnail/` | Snail shell color natural selection |
| 엘니뇨 | `/enso-simulation/` | ENSO climate / atmosphere-ocean interaction (15 images) |
| 산-염기 적정 | `/acid-base/` | Neutralization and pH titration curve |

### 생명과학 (생명 시스템)
| Simulation | Path | Description |
|-----------|------|-------------|
| 뉴런 | `/neuronsimul/` | Action potential generation and propagation |
| 근수축 | `/musclesimul/` | Sliding filament theory |
| 세포 호흡 | `/glycolysis/` | Glycolysis + TCA cycle step-by-step (p5.js, 26 SVG images) |

## Notes

- Most simulations are a single self-contained `index.html` with embedded CSS/JS.
- Exceptions / critical deps (do NOT break when refactoring):
  - `spectrum/` — Firebase Firestore (realtime multiplayer quiz/battle). Preserve Firebase config & data shape.
  - `glycolysis/` — loads p5.js (CDN) + 26 SVG/PNG in `img/`.
  - `quake-volcano/` — loads Leaflet (CDN) + ES modules in `src/` + geojson/json in `public/`.
  - `magnet/` (7 images), `enso-simulation/` (15 images) — image assets.
- Previously individual GitHub repos, consolidated 2026-02-06.
- `quake-volcano/` integrated from the standalone `quake-volcano-korean` Vercel project on 2026-06-12 (that standalone project is now redundant).
