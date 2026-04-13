# Spotify Smart Discovery Route 🎧

[**English**](#🌏-english-version) | [**Türkçe**](#🇹🇷-türkçe-versiyon)

---

## 🌏 English Version

**Spotify Smart Discovery Route** is a powerful playlist generation tool designed to revolutionize how you discover music. Moving beyond generic algorithms, it focuses on delivering truly fresh tracks to your ears by harvesting data from thousands of user-curated playlists.

### 🌟 Key Features
*   **Deep Discovery (Playlist Pool):** Search for abstract themes like "night drive", "lo-fi study", or "phonk gym" to pull the best hidden tracks from the entire Spotify ecosystem.
*   **Anti-Duplication:** Automatically filters out tracks already saved in your library, ensuring every result is a brand-new experience.
*   **Smart Distribution:** Balanced playlist structure using a 30-40-30 ratio (Popular, Medium, and Hidden Gems).
*   **Multilingual UI:** Seamless toggle between Turkish and English interfaces.
*   **AI Filtering:** Uses precise keyword boundary detection to screen out generative content. 

> [!WARNING]
> **Footnote on AI Filtering:** This content filter is an experimental feature and may not provide 100% accurate results due to the nature and inconsistency of platform metadata.

---

## 🇹🇷 Türkçe Versiyon

**Spotify Akıllı Keşif Rotası**, müzik dinleme deneyimini kişiselleştiren güçlü bir çalma listesi oluşturma aracıdır. Standart algoritmaların dışına çıkarak, kullanıcılara gerçekten yeni ve keşfedilmemiş şarkılar sunmayı hedefler.

### 🌟 Öne Çıkan Özellikler
*   **Geniş Keşif (Playlist Pool):** Sadece tür adı değil; "gece sürüşü" veya "türkçe rap" gibi serbest temalarla tüm Spotify ekosisteminden en iyi parçaları derler.
*   **Anti-Duplication:** Kitaplığınızdaki kayıtlı şarkıları otomatik olarak eler, böylece karşınıza sadece daha önce duymadığınız parçalar çıkar.
*   **Dinamik Dağılım:** Listeyi popüler, orta segment ve tamamen keşif odaklı (Discovery) olarak 30-40-30 oranında dengeler.
*   **Çok Dilli Arayüz:** Tek tıkla Türkçe ve İngilizce arasında geçiş imkanı.
*   **AI Filtreleme:** Yapay zeka ile üretilmiş içerikleri gelişmiş kelime bazlı filtrelerle ayıklamaya çalışır.

> [!CAUTION]
> **AI Filtreleme Hakkında:** Bu özellik meta verilerin değişkenliği nedeniyle %100 sağlıklı çalışmayabilir ve her zaman kesin sonuç vermeyebilir.

---

## 🛠 Setup & Installation (English)

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd spotify-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file based on `.env.example` and fill in your Spotify Developer credentials.

4. **Get Refresh Token:**
   ```bash
   node get-token.js
   ```

5. **Start the application:**
   ```bash
   node server.js
   ```

## License
MIT
