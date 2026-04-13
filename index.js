require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

/**
 * SABİTLER (Constants)
 * Bu değerler çalma listesi dağılımını ve limitlerini kontrol eder.
 */
const CONFIG = {
    MAX_TOTAL_TRACKS: 100,
    DISTRIBUTION: {
        POPULAR: 30,    // Popülerlik 70-100
        MEDIUM: 40,     // Popülerlik 40-69
        DISCOVERY: 30   // Popülerlik 0-39
    },
    POPULARITY_THRESHOLDS: {
        HIGH: 70,
        LOW: 40
    },
    SEARCH_LIMIT: 1000, // Toplamda çekilmek istenen şarkı havuzu
    RETRY_DELAY: 2000, // Rate limit durumunda bekleme süresi (ms)
};

const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

/**
 * Hata Yönetimi ve Rate Limit Bekleme Fonksiyonu
 * Spotify API 429 hatası verdiğinde belirtilen süre kadar bekler.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function requestWithRetry(fn, ...args) {
    try {
        return await fn(...args);
    } catch (error) {
        if (error.statusCode === 429) {
            console.log(`Rate limit aşıldı. ${CONFIG.RETRY_DELAY}ms bekleniyor...`);
            await sleep(CONFIG.RETRY_DELAY);
            return requestWithRetry(fn, ...args);
        }
        throw error;
    }
}

/**
 * Yetkilendirme (Authentication)
 * Refresh token kullanarak yeni bir access token alır.
 */
async function authenticate() {
    try {
        const data = await spotify.refreshAccessToken();
        spotify.setAccessToken(data.body['access_token']);
        console.log('Spotify yetkilendirmesi başarıyla tamamlandı.');
    } catch (error) {
        console.error('Yetkilendirme hatası:', error);
        throw new Error('Spotify yetkilendirmesi başarısız oldu. Lütfen .env dosyasını kontrol edin.');
    }
}

/**
 * Şarkı Havuzu Çekme (Search API)
 * Belirtilen türde pagination kullanarak şarkıları toplar.
 */
async function fetchTracks(genre) {
    console.log(`${genre} türünde şarkılar aranıyor...`);
    let allTracks = [];
    let offset = 0;
    const limit = 50; // Her istekte maksimum 50 şarkı

    while (allTracks.length < CONFIG.SEARCH_LIMIT) {
        try {
            const response = await requestWithRetry(() => 
                spotify.searchTracks(`genre:${genre}`, { limit, offset })
            );
            
            const items = response.body.tracks.items;
            if (items.length === 0) break;

            allTracks = allTracks.concat(items);
            offset += limit;
        } catch (error) {
            console.error('Şarkı arama hatası:', error);
            break;
        }
    }

    console.log(`${allTracks.length} adet şarkı havuzuna eklendi.`);
    return allTracks;
}

/**
 * Kategorizasyon ve Filtreleme
 * Şarkıları popülerlik ve tarihe göre ayırır.
 */
function categorizeTracks(tracks) {
    const categories = {
        popular: [],
        medium: [],
        discovery: []
    };

    const currentYear = new Date().getFullYear();

    tracks.forEach(track => {
        const popularity = track.popularity;
        const releaseDate = track.album.release_date;
        const releaseYear = new Date(releaseDate).getFullYear();

        if (popularity >= CONFIG.POPULARITY_THRESHOLDS.HIGH) {
            categories.popular.push(track.uri);
        } else if (popularity >= CONFIG.POPULARITY_THRESHOLDS.LOW) {
            categories.medium.push(track.uri);
        } else {
            // Keşif kategorisinde son 1 yıl içinde çıkanlara öncelik veriyoruz
            const isNew = (currentYear - releaseYear) <= 1;
            categories.discovery.push({ uri: track.uri, isNew });
        }
    });

    // Keşif listesini tarihe göre sırala (yeni olanlar başa)
    categories.discovery.sort((a, b) => b.isNew - a.isNew);
    categories.discovery = categories.discovery.map(item => item.uri);

    return categories;
}

/**
 * Çalma Listesi Oluşturma ve Şarkıları Ekleme
 */
async function createAndPopulatePlaylist(genre, selectedUris) {
    try {
        // 1. Kullanıcı profilini al (Playlist oluşturmak için user id gerekir)
        const profile = await requestWithRetry(() => spotify.getMe());
        const userId = profile.body.id;

        // 2. Yeni çalma listesi oluştur
        const playlistName = `[${genre}] - Keşif Rotası`;
        const playlistResponse = await requestWithRetry(() => 
            spotify.createPlaylist(userId, { name: playlistName, public: true })
        );
        const playlistId = playlistResponse.body.id;
        console.log(`Çalma listesi oluşturuldu: ${playlistName} (ID: ${playlistId})`);

        // 3. Şarkıları ekle (Spotify API tek seferde max 100 şarkı kabul eder)
        await requestWithRetry(() => spotify.addTracksToPlaylist(playlistId, selectedUris));
        console.log(`${selectedUris.length} şarkı başarıyla listeye eklendi.`);

        return playlistId;
    } catch (error) {
        console.error('Çalma listesi oluşturma hatası:', error);
        throw error;
    }
}

/**
 * Ana Akış (Main Orchestrator)
 */
async function main(genre) {
    try {
        await authenticate();

        const trackPool = await fetchTracks(genre);
        const categories = categorizeTracks(trackPool);

        // Dinamik dağılım ile şarkıları seç
        const selectedUris = [
            ...shuffleArray(categories.popular).slice(0, CONFIG.DISTRIBUTION.POPULAR),
            ...shuffleArray(categories.medium).slice(0, CONFIG.DISTRIBUTION.MEDIUM),
            ...shuffleArray(categories.discovery).slice(0, CONFIG.DISTRIBUTION.DISCOVERY)
        ];

        if (selectedUris.length === 0) {
            console.log('Kriterlere uygun şarkı bulunamadı.');
            return;
        }

        await createAndPopulatePlaylist(genre, selectedUris);
        console.log('İşlem başarıyla tamamlandı! Spotify hesabınızı kontrol edin.');

    } catch (error) {
        console.error('Kritik hata:', error.message);
    }
}

// Yardımcı fonksiyon: Diziyi rastgele karıştırır
function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

// Programı başlat (Örnek: 'rock' türü için)
const targetGenre = process.argv[2] || 'rock';
main(targetGenre);
