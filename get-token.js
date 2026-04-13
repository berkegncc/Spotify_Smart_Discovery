require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const args = process.argv.slice(2);

if (args.length === 0) {
    // 1. Yetki URL'si oluştur
    const scopes = [
        'playlist-modify-public', 
        'playlist-modify-private', 
        'user-read-private', 
        'user-read-email'
    ];
    
    // Auth URL'i oluşturuyoruz
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'some-state-of-my-choice');

    console.log('\n=== SPOTIFY YETKİLENDİRME ADIMLARI ===\n');
    console.log('1. Lütfen aşağıdaki linke gidin ve uygulamaya yetki verin:');
    console.log('\n' + authorizeURL + '\n');
    console.log('2. Yetki verdikten sonra tarayıcınız sizi başka bir adrese yönlendirecek (Spotify Redirect URI).');
    console.log('   O adresin çubuğunda yazan URL değişecek ve içinde "code=" yazan uzun bir metin olacak.');
    console.log('   Örnek: http://localhost:8888/callback?code=AQD...Xyz');
    console.log('\n3. O adresteki "code=" ifadesinden sonraki uzun kısmı kopyalayın.');
    console.log('\n4. Ardından terminalde şu komutu çalıştırarak Refresh Token alın:');
    console.log('   node get-token.js "KOPYALADIGINIZ_KOD"\n');
    
} else {
    // 2. Kodu kullanarak refresh token al
    const code = args[0];
    
    spotifyApi.authorizationCodeGrant(code).then(
      function(data) {
        console.log('\n=== BAŞARILI! YENİ TOKEN ALINDI ===\n');
        console.log('Lütfen .env dosyanızdaki SPOTIFY_REFRESH_TOKEN değerini tamamen silip şununla değiştirin:\n');
        console.log(data.body['refresh_token']);
        console.log('\nİşlemi tamamladıktan sonra, botu "node index.js" komutu ile tekrar çalıştırabilirsiniz.\n');
      },
      function(err) {
        console.log('\nHata oluştu:', err.message);
        console.log('Not: Farklı bir kod girmiş olabilirsiniz veya kopyaladığınız kodun süresi dolmuş olabilir (Kodlar tek kullanımlıktır).');
        console.log('Lütfen komutu sadece "node get-token.js" olarak tekrar çalıştırıp en baştan yeni bir kod alın.');
      }
    );
}
