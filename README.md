# Movie Matcher V2 - "Tinder voor Films" 🎬

Een web applicatie waarmee een groep gebruikers (bijv. een gezin) gezamenlijk films kunnen swipen. Een film is een "match" als genoeg mensen (configureerbaar) de film naar rechts hebben geswipet.

## ✨ Features V2

- 🎯 **Configureerbare Match Drempel** - Bepaal hoeveel likes nodig zijn voor een match
- ↩️ **Undo Functie** - Laatste swipe ongedaan maken
- 👥 **Members Widget** - Live overzicht van wie hoeveel heeft geswiped
- 🎯 **Partial Matches** - Zie films die bijna een match zijn (met volledige movie info)
- 🔄 **Realtime Updates** - Live synchronisatie van matches en members
- 📱 **Mobile-First Design** - Optimaal voor telefoons en tablets
- 🎨 **Dark Mode** - Moderne donkere interface

## 🚀 Technische Stack

- **Frontend:** HTML5, Tailwind CSS (CDN), Alpine.js 3.x, Hammer.js
- **Backend:** Supabase (PostgreSQL + Realtime)
- **API:** TMDB API v3 (Nederlands)
- **Hosting:** Vercel / Netlify

## 📦 Deployment naar Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USERNAME/movie-matcher)

### Manual Deploy

1. **Fork/Clone deze repository**

2. **Installeer Vercel CLI** (optioneel)
   ```bash
   npm i -g vercel
   ```

