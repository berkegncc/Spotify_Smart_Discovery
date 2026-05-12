require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${port}`)
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} CORS politikası tarafından engellendi.`));
    }
}));

// Commit body 200 URI içerebilir; tahmini ~12 KB. Üst sınır olarak 64 KB güvenli.
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Preview pahalı (çok sayıda Spotify çağrısı). Commit görece ucuz ama playlist yaratıyor.
const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla önizleme isteği. Lütfen 1 dakika bekleyin.' }
});
const commitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla onaylama isteği. Lütfen 1 dakika bekleyin.' }
});

const CONFIG = {
    DEFAULT_TOTAL_TRACKS: 100,
    DISTRIBUTION_PRESETS: {
        familiar:       { popular: 0.50, medium: 0.30, discovery: 0.20 },
        balanced:       { popular: 0.30, medium: 0.40, discovery: 0.30 },
        discovery:      { popular: 0.15, medium: 0.30, discovery: 0.55 },
        deep_discovery: { popular: 0.10, medium: 0.20, discovery: 0.70 }
    },
    POPULARITY_THRESHOLDS: { HIGH: 70, LOW: 40 },
    SEARCH_LIMIT: 1000,
    RETRY_DELAY: 2000,
    MAX_PER_ARTIST: 3,
    MAX_THEMES: 5
};

// Önceden hazırlanmış "vibe" temaları. Her preset birden fazla Spotify search query'sine çözülür.
// İngilizce ağırlıklı çünkü Spotify'da en zengin sonuç global Eng. playlist isimlerinden gelir.
const VIBE_PRESETS = {
    morning_coffee: ['acoustic morning', 'coffee jazz', 'soft piano breakfast', 'sunday morning chill'],
    night_drive:   ['night drive', 'synthwave drive', 'midnight cruise', 'cyberpunk drive'],
    workout:       ['gym hype', 'workout pump', 'power training', 'cardio energy'],
    study:         ['lofi study', 'deep focus', 'concentration ambient', 'study session'],
    party:         ['party hits', 'dance floor anthems', 'club bangers', 'edm party'],
    rainy_day:     ['rainy day mellow', 'stormy chill', 'rainy lofi', 'cozy rainy'],
    romantic:      ['romantic ballads', 'love songs slow', 'candlelit dinner jazz', 'romantic acoustic'],
    focus:         ['deep focus instrumental', 'minimal work music', 'ambient productivity'],
    relax:         ['relax chill', 'evening unwind', 'spa ambient', 'wind down']
};
const VIBE_PRESET_KEYS = Object.keys(VIBE_PRESETS);

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
        const data = await spotify.refreshAccessToken();
        spotify.setAccessToken(data.body['access_token']);
    } catch (error) {
        throw new Error('Spotify yetkilendirmesi başarısız oldu. Refresh token geçersiz olabilir (node get-token.js kullanın).');
    }
}

const AI_REGEX = /\b(ai|a\.i\.|a\.i|suno|udio|sunoai|udioai|boomy|mubert|aiva|soundraw|ai cover|ai music|generative|sunocore|yapay zeka|yz|yapayzeka)\b/i;

function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function categorizeTracks(tracks) {
    const categories = { popular: [], medium: [], discovery: [] };
    const currentYear = new Date().getFullYear();

    tracks.forEach(track => {
        const popularity = track.popularity ?? 0;
        const releaseDate = track.album?.release_date || new Date().toISOString();
        const releaseYear = new Date(releaseDate).getFullYear();

        if (popularity >= CONFIG.POPULARITY_THRESHOLDS.HIGH) {
            categories.popular.push(track);
        } else if (popularity >= CONFIG.POPULARITY_THRESHOLDS.LOW) {
            categories.medium.push(track);
        } else {
            categories.discovery.push({ ...track, _isNew: (currentYear - releaseYear) <= 1 });
        }
    });

    categories.discovery.sort((a, b) => (b._isNew === true) - (a._isNew === true));
    return categories;
}

function pickWithArtistDiversity(tracks, max) {
    const result = [];
    const artistCount = new Map();
    for (const track of tracks) {
        if (result.length >= max) break;
        const primaryArtist = track.artists?.[0]?.id;
        if (!primaryArtist) continue;
        const count = artistCount.get(primaryArtist) || 0;
        if (count < CONFIG.MAX_PER_ARTIST) {
            result.push(track);
            artistCount.set(primaryArtist, count + 1);
        }
    }
    return result;
}

