# Spotify Smart Discovery 🎧

[Türkçe](#-türkçe) · [English](#-english) · [Setup](#-setup) · [Privacy & Cost](#-privacy--cost) · [License](LICENSE)

A **free**, **single-user** playlist discovery tool that mines public Spotify playlists to surface genuinely fresh tracks — beyond stale algorithmic recommendations. Bilingual UI (TR/EN), optional AI theme expansion, preview-before-commit, AI cover art, PWA. Everything runs on free tiers; no paid APIs.

---

## 🇹🇷 Türkçe

**Spotify Smart Discovery**, kütüphanenizdekine benzemeyen gerçekten taze parçalar bulmak için yüzlerce public Spotify çalma listesini eleyen, tek kullanıcılı, tamamen ücretsiz bir araçtır.

### Nasıl çalışır?
1. Bir tema yaz (örn. `gece sürüşü, türkçe rap`) veya 9 hazır vibe'dan birini seç
2. Bot, Spotify'daki ilgili public playlist'leri tarar, 100-200 şarkı toplar
3. Filtreler uygulanır (yıl, süre, explicit, akustik/live/remix/cover)
4. Spotify'a eklemeden **önce listeyi sen onaylarsın** — beğenmediklerini ✕ ile çıkar
5. "Onayla" → playlist hesabında oluşur (istersen Pollinations.ai ile AI kapak resmiyle birlikte)

### Öne çıkan özellikler
- **9 hazır vibe preset** (Sabah Kahvesi, Gece Sürüşü, Antrenman, Çalışma, Parti, Yağmurlu Gün, Romantik, Odaklanma, Rahatlama)
- **Multi-tema arama** — virgülle ayır, her tema ayrı aranır, sonuçlar karışır
- **AI tema genişletme (opsiyonel)** — `"yağmurlu pazar sabahı"` yaz → Gemini Flash 5-8 spesifik aramaya çevirir
- **Akıllı filtreler** — yıl aralığı, süre, explicit, sadece akustik/instrumental, remix/live/cover'ları gizle
- **Sanatçı rotasyonu** — aynı sanatçı arka arkaya gelmez
- **Onay öncesi önizleme** — albüm kapağı, sanatçı, süre, bucket etiketi
- **localStorage geçmişi + kaydedilmiş preset'ler** — sık kullandığın kombinasyonları yedekle
- **AI kapak resmi** — Pollinations.ai ile bedava, ~720ms
- **PWA** — telefon ana ekranına eklenebilir
- **Anti-duplication** — kütüphanendeki şarkıları otomatik eler

---

## 🇬🇧 English

**Spotify Smart Discovery** is a single-user tool that mines hundreds of public Spotify playlists to surface genuinely fresh tracks. Completely free — no paid APIs.

### How it works
1. Type a theme (e.g. `night drive, retro synth`) or pick one of 9 vibe presets
2. The backend scans matching public Spotify playlists and collects 100-200 tracks
3. Filters apply (year, duration, explicit, acoustic/live/remix/cover)
4. You **review the list before commit** — remove any track you don't want with ✕
5. Approve → playlist is created in your account (with an optional Pollinations.ai cover)

### Highlights
- **9 vibe presets** (Morning Coffee, Night Drive, Workout, Study, Party, Rainy Day, Romantic, Focus, Relax)
- **Multi-theme search** — comma-separated themes searched in parallel and blended
- **AI theme expansion (optional)** — type `"rainy sunday morning"` → Gemini Flash converts it into 5-8 Spotify queries
- **Smart filters** — year range, duration, explicit, acoustic/instrumental only, hide remix/live/cover
- **Artist rotation** — same artist never plays back-to-back
- **Preview-before-commit** — album art, artist, duration, bucket label
- **localStorage history + saved presets** — keep your favorite combos one click away
- **AI cover art** — free via Pollinations.ai, ~720ms
- **PWA** — installable to phone home screen
- **Anti-duplication** — auto-removes tracks already in your library

---

## 🛠 Setup

### Requirements
- Node.js 18+
- A Spotify account (free works fine)
- *(Optional)* A free Google AI Studio account for the AI theme expansion feature

### 1. Clone & install
```bash
git clone https://github.com/berkegncc/Spotify_Smart_Discovery.git
cd Spotify_Smart_Discovery
npm install
```

### 2. Create a Spotify Developer app
1. Open [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app**
2. Add `http://localhost:3000/callback` as a **Redirect URI**
3. Copy the **Client ID** and **Client Secret**

### 3. Configure `.env`
```bash
cp .env.example .env
```
Open `.env` and fill in:
```
SPOTIFY_CLIENT_ID=<from step 2>
SPOTIFY_CLIENT_SECRET=<from step 2>
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
SPOTIFY_REFRESH_TOKEN=    # filled in next step
GEMINI_API_KEY=           # optional, see step 5
```

### 4. Get your Spotify refresh token
```bash
node get-token.js
```
This prints a URL. Open it, authorize the app, then copy the `code=...` parameter from the redirect URL. Run:
```bash
node get-token.js "<paste-code-here>"
```
Paste the printed refresh token into `.env`'s `SPOTIFY_REFRESH_TOKEN`.

### 5. *(Optional)* Gemini API key — for AI theme expansion
1. Visit [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key** (no credit card required)
3. Paste into `.env`'s `GEMINI_API_KEY`

> [!IMPORTANT]
> **Keep it free.** `gemini-2.5-flash` exists on both free and paid tiers — the same API key serves both. Whether your usage stays free depends on the **billing status of the GCP project that owns your key**:
> - **GCP billing disabled** (recommended) → over-quota requests are rejected. **No bill possible.**
> - **GCP billing enabled** → over-quota silently spills into paid tier. Set a `$0 / 0 TRY budget alert` at [Cloud Console → Budgets](https://console.cloud.google.com/billing/budgets) first.
>
> Without a Gemini key the app still works perfectly — only the "AI Theme Expansion" checkbox becomes silently inert.

### 6. Run

**Windows (one-click):**
```
start.bat
```
Auto-installs dependencies if missing, opens `http://localhost:3000` in your browser, shows server logs in the same window. Ctrl+C to stop.

**Any OS:**
```bash
npm start
# then open http://localhost:3000
```

---

## 🔐 Privacy & Cost

| | |
|---|---|
| **Your credentials stay local** | `.env` is gitignored. Never committed, never leaves your machine. |
| **Bring your own keys** | This repo ships only with `.env.example` placeholders. **Each user needs their own Spotify and (optionally) Gemini keys** — the owner's keys are not bundled. |
| **No tracking** | No analytics, no telemetry, no third-party scripts. |
| **No bills** | Spotify Web API (free) + Gemini AI Studio (free tier) + Pollinations.ai (no signup) = $0/month, **provided you follow the Gemini billing note above**. |

---

## 🛡 Security

- `helmet` security headers, origin-whitelisted CORS, per-endpoint rate limiting
- All request bodies validated with `zod` (strict types, length caps, regex on track URIs)
- Gemini model name **hardcoded** (`gemini-2.5-flash`) — physically cannot drift to paid models like Veo or Imagen
- App-level Gemini rate limit (10/min, below the free tier's 15 RPM)
- Graceful fallback: if Gemini fails (missing key, timeout, parse error), the app falls back to your original theme and notifies you in the progress stream

---

## 🧱 Built with

| Layer | Stack |
|---|---|
| Backend | Node.js + Express, helmet, zod, express-rate-limit, NDJSON streaming |
| Frontend | Vanilla HTML/JS + Tailwind CDN, PWA (manifest + service worker) |
| APIs | Spotify Web API, Google Gemini 2.5 Flash, Pollinations.ai |

---

## ⚠️ Caveats

- The "filter AI-generated tracks" toggle uses regex on track/album/artist names — heuristic, with possible false positives and negatives
- Audio Features / Recommendations endpoints are **not used** (Spotify deprecated them for new Development Mode apps in Nov 2024). The app relies only on Search and Playlist APIs, which remain available.
- Single-user by design — each user runs their own instance with their own Spotify account. No shared backend, no multi-tenant OAuth.

---

## 📜 License

MIT — see [LICENSE](LICENSE).
