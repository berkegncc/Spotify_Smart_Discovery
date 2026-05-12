# Spotify Smart Discovery Route 🎧

[**English**](#🌏-english-version) | [**Türkçe**](#🇹🇷-türkçe-versiyon) | [**Setup**](#🛠-setup--installation)

A **single-user**, **fully free** playlist generation tool that mines thousands of user-curated public playlists to surface genuinely fresh tracks. AI features run on Google Gemini's free tier — no paid third-party APIs required.

---

## 🌏 English Version

### 🌟 Features

#### Discovery Engine
* **Deep Discovery (Playlist Pool):** Search abstract themes like `night drive`, `lo-fi study`, or `phonk gym`. The tool scans up to 20 matching public playlists per theme and pulls tracks from each.
* **Multi-Theme Blending:** Comma-separate themes (`phonk gym, lofi study, retro synth`) — each is searched independently and the pools are blended.
* **9 Vibe Presets:** One-click curated themes (Morning Coffee, Night Drive, Workout, Study, Party, Rainy Day, Romantic, Focus, Relax). Each preset auto-expands into 3-4 internal Spotify queries.
* **AI Theme Expansion (optional, free):** Type natural-language ("rainy sunday morning coffee") and Google Gemini Flash converts it into 5-8 specific Spotify search queries. Uses the **free** Google AI Studio tier (`gemini-2.5-flash`, `thinkingBudget: 0` → ~1s latency, ~80 tokens per call).
* **Anti-Duplication:** Filters out tracks already saved in your Spotify library.
* **AI-Generated Track Filter:** Heuristic regex against AI music tool names (Suno, Udio, Boomy, etc.) in track / album / artist fields.

#### Customization
* **Track Count:** 20-200 (slider).
* **Mix Style:** 4 presets — Familiar-heavy (50/30/20), Balanced (30/40/30), Discovery-heavy (15/30/55), Deep Discovery (10/20/70).
* **Year Range Filter:** Min/max release year.
* **Duration Filter:** Min/max minutes.
* **Explicit Filter:** Hide explicit content.
* **Public/Private:** Default is private.

#### UX
* **Live Progress Streaming:** NDJSON-based real-time status (`5/20 playlists scanned, 250 tracks collected`) — no opaque spinner.
* **Review Before Commit:** See all selected tracks with album art, artist names, duration, and bucket label. Remove individual tracks with ✕ before adding to Spotify. Cancel and start over anytime.
* **Smart Artist Rotation:** Final list never has the same primary artist back-to-back (greedy round-robin).
* **Bilingual UI:** Turkish ↔ English toggle, persisted in localStorage.
* **One-Click Start:** `start.bat` (Windows) handles npm install, browser launch, and server startup.

### 🛡️ Production Safety
- `helmet` security headers
- Origin-whitelisted CORS (configurable via `ALLOWED_ORIGINS`)
- Per-endpoint rate limiting (preview 10/min, commit 20/min)
- Strict `zod` body validation on all endpoints
- App-level Gemini rate limit (10/min, well below free-tier 15 RPM)
- Model name **hardcoded** (`gemini-2.5-flash`) — drift to paid models physically impossible
- Graceful fallback: if Gemini fails (missing key, timeout, parse error), original theme is used and the user sees a stream message
- Pool deduplication, Fisher-Yates shuffle, artist diversity cap (max 3 tracks per artist)

> [!WARNING]
> The AI-generated-track filter is heuristic and may have false positives/negatives due to inconsistent platform metadata.

---

## 🇹🇷 Türkçe Versiyon

### 🌟 Özellikler

#### Keşif Motoru
* **Geniş Keşif (Playlist Pool):** `gece sürüşü`, `türkçe rap`, `phonk gym` gibi temalarla arama yapın. Her tema için 20'ye kadar eşleşen public playlist taranır, içlerinden şarkılar derlenir.
* **Multi-Tema Karıştırma:** Virgülle ayrılmış birden fazla tema yazın (`phonk gym, lofi study, retro synth`) — her tema ayrı aranır, sonuçlar karıştırılır.
* **9 Hazır Vibe Preset'i:** Tek tıkla seçilen temalar (Sabah Kahvesi, Gece Sürüşü, Antrenman, Çalışma, Parti, Yağmurlu Gün, Romantik, Odaklanma, Rahatlama). Her preset arkada 3-4 alt aramaya açılır.
* **AI Tema Genişletme (opsiyonel, ücretsiz):** Doğal dil yaz ("yağmurlu pazar sabahı kahve içerken") — Google Gemini Flash bunu 5-8 spesifik Spotify aramasına çevirir. **Ücretsiz** Google AI Studio tier'ı (`gemini-2.5-flash`, `thinkingBudget: 0` → ~1 sn, ~80 token/çağrı).
* **Anti-Duplication:** Kütüphanenizdeki kayıtlı şarkılar otomatik elenir.
* **AI Üretimi Filtresi:** AI müzik araçlarının (Suno, Udio, Boomy vb.) isimlerini şarkı / albüm / sanatçı alanlarında regex ile arar.

#### Özelleştirme
* **Şarkı Sayısı:** 20-200 (slider).
* **Karıştırma Tarzı:** 4 preset — Tanıdık Ağırlıklı (50/30/20), Dengeli (30/40/30), Keşif Ağırlıklı (15/30/55), Derin Keşif (10/20/70).
* **Yıl Aralığı:** Min/max çıkış yılı.
* **Süre Filtresi:** Min/max dakika.
* **Explicit Filtresi:** Açık içeriği gizle.
* **Public/Private:** Varsayılan: private.

#### Kullanıcı Deneyimi
* **Canlı Progress Akışı:** NDJSON ile arama ilerlemesi gerçek zamanlı (`5/20 playlist tarandı, 250 şarkı toplandı`) — sadece spinner değil.
* **Onay Öncesi Önizleme:** Tüm seçili şarkıları albüm kapağı, sanatçı, süre ve bucket etiketiyle gör. Beğenmediklerini ✕ ile çıkar, sonra "Onayla & Spotify'a Ekle". İstediğin zaman iptal et.
* **Akıllı Sanatçı Rotasyonu:** Final listede aynı sanatçı arka arkaya gelmez (greedy round-robin).
* **Çok Dilli UI:** Türkçe ↔ İngilizce, localStorage'da kalıcı.
* **Tek Tıkla Başlatma:** `start.bat` (Windows) — npm install + tarayıcı + sunucu hep birlikte.

### 🛡️ Güvenlik
- `helmet` güvenlik header'ları
- Origin whitelist'li CORS (`ALLOWED_ORIGINS` env değişkeni ile yapılandırılır)
- Endpoint başına rate limit (preview 10/dk, commit 20/dk)
- Tüm body'lerde `zod` validation
- App-side Gemini rate limit (10/dk, ücretsiz tier 15 RPM'in altında)
- Model adı **hardcoded** (`gemini-2.5-flash`) — ücretli modellere drift fiziksel olarak imkansız
- Graceful fallback: Gemini başarısız olursa orijinal temayla devam edilir, kullanıcı stream'de bilgi alır
- Havuz dedup, Fisher-Yates shuffle, sanatçı çeşitlilik limiti (sanatçı başına max 3 şarkı)

> [!CAUTION]
> AI-üretimi şarkı filtresi sezgiseldir, platform metadata tutarsızlığı nedeniyle %100 doğru olmayabilir.

---

## 🛠 Setup & Installation

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd spotify-bot
npm install
```

### 2. Spotify Credentials
1. Create a Spotify app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add `http://localhost:3000/callback` as a redirect URI in the app settings.
3. Copy `.env.example` to `.env` and fill in:
```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

### 3. Get Refresh Token
```bash
node get-token.js
# Visit the printed URL, authorize the app, paste back the "code" parameter:
node get-token.js "<paste-code-here>"
```
Copy the printed refresh token into `.env`'s `SPOTIFY_REFRESH_TOKEN`.

### 4. (Optional) Gemini API Key for AI Theme Expansion
Get a **free** key from [Google AI Studio](https://aistudio.google.com/app/apikey) and add to `.env`:
```
GEMINI_API_KEY=...
```

> [!IMPORTANT]
> **Keeping it free is conditional.** `gemini-2.5-flash` exists on both free and paid tiers — the same key serves both. Which tier your requests land on depends on the **billing status of the GCP project that owns the key**:
> - **GCP billing disabled** → requests above the free quota are rejected with HTTP 429. **No bill possible.** Recommended.
> - **GCP billing enabled** → overage silently spills into paid tier and accrues charges.
>
> Either create a fresh GCP project with billing disabled and get a new AI Studio key under it, OR set a `0 TRY / 0 USD` budget alert at [Cloud Console → Billing → Budgets](https://console.cloud.google.com/billing/budgets).

### 5. Start the App

**Windows (recommended):**
```
start.bat
```
Double-click or run from CLI. Auto-installs dependencies if missing, launches the browser at `http://localhost:3000`, and shows server logs in the same window. Ctrl+C to stop.

**Manual (any OS):**
```bash
npm start
# then open http://localhost:3000
```

## License
MIT