// Final listede aynı sanatçı arka arkaya gelmeyecek şekilde sıralar.
// Greedy: her adımda son seçilen sanatçıdan farklı ilk şarkıyı al; mümkün değilse (kalan hepsi aynı sanatçı) sıradaki şarkıyı al.
function rotateArtists(tracks) {
    const result = [];
    const remaining = [...tracks];
    let lastArtistId = null;
    while (remaining.length > 0) {
        let idx = remaining.findIndex(t => (t.artists?.[0]?.id) !== lastArtistId);
        if (idx === -1) idx = 0;
        const picked = remaining.splice(idx, 1)[0];
        result.push(picked);
        lastArtistId = picked.artists?.[0]?.id ?? null;
    }
    return result;
}

// === Gemini (Google AI) — kullanıcının yazdığı doğal dil temasını
// Spotify-friendly arama sorgu listesine açar. ÜCRETSİZ tier'da çalışmak üzere ayarlandı:
// 1) Model adı HARDCODED — Veo / Imagen / Lyria gibi paid-only modellere drift fiziksel olarak imkansız.
// 2) App-level rate limit free tier limiti olan 15 RPM'in altında (10 RPM).
// 3) Hata / timeout durumunda null döner ve preview akışı kullanıcının orijinal temasına graceful fallback yapar.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 10000;
const GEMINI_MAX_THEMES = 8;
const GEMINI_MAX_THEME_LEN = 50;
const GEMINI_RATE_WINDOW_MS = 60000;
const GEMINI_RATE_MAX = 10;

let geminiClient = null;
function getGeminiClient() {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!geminiClient) {
        geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return geminiClient;
}

const geminiCallTimestamps = [];
function checkGeminiAppRateLimit() {
    const now = Date.now();
    while (geminiCallTimestamps.length > 0 && now - geminiCallTimestamps[0] > GEMINI_RATE_WINDOW_MS) {
        geminiCallTimestamps.shift();
    }
    if (geminiCallTimestamps.length >= GEMINI_RATE_MAX) return false;
    geminiCallTimestamps.push(now);
    return true;
}

async function expandThemeWithGemini(userTheme) {
    const ai = getGeminiClient();
    if (!ai) return null;
    if (!checkGeminiAppRateLimit()) {
        console.warn('Gemini app-side rate limit (10/dk) aşıldı; expansion atlanıyor.');
        return null;
    }

    try {
        const model = ai.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: "You convert a user's mood/scene description into 5-8 short Spotify search queries that would surface public playlists matching that vibe. Each query: 1-4 English words (Spotify's public playlist database is English-dominant). Output ONLY a JSON array of strings.",
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: { type: 'array', items: { type: 'string' } },
                maxOutputTokens: 200,
                temperature: 0.7,
                // gemini-2.5-flash bir thinking model — default'ta reasoning için ekstra token harcar.
                // Bu basit görev (mood → query list) reasoning gerektirmez. Kapatınca latency ~%35,
                // toplam token ~%73 düşüyor; kalite aynı kalıyor (test edildi).
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        // SDK'nın native AbortSignal desteği versiyona göre değişebildiği için Promise.race ile timeout.
        const result = await Promise.race([
            model.generateContent(`User input: ${userTheme}`),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS))
        ]);

        const text = result.response.text();
        const themes = JSON.parse(text);
        if (!Array.isArray(themes)) return null;

        const validated = themes
            .filter(t => typeof t === 'string')
            .map(t => t.trim())
            .filter(t => t.length > 0 && t.length <= GEMINI_MAX_THEME_LEN)
            .slice(0, GEMINI_MAX_THEMES);

        return validated.length > 0 ? validated : null;
    } catch (err) {
        console.error('Gemini expansion failed:', err.message);
        return null;
    }
}

// === Pollinations.ai — ÜCRETSİZ playlist cover generator ===
// API key gerekmez, signup yok. Hata olursa graceful skip — playlist Spotify default kapağıyla kalır.
const COVER_TIMEOUT_MS = 30000;
const COVER_MAX_BYTES = 256 * 1024; // Spotify uploadCustomPlaylistCoverImage hard limit

