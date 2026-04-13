require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sabitler
const CONFIG = {
    MAX_TOTAL_TRACKS: 100,
    DISTRIBUTION: {
        POPULAR: 30,    
        MEDIUM: 40,     
        DISCOVERY: 30   
    },
    POPULARITY_THRESHOLDS: {
        HIGH: 70,
        LOW: 40
    },
    SEARCH_LIMIT: 1000, 
    RETRY_DELAY: 2000, 
};

// Spotify API Client 
const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

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

async function authenticate() {
    try {
        // Refresh token objede yüklü olduğu için parametre gerekmez
        const data = await spotify.refreshAccessToken();
        spotify.setAccessToken(data.body['access_token']);
    } catch (error) {
        throw new Error('Spotify yetkilendirmesi başarısız oldu. Refresh token geçersiz olabilir (node get-token.js kullanın).');
    }
}

// Şarkıları kategorize et
const AI_REGEX = /\b(ai|a\.i\.|a\.i|suno|udio|sunoai|udioai|boomy|mubert|aiva|soundraw|ai cover|ai music|generative|sunocore|yapay zeka|yz|yapayzeka)\b/i;

function categorizeTracks(tracks) {
    const categories = {
        popular: [],
        medium: [],
        discovery: []
    };
    const currentYear = new Date().getFullYear();

    tracks.forEach(track => {
        // track doğrudan obje formatında geliyor
        const popularity = track.popularity || 0;
        const releaseDate = track.album?.release_date || new Date().toISOString(); 
        const releaseYear = new Date(releaseDate).getFullYear();

        if (popularity >= CONFIG.POPULARITY_THRESHOLDS.HIGH) {
            categories.popular.push(track.uri);
        } else if (popularity >= CONFIG.POPULARITY_THRESHOLDS.LOW) {
            categories.medium.push(track.uri);
        } else {
            const isNew = (currentYear - releaseYear) <= 1;
            categories.discovery.push({ uri: track.uri, isNew });
        }
    });

    // Keşif listesini sırala (yeni olanlar daha önde the boolean value sorts)
    categories.discovery.sort((a, b) => b.isNew - a.isNew);
    categories.discovery = categories.discovery.map(item => item.uri);

    return categories;
}

function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

