# NFOP — NOIR FRAME Operator

**Wersja:** 4.0.0-alpha.003  
**Produkcja:** [nfop.pages.dev](https://nfop.pages.dev) (Cloudflare Pages)  
**Repo:** [noirframecontact-sys/NFOP](https://github.com/noirframecontact-sys/NFOP)

Operator workspace dla Noir Frame — projekty, katalog, oferty, synchronizacja przez Supabase Realtime (Volvo Trunk / SYNCHRO).

Zasady architektury: [`NFOP-4.1-MANIFEST.md`](NFOP-4.1-MANIFEST.md) (obowiązuje) · [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) (4.0, archiwum)

---

## Deploy (skrót)

```
Cursor → commit → push main → GitHub → Cloudflare Pages (auto build + deploy)
```

Build command: `node scripts/generate-config-production.mjs`  
Sekrety Supabase **nie są w repo** — tylko w Cloudflare → Settings → Environment variables.

---

## PROBLEMY

Checklista na wypadek awarii. Najpierw ustal, **gdzie** coś nie działa: build, strona po deployu, czy synchronizacja.

### Build Cloudflare się wywala

1. Cloudflare Dashboard → **Workers & Pages** → **nfop** → **Deployments** → kliknij failed deploy → **Build log**
2. Szukaj linii `[NFOP build]`

| Log | Przyczyna | Co zrobić |
|-----|-----------|-----------|
| `Missing NF_SUPABASE_ANON_KEY` | Brak klucza w buildzie | Ustaw zmienną w Cloudflare (patrz niżej) |
| `Related env keys visible to build: (none)` | Zmienne nie są widoczne dla builda | Sprawdź scope **Production** / **Preview**, zapisz, **Retry deployment** |
| `Local build — skipping config.production.js` | Stary skrypt lub build poza CI | Upewnij się, że `main` ma aktualny `scripts/generate-config-production.mjs` |
| `config.production.js generated (cloudflare-pages)` | Build OK | Problem jest po stronie runtime / cache, nie builda |

### Zmienne środowiskowe w Cloudflare

**Settings → Environment variables → Production**

| Name | Value | Uwagi |
|------|-------|-------|
| `NF_SUPABASE_ANON_KEY` | `eyJ...` (anon key z Supabase) | **Nie** URL projektu — to długi token JWT |
| `NODE_VERSION` | `20` | Opcjonalnie, ale zalecane |

Opcjonalnie: `NF_SUPABASE_URL` — jeśli puste, skrypt używa domyślnego URL z repo.

**Typowe pomyłki:**
- URL Supabase wklejony jako wartość `NF_SUPABASE_ANON_KEY` zamiast klucza `anon`
- Zamiana name ↔ value (np. URL jako nazwa zmiennej)
- Zmienna tylko w **Preview**, a deploy leci z `main` (**Production**)

Klucz anon: Supabase → **Project Settings → API → Project API keys → anon / public**

Po każdej zmianie zmiennych: **Retry deployment** (sam zapis nie przebudowuje starego deployu).

### Czerwona kropka online (Supabase offline)

1. Hard refresh: Ctrl+Shift+R (PC) lub wyczyść cache na iPadzie
2. DevTools → **Network** — czy ładuje się `config.production.js`?
3. Jeśli brak pliku → ostatni build mógł pominąć generowanie (patrz build log)
4. Jeśli plik jest, ale kropka czerwona → zły `anonKey` w Cloudflare albo problem po stronie Supabase

Lokalnie (bez `config.local.js`) czerwona kropka jest **normalna** — brak klucza w dev.

### Strona stara / zmiany nie widać

1. Sprawdź, czy push poszedł na GitHub (`main`)
2. Cloudflare → **Deployments** — czy najnowszy deploy to **Success** i commit, który edytowałeś?
3. Hard refresh / tryb prywatny — Cloudflare i Safari na iPadzie agresywnie cache'ują
4. Build log: `Uploading... (X/Y)` — ile plików poszło? Przy małej zmianie często 1–3 nowe pliki

### SYNCHRO / synchronizacja między iPadami

- Zmiany z Realtime trafiają do **kolejki** — operator musi nacisnąć **SYNCHRO**
- Dwa iPady: oba muszą mieć świeży deploy i połączenie (zielona kropka)
- Po **Open From** (ELCH-MODUS) zmiany idą do kolejki outbound — też wymagają SYNCHRO
- Rozłączenie sieci → po reconnect bootstrap porównuje stan; UI nie aktualizuje się samo

Szczegóły: [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md)

### Co commitować, a czego nie

| Plik | Commit? |
|------|---------|
| Kod aplikacji (`*.js`, `*.css`, `index.html`) | Tak |
| `scripts/generate-config-production.mjs` | Tak |
| `config.production.js` | **Nie** — generowany przy deployu, gitignore |
| `config.local.js` | **Nie** — tylko lokalnie, gitignore |
| Klucze Supabase | **Nigdy** — tylko Cloudflare (i opcjonalnie lokalny `config.local.js`) |

### Workflow naprawy

```
Problem w kodzie  →  Cursor  →  commit  →  push main  →  poczekaj ~1 min na deploy
Problem z kluczem →  Cloudflare env vars  →  Save  →  Retry deployment
Nie wiesz co      →  build log + DevTools Network  →  dopiero potem kod
```

### Gdzie szukać pomocy w repo

| Temat | Plik |
|-------|------|
| Architektura sync | `DESIGN-PRINCIPLES.md` |
| Historia wersji | `CHANGELOG.md` |
| Struktura projektu | `PROJECT_STRUCTURE.md` |
| Schema Supabase | `supabase/schema.sql` |

---

## Linki

- **Produkcja:** https://nfop.pages.dev
- **GitHub:** https://github.com/noirframecontact-sys/NFOP
- **Supabase:** dashboard projektu `mcppojmghmwwvubyrufo`