async function generatePlaylistCover(playlistId, themeText) {
    try {
        const prompt = `minimalist square album cover art, abstract vibrant colors, theme: ${themeText}, no text, professional, dark mood`;
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
        const imgRes = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: COVER_TIMEOUT_MS,
            validateStatus: s => s >= 200 && s < 300
        });
        const buffer = Buffer.from(imgRes.data);
        if (buffer.length > COVER_MAX_BYTES) {
            console.warn(`Cover image too large (${buffer.length} bytes); skipping upload.`);
            return false;
        }
        const base64 = buffer.toString('base64');
        await requestWithRetry(() => spotify.uploadCustomPlaylistCoverImage(playlistId, base64));
        return true;
    } catch (err) {
        console.error('Cover generation failed:', err.message);
        return false;
    }
}

// Frontend'in ihtiyacı olan minimum bilgiyi içeren hafif bir DTO döndürür.
function simplifyTrack(track, bucket) {
    const images = track.album?.images || [];
    // En küçük image: kart görseli için yeterli ve cache-dostu.
    const albumImage = images.length ? images[images.length - 1].url : null;
    return {
        uri: track.uri,
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: track.album?.name || '',
        albumImage,
        duration_ms: track.duration_ms,
        popularity: track.popularity ?? 0,
        explicit: !!track.explicit,
        releaseDate: track.album?.release_date || null,
        bucket
    };
}

const previewSchema = z.object({
    searchMode: z.enum(['playlist_pool', 'genre', 'artist']),
    targetInput: z.string().trim().min(1, 'Arama girdisi boş olamaz').max(100, 'Arama girdisi en fazla 100 karakter olabilir'),
    avoidDuplicates: z.boolean().optional().default(false),
    avoidAI: z.boolean().optional().default(false),
    lang: z.enum(['tr', 'en']).optional().default('tr'),
    totalTracks: z.number().int().min(20).max(200).optional().default(100),
    distributionStyle: z.enum(['familiar', 'balanced', 'discovery', 'deep_discovery']).optional().default('balanced'),
    yearFrom: z.number().int().min(1900).max(2100).optional(),
    yearTo: z.number().int().min(1900).max(2100).optional(),
    minDurationSec: z.number().int().min(0).max(3600).optional(),
    maxDurationSec: z.number().int().min(0).max(3600).optional(),
    excludeExplicit: z.boolean().optional().default(false),
    vibePreset: z.enum(VIBE_PRESET_KEYS).optional(),
    useAiExpansion: z.boolean().optional().default(false),
    acousticOnly: z.boolean().optional().default(false),
    instrumentalOnly: z.boolean().optional().default(false),
    excludeRemix: z.boolean().optional().default(false),
    excludeLive: z.boolean().optional().default(false),
    excludeCover: z.boolean().optional().default(false)
}).refine(
    data => data.yearFrom == null || data.yearTo == null || data.yearFrom <= data.yearTo,
    { message: 'Başlangıç yılı bitiş yılından büyük olamaz', path: ['yearFrom'] }
).refine(
    data => data.minDurationSec == null || data.maxDurationSec == null || data.minDurationSec <= data.maxDurationSec,
    { message: 'Minimum süre maksimum süreden büyük olamaz', path: ['minDurationSec'] }
);

const commitSchema = z.object({
    uris: z.array(
        z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/, 'Geçersiz Spotify track URI')
    ).min(1, 'En az 1 şarkı gerekli').max(200, 'En fazla 200 şarkı gönderilebilir'),
    targetInput: z.string().trim().min(1).max(100),
    lang: z.enum(['tr', 'en']).optional().default('tr'),
    publicPlaylist: z.boolean().optional().default(false),
    generateCover: z.boolean().optional().default(false)
});