// POST endpoint'i: Çalma listesi oluştur
app.post('/api/generate', async (req, res) => {
    try {
        const { searchMode, targetInput, avoidDuplicates, avoidAI, lang } = req.body;
        
        await authenticate();
        
        let allTracks = [];
        
        // 1. Şarkı Havuzunu Çekme (Arama Moduna Göre)
        if (searchMode === 'playlist_pool') {
            // GENİŞ KEŞİF (Oyun oynarken, türkçe rap vb. karmaşık cümleler için Playlist tarama)
            const resPlaylists = await requestWithRetry(() => spotify.searchPlaylists(targetInput, { limit: 20 }));
            if (resPlaylists.body.playlists.items && resPlaylists.body.playlists.items.length > 0) {
                for (let p of resPlaylists.body.playlists.items) {
                    if (!p) continue;
                    if (allTracks.length >= CONFIG.SEARCH_LIMIT) break;
                    try {
                        const tracksRes = await requestWithRetry(() => spotify.getPlaylistTracks(p.id, { limit: 50 }));
                        if (tracksRes.body.items) {
                            tracksRes.body.items.forEach(t => {
                                if (t.track && t.track.id && allTracks.length < CONFIG.SEARCH_LIMIT) {
                                    allTracks.push(t.track);
                                }
                            });
                        }
                    } catch (e) {
                        console.log(`Playlist çekilemedi: ${p.id}`);
                    }
                }
            }
        } else {
            // KLASİK ARAMA (Müzik türü veya sanatçı)
            let offset = 0;
            const limit = 50; 
            const prefix = searchMode === 'artist' ? 'artist' : 'genre';
            const searchQuery = `${prefix}:"${targetInput}"`;

            while (allTracks.length < CONFIG.SEARCH_LIMIT && offset <= 950) {
                const response = await requestWithRetry(() => 
                    spotify.searchTracks(searchQuery, { limit, offset })
                );
                const items = response.body.tracks.items;
                if (!items || items.length === 0) break;
                allTracks = allTracks.concat(items);
                offset += limit;
            }
        }

        // Ekstra Güvenlik Kontrolü
        if (!allTracks || allTracks.length === 0) {
            return res.status(404).json({ error: 'Aradığınız kriterlerde şarkı bulunamadı.' });
        }

        // 1.5 Tahmini Yapay Zeka (AI) Filtresi
        if (avoidAI) {
            allTracks = allTracks.filter(t => {
                // Şarkı adı, sanatçı isimleri veya albüm adında AI araçlarının adı (Regex ile tam kelime eşleşmesi)
                const checkString = (t.name + " " + t.artists.map(a => a.name).join(" ") + " " + (t.album?.name || ""));
                const isAi = AI_REGEX.test(checkString);
                return !isAi;
            });
        }

        // 2. Dinlediklerimi Geç (Anti-Duplication) Filtresi
        if (avoidDuplicates) {
            const trackIds = allTracks.map(t => t.id).filter(id => id); // Yalnızca id içerenleri alıyoruz
            const duplicatesToRemove = new Set();
            
            // containsMySavedTracks endpointi tek çağrıda max 50 id kabul eder. Chunking yapalım.
            for (let i = 0; i < trackIds.length; i += 50) {
                const chunk = trackIds.slice(i, i + 50);
                const containsRes = await requestWithRetry(() => spotify.containsMySavedTracks(chunk));
                const containsArray = containsRes.body; // [true, false, true, ...] formatında dizi
                
                chunk.forEach((id, index) => {
                    if (containsArray[index]) {
                        duplicatesToRemove.add(id);
                    }
                });
            }
            
            // Array'den dublike olanları temizle
            allTracks = allTracks.filter(t => !duplicatesToRemove.has(t.id));
        }

        // 3. Kategorizasyon ve Dağılım
        const categories = categorizeTracks(allTracks);
        const selectedUris = [
            ...shuffleArray(categories.popular).slice(0, CONFIG.DISTRIBUTION.POPULAR),
            ...shuffleArray(categories.medium).slice(0, CONFIG.DISTRIBUTION.MEDIUM),
            ...shuffleArray(categories.discovery).slice(0, CONFIG.DISTRIBUTION.DISCOVERY)
        ];

        if (selectedUris.length === 0) {
            return res.status(404).json({ error: 'Kriterlere uygun (veya hepsi dinlenilmiş olduğu için) şarkı bulunamadı. Havuz boşaldı.' });
        }

        // 4. Çalma Listesi Oluşturma
        const profile = await requestWithRetry(() => spotify.getMe());
        const userId = profile.body.id;
        
        const suffix = lang === 'en' ? 'Discovery Route' : 'Keşif Rotası';
        let playlistName = `[${targetInput}] - ${suffix}`;
        
        const playlistResponse = await requestWithRetry(() => 
            spotify.createPlaylist(userId, { name: playlistName, public: true })
        );
        const playlistId = playlistResponse.body.id;
        
        // Spotify addTracksToPlaylist istekte limit olarak 100 kabul eder (chunking)
        for (let i = 0; i < selectedUris.length; i+=100) {
           await requestWithRetry(() => spotify.addTracksToPlaylist(playlistId, selectedUris.slice(i, i+100)));
        }

        const externalUrl = playlistResponse.body.external_urls.spotify;
        
        res.json({ success: true, url: externalUrl, count: selectedUris.length, name: playlistName });
    } catch (error) {
        console.error('API Hatası:', error);
        const errorMsg = error.body && error.body.error && error.body.error.message ? error.body.error.message : (typeof error.message === 'string' ? error.message : 'Spotify Hatası: Girdiğiniz müzik türü geçersiz veya sunucu hatası.');
        res.status(500).json({ error: errorMsg });
    }
});

// Sunucu başlat
app.listen(port, () => {
    console.log(`\n==========================================`);
    console.log(`Spotify Web Bot Sunucusu Başladı!`);
    console.log(`Tarıyıcınızdan gidin: http://localhost:${port}`);
    console.log(`==========================================\n`);
});
