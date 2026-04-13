# Spotify Akıllı Keşif Rotası (Web App)

Spotify API kullanarak kelimelere, türlere veya sanatçılara göre gelişmiş çalma listesi oluşturan bir web uygulaması.

## Özellikler
- **Geniş Keşif (Playlist Pool):** "Araba sürerken", "türkçe rap" gibi serbest cümlelerle keşif yapma.
- **Anti-Duplication:** Kitaplığınızda zaten olan şarkıları otomatik eler.
- **Yapay Zeka (AI) Filtresi:** AI tarafından üretilmiş şarkıları gelişmiş Regex ile temizler.
- **Modern Arayüz:** Spotify temalı karanlık mod (Tailwind CSS).

## Kurulum

1. Bu depoyu klonlayın:
   ```bash
   git clone <repo-url>
   cd spotify-bot
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun:
   `.env.example` dosyasının bir kopyasını `.env` olarak oluşturun ve Spotify Developer Dashboard'dan aldığınız bilgileri girin.

4. Spotify Refresh Token alın:
   ```bash
   node get-token.js
   ```
   (Talimatları takip ederek terminale tokenı yapıştırın.)

5. Uygulamayı başlatın:
   ```bash
   node server.js
   ```
   Tarayıcınızdan `http://localhost:3000` adresine gidin.

## Lisans
MIT