app.post('/api/preview', previewLimiter, async (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues.map(i => i.message).join(', ')
        });
    }
    const data = parsed.data;

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const send = (obj) => {
        if (res.writableEnded) return;
        res.write(JSON.stringify(obj) + '\n');
    };

    let aborted = false;
    req.on('close', () => { aborted = true; });

    try {
        send({ type: 'progress', step: 'auth', message: 'Spotify ile yetkilendiriliyor...' });
        await authenticate();
        if (aborted) return res.end();

        // Tema çözümlemesi (öncelik: vibePreset > AI expansion > virgülle ayrılmış multi-tema).
        // Preset ve AI expansion her zaman playlist_pool ile çalışır (zengin sonuç oradan gelir).
        let themes;
        let effectiveSearchMode = data.searchMode;
        if (data.vibePreset && VIBE_PRESETS[data.vibePreset]) {
            themes = VIBE_PRESETS[data.vibePreset];
            effectiveSearchMode = 'playlist_pool';
            send({ type: 'progress', step: 'searching', message: `"${data.vibePreset}" preseti: ${themes.length} alt tema kullanılacak.` });
        } else if (data.useAiExpansion) {
            send({ type: 'progress', step: 'expanding', message: 'AI ile tema genişletiliyor (Gemini Flash)...' });
            const expanded = await expandThemeWithGemini(data.targetInput);
            if (expanded && expanded.length > 0) {
                themes = expanded;
                effectiveSearchMode = 'playlist_pool';
                send({ type: 'progress', step: 'expanding', message: `AI ${expanded.length} alt tema önerdi: ${expanded.join(', ')}` });
            } else {
                // Graceful fallback — Gemini başarısız oldu, kullanıcının orijinal teması ile devam et.
                themes = data.targetInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, CONFIG.MAX_THEMES);
                if (themes.length === 0) {
                    send({ type: 'error', message: 'Geçerli bir tema gir.' });
                    return res.end();
                }
                send({ type: 'progress', step: 'expanding', message: 'AI genişletme başarısız oldu, orijinal tema(lar) ile devam ediliyor.' });
            }
        } else {
            themes = data.targetInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, CONFIG.MAX_THEMES);
            if (themes.length === 0) {
                send({ type: 'error', message: 'Geçerli bir tema gir.' });
                return res.end();
            }
            if (themes.length > 1) {
                send({ type: 'progress', step: 'searching', message: `${themes.length} tema bulundu: ${themes.join(', ')}` });
            }
        }

        const perThemeBudget = Math.ceil(CONFIG.SEARCH_LIMIT / themes.length);
        let allTracks = [];

        for (const theme of themes) {
            if (aborted) return res.end();
            send({ type: 'progress', step: 'searching', message: `"${theme}" temasında aranıyor...` });
            const beforeCount = allTracks.length;

            if (effectiveSearchMode === 'playlist_pool') {
                const resPlaylists = await requestWithRetry(() => spotify.searchPlaylists(theme, { limit: 20 }));
                const playlists = (resPlaylists.body.playlists.items || []).filter(Boolean);
                let perThemeTracks = 0;
                for (const p of playlists) {
                    if (aborted) return res.end();
                    if (perThemeTracks >= perThemeBudget) break;
                    try {
                        const tracksRes = await requestWithRetry(() => spotify.getPlaylistTracks(p.id, { limit: 50 }));
                        if (tracksRes.body.items) {
                            for (const item of tracksRes.body.items) {
                                if (item.track && item.track.id && perThemeTracks < perThemeBudget) {
                                    allTracks.push(item.track);
                                    perThemeTracks++;
                                }
                            }
                        }
                    } catch (e) {
                        // tek playlist hatası akışı kesmez
                    }
                }
            } else {
                let offset = 0;
                const limit = 50;
                const prefix = effectiveSearchMode === 'artist' ? 'artist' : 'genre';
                const searchQuery = `${prefix}:"${theme}"`;
                let perThemeTracks = 0;
                while (perThemeTracks < perThemeBudget && offset <= 950) {
                    if (aborted) return res.end();
                    const response = await requestWithRetry(() => spotify.searchTracks(searchQuery, { limit, offset }));
                    const items = response.body.tracks.items;
                    if (!items || items.length === 0) break;
                    const remaining = perThemeBudget - perThemeTracks;
                    const slice = items.slice(0, remaining);
                    allTracks.push(...slice);
                    perThemeTracks += slice.length;
                    offset += limit;
                }
            }

            const themeAdded = allTracks.length - beforeCount;
            send({
                type: 'progress',
                step: 'searching',
                message: `"${theme}": ${themeAdded} şarkı eklendi. Toplam: ${allTracks.length}.`,
                foundCount: allTracks.length
            });
        }

        if (aborted) return res.end();

        if (allTracks.length === 0) {
            send({ type: 'error', message: 'Aradığınız kriterlerde şarkı bulunamadı.' });
            return res.end();
        }

        send({ type: 'progress', step: 'deduplicating', message: 'Tekrarlanan şarkılar temizleniyor...' });
        const seen = new Set();
        allTracks = allTracks.filter(t => {
            if (!t.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
        send({ type: 'progress', step: 'deduplicating', message: `Tekilleştirme sonrası ${allTracks.length} şarkı kaldı.`, foundCount: allTracks.length });

        const hasYearFilter = data.yearFrom != null || data.yearTo != null;
        const hasDurationFilter = data.minDurationSec != null || data.maxDurationSec != null;
        if (hasYearFilter || hasDurationFilter || data.excludeExplicit) {
            send({ type: 'progress', step: 'filtering', message: 'Yıl / süre / explicit filtreleri uygulanıyor...' });
            allTracks = allTracks.filter(t => {
                if (data.excludeExplicit && t.explicit) return false;
                if (hasYearFilter) {
                    const releaseDate = t.album?.release_date;
                    if (!releaseDate) return false;
                    const releaseYear = new Date(releaseDate).getFullYear();
                    if (data.yearFrom != null && releaseYear < data.yearFrom) return false;
                    if (data.yearTo != null && releaseYear > data.yearTo) return false;
                }
                if (hasDurationFilter) {
                    if (t.duration_ms == null) return false;
                    const durSec = t.duration_ms / 1000;
                    if (data.minDurationSec != null && durSec < data.minDurationSec) return false;
                    if (data.maxDurationSec != null && durSec > data.maxDurationSec) return false;
                }
                return true;
            });
            send({ type: 'progress', step: 'filtering', message: `Filtre sonrası ${allTracks.length} şarkı kaldı.`, foundCount: allTracks.length });
        }

        // Stil/varyant filtreleri — track / album adında keyword regex.
        if (data.acousticOnly || data.instrumentalOnly || data.excludeRemix || data.excludeLive || data.excludeCover) {
            const STYLE_REGEX = {
                remix:        /\b(remix|remixed|reedit|re-?edit)\b/i,
                live:         /\b(live|live\s+at|live\s+in|live\s+from|live\s+recording|live\s+session|unplugged)\b/i,
                cover:        /\b(cover|covered\s+by|tribute)\b/i,
                acoustic:     /\bacoustic\b/i,
                instrumental: /\b(instrumental|karaoke)\b/i
            };
            const beforeStyle = allTracks.length;
            allTracks = allTracks.filter(t => {
                const text = (t.name || '') + ' ' + (t.album?.name || '');
                if (data.excludeRemix && STYLE_REGEX.remix.test(text)) return false;
                if (data.excludeLive && STYLE_REGEX.live.test(text)) return false;
                if (data.excludeCover && STYLE_REGEX.cover.test(text)) return false;
                if (data.acousticOnly && !STYLE_REGEX.acoustic.test(text)) return false;
                if (data.instrumentalOnly && !STYLE_REGEX.instrumental.test(text)) return false;
                return true;
            });
            send({
                type: 'progress',
                step: 'filtering',
                message: `Stil filtreleri: ${beforeStyle - allTracks.length} şarkı çıkarıldı.`,
                foundCount: allTracks.length
            });
        }

        if (data.avoidAI) {
            send({ type: 'progress', step: 'filtering', message: 'AI üretimleri filtreleniyor...' });
            const before = allTracks.length;
            allTracks = allTracks.filter(t => {
                const checkString = (t.name + ' ' + t.artists.map(a => a.name).join(' ') + ' ' + (t.album?.name || ''));
                return !AI_REGEX.test(checkString);
            });
            send({ type: 'progress', step: 'filtering', message: `${before - allTracks.length} AI şüpheli şarkı çıkarıldı.`, foundCount: allTracks.length });
        }

        if (data.avoidDuplicates) {
            send({ type: 'progress', step: 'filtering', message: 'Kütüphanedeki şarkılar tespit ediliyor...' });
            const trackIds = allTracks.map(t => t.id).filter(Boolean);
            const duplicatesToRemove = new Set();
            for (let i = 0; i < trackIds.length; i += 50) {
                if (aborted) return res.end();
                const chunk = trackIds.slice(i, i + 50);
                const containsRes = await requestWithRetry(() => spotify.containsMySavedTracks(chunk));
                const containsArray = containsRes.body;
                chunk.forEach((id, index) => {
                    if (containsArray[index]) duplicatesToRemove.add(id);
                });
            }
            allTracks = allTracks.filter(t => !duplicatesToRemove.has(t.id));
            send({ type: 'progress', step: 'filtering', message: `${duplicatesToRemove.size} kayıtlı şarkı çıkarıldı.`, foundCount: allTracks.length });
        }

        if (aborted) return res.end();

        send({ type: 'progress', step: 'selecting', message: 'Dengeli liste oluşturuluyor...' });
        const preset = CONFIG.DISTRIBUTION_PRESETS[data.distributionStyle];
        const targetPopular = Math.round(data.totalTracks * preset.popular);
        const targetMedium = Math.round(data.totalTracks * preset.medium);
        const targetDiscovery = data.totalTracks - targetPopular - targetMedium;

        const categories = categorizeTracks(allTracks);
        const popularPicked = pickWithArtistDiversity(shuffleArray(categories.popular), targetPopular);
        const mediumPicked = pickWithArtistDiversity(shuffleArray(categories.medium), targetMedium);
        const discoveryPicked = pickWithArtistDiversity(categories.discovery, targetDiscovery);

        // Tüm bucket'ları birleştir, sonra sanatçı rotation uygula (ardışık aynı sanatçı önlenir).
        // bucket etiketi simplifyTrack'e geçirilebilmesi için track objesinde geçici olarak saklanır.
        const tagged = [
            ...popularPicked.map(t => ({ ...t, _bucket: 'popular' })),
            ...mediumPicked.map(t => ({ ...t, _bucket: 'medium' })),
            ...discoveryPicked.map(t => ({ ...t, _bucket: 'discovery' }))
        ];
        const rotated = rotateArtists(tagged);
        const selectedTracks = rotated.map(t => simplifyTrack(t, t._bucket));

        if (selectedTracks.length === 0) {
            send({ type: 'error', message: 'Kriterlere uygun şarkı kalmadı. Filtreleri gevşetmeyi deneyin.' });
            return res.end();
        }

        send({ type: 'complete', tracks: selectedTracks, count: selectedTracks.length });
        res.end();
    } catch (error) {
        console.error('Preview hatası:', error);
        const errorMsg = error.body?.error?.message || error.message || 'Bilinmeyen hata.';
        send({ type: 'error', message: errorMsg });
        res.end();
    }
});