3. **Deploy via Vercel Dashboard**
   - Ga naar [vercel.com](https://vercel.com)
   - Klik "Add New Project"
   - Importeer deze Git repository
   - Klik "Deploy"

4. **Deploy via CLI**
   ```bash
   vercel login
   vercel
   ```

### ⚙️ Environment Variables (Vercel)

Na deployment, configureer deze variabelen in Vercel Dashboard > Settings > Environment Variables:

**Optie 1: Direct in config.js** (voor snelle deployment)
- Wijzig `config.js` met je API keys
- Commit en push

**Optie 2: Environment Variables** (veiliger, voor production)
- Pas `config.js` aan om environment variables te gebruiken
- Voeg toe in Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_TMDB_API_KEY`

## 🔧 Supabase Setup

### 1. Database Schema

Voer de volgende SQL bestanden uit in Supabase SQL Editor:

1. **Basis setup:** `database_setup.sql`
2. **V2 features:** `database_migration_v2.sql`

### 2. Realtime Configuratie

1. Ga naar **Database > Replication**
2. Schakel **Realtime** in voor:
   - ✅ `matches` tabel
   - ✅ `session_members` tabel

### 3. Credentials

1. Ga naar **Settings > API**
2. Kopieer:
   - **Project URL** (bijv. `https://xyz.supabase.co`)
   - **anon (public) key**
3. Vul deze in bij `config.js`

## 🎬 TMDB API Setup

1. Ga naar [themoviedb.org](https://www.themoviedb.org) en maak een account
2. Ga naar **Settings > API**
3. Vraag een API key aan (Developer optie)
4. Kopieer de **API Key (v3 auth)**
5. Vul in bij `config.js`

Test je API key:
```
https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY
```

## 💻 Lokale Development

### Vereisten
- Een lokale webserver (vanwege CORS en ES6 modules)

### Optie 1: Python
```bash
python -m http.server 8080
```

### Optie 2: Node.js
```bash
npx http-server -p 8080
```

### Optie 3: VS Code Live Server
1. Installeer "Live Server" extensie
2. Rechtermuisklik op `index.html`
3. Kies "Open with Live Server"

Open browser: `http://localhost:8080`

## 📁 Project Structuur

```
movie-matcher/
├── index.html              # Swipe interface
├── matches.html            # Matches overzicht
├── styles.css              # Custom styling
├── app.js                  # Hoofd applicatie logica (Alpine.js)
├── matches.js              # Matches pagina logica
├── config.js               # API configuratie
├── supabase.js             # Supabase client + RPC functies
├── tmdb.js                 # TMDB API integratie
├── utils.js                # Helper functies
├── database_setup.sql      # Initial database schema
├── database_migration_v2.sql # V2 features migratie
├── vercel.json            # Vercel configuratie
└── README.md              # Deze file
```

## 🎮 Gebruiksaanwijzing

### Host Flow
1. Open de website
2. Selecteer filters:
   - Streaming diensten (Netflix, Disney+, etc.)
   - Genres
   - Maximum leeftijd
   - **Match drempel** (hoeveel likes nodig voor match)
3. Klik "Sessie Aanmaken"
4. Deel de link met groepsleden
5. Begin met swipen!

### Deelnemer Flow
1. Open de gedeelde link
2. Voer optioneel je naam in
3. Begin met swipen!
4. Zie realtime wie er swiped in de members widget

### Swipe Acties
- 👆 **Swipe rechts** of ❤️ = Like
- 👈 **Swipe links** of ❌ = Dislike
- ⏮️ **Undo knop** = Maak laatste swipe ongedaan
- 👥 **Members widget** = Zie wie hoeveel heeft geswiped

### Matches Pagina
- **Volledige Matches** - Films die genoeg likes hebben
  - Bekijk details, trailer, TMDB link
  - Zie wie de film heeft geliked
- **Gedeeltelijke Matches** - Films die bijna genoeg likes hebben
  - Met volledige movie informatie
  - Progress indicator (bijv. "2/3 likes")

## 🔍 V2 Features Details

### Configureerbare Match Drempel
```javascript
// In de sessie setup:
requiredVotes: 2  // Match bij 2 likes (standaard)
requiredVotes: 3  // Match bij 3 likes
```

### Partial Matches met Movie Data
Partial matches tonen nu:
- Poster afbeelding
- Titel, jaar, rating
- Genres
- Beschrijving
- Wie heeft geliked
- Hoeveel likes nog nodig

### Undo Functie
```sql
-- RPC functie in database:
undo_last_swipe(p_session_id, p_user_id)
```

### Members Widget
Live updates van:
- Aantal leden in sessie
- Swipe counts per lid
- Laatst actief timestamp

## 🐛 Troubleshooting

### CORS Errors
- ✅ Gebruik een lokale webserver (geen `file://`)
- ✅ Check TMDB API key geldigheid
- ✅ Verifieer Supabase CORS instellingen

### Realtime werkt niet
1. Check Replication settings in Supabase
2. Verifieer dat Realtime enabled is voor `matches` en `session_members`
3. Check browser console voor errors

### Movies laden niet
- ✅ Check TMDB API key
- ✅ Verifieer filters (minimaal 1 provider en 1 genre)
- ✅ Test API endpoint in browser

### Partial matches tonen geen data
- ✅ Verifieer dat `database_migration_v2.sql` is uitgevoerd
- ✅ Check of `movie_data` kolom bestaat in `swipes` tabel
- ✅ Nieuwe swipes nodig (oude swipes hebben geen movie_data)

## 📜 Database Migraties

### V1 → V2 Migratie
Als je een bestaande V1 database hebt:

1. Voer uit: `database_migration_v2.sql`
2. Dit voegt toe:
   - `required_votes` kolom aan `sessions`
   - `movie_data` kolom aan `swipes`
   - Nieuwe RPC functies (V2 variants)
   - `get_member_swipe_counts()`
   - `undo_last_swipe()`
   - `get_session_stats()`
   - `update_session_filters()`

## 🔐 Security & Best Practices

### API Keys
- ⚠️ **Nooit** commit API keys naar Git
- ✅ Gebruik environment variables voor production
- ✅ Gebruik `.gitignore` voor sensitive files

### Supabase RLS (optioneel)
Voor extra beveiliging, schakel Row Level Security in:
```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- Voeg policies toe naar wens
```

## 📝 Licentie

MIT License - zie LICENSE file

## 🙏 Credits

- **TMDB API** - The Movie Database (vereist attributie)
- **Supabase** - Open-source Firebase alternatief
- **Alpine.js** - Lightweight JavaScript framework
- **Tailwind CSS** - Utility-first CSS framework
- **Hammer.js** - Touch gesture library

## 📞 Support

- TMDB API Docs: [developers.themoviedb.org](https://developers.themoviedb.org/3)
- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)
- Alpine.js Docs: [alpinejs.dev](https://alpinejs.dev)

---

**Veel plezier met het vinden van de perfecte film! 🎬🍿**