app.post('/api/commit', commitLimiter, async (req, res) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues.map(i => i.message).join(', ')
        });
    }
    const { uris, targetInput, lang, publicPlaylist, generateCover } = parsed.data;

    try {
        await authenticate();
        const profile = await requestWithRetry(() => spotify.getMe());
        const userId = profile.body.id;

        const suffix = lang === 'en' ? 'Discovery Route' : 'Keşif Rotası';
        const playlistName = `[${targetInput}] - ${suffix}`;

        const playlistResponse = await requestWithRetry(() =>
            spotify.createPlaylist(userId, { name: playlistName, public: publicPlaylist })
        );
        const playlistId = playlistResponse.body.id;

        for (let i = 0; i < uris.length; i += 100) {
            await requestWithRetry(() => spotify.addTracksToPlaylist(playlistId, uris.slice(i, i + 100)));
        }

        // Opsiyonel AI kapak — başarısız olursa playlist Spotify default'u ile kalır.
        let coverGenerated = false;
        if (generateCover) {
            coverGenerated = await generatePlaylistCover(playlistId, targetInput);
        }

        res.json({
            success: true,
            url: playlistResponse.body.external_urls.spotify,
            count: uris.length,
            name: playlistName,
            coverGenerated
        });
    } catch (error) {
        console.error('Commit hatası:', error);
        const errorMsg = error.body?.error?.message || error.message || 'Bilinmeyen hata.';
        res.status(500).json({ error: errorMsg });
    }
});

app.listen(port, () => {
    console.log(`\n==========================================`);
    console.log(`Spotify Web Bot Sunucusu Başladı!`);
    console.log(`Tarıyıcınızdan gidin: http://localhost:${port}`);
    console.log(`==========================================\n`);
});
