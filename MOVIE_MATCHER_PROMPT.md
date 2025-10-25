# Movie Matcher - "Tinder for Movies" Applicatie

## Project Overzicht

Bouw een volledige "Tinder for Movies" web applicatie waarmee een groep gebruikers (bijv. een gezin) gezamenlijk films kunnen swipen. Een film is een "match" als iedereen in de groep de film naar rechts heeft geswipet.

**Technische Aanpak:**
- Volledig client-side (HTML/CSS/JavaScript)
- Supabase voor realtime database
- TMDB API voor filmdata
- Alpine.js voor reactivity
- Tailwind CSS voor styling
- Hammer.js voor swipe gestures

---

## Technische Stack

```json
{
  "frontend": {
    "html": "HTML5",
    "css": "Tailwind CSS 3.x (via CDN)",
    "javascript": "Alpine.js 3.x (via CDN)",
    "gestures": "Hammer.js 2.x (via CDN)"
  },
  "backend": {
    "database": "Supabase (PostgreSQL + Realtime)",
    "api": "TMDB API v3"
  },
  "hosting": "Vercel / Netlify / GitHub Pages"
}
```

---

## Database Schema (Supabase)

### Tabel 1: `sessions`

Slaat informatie op over elke swipe-sessie (groep).

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  host_user_id TEXT NOT NULL,

  -- Filter instellingen (ingesteld door host)
  streaming_providers TEXT[], -- Array van provider IDs, bijv. ['8', '337']
  genres TEXT[], -- Array van genre IDs, bijv. ['28', '16']
  max_certification TEXT, -- Max leeftijdsrating, bijv. '12'

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  total_members INTEGER DEFAULT 1
);
```

### Tabel 2: `session_members`

Houdt bij welke gebruikers deel uitmaken van een sessie.

```sql
CREATE TABLE session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Anonieme ID uit localStorage
  user_name TEXT, -- Optionele naam ingevoerd door gebruiker
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, user_id)
);
```

### Tabel 3: `swipes`

Registreert elke swipe actie van gebruikers.

```sql
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  movie_id INTEGER NOT NULL, -- TMDB movie ID
  swiped_right BOOLEAN NOT NULL, -- TRUE = like, FALSE = dislike
  swiped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, user_id, movie_id)
);
```

### Tabel 4: `matches`

Bevat films die door alle groepsleden geliked zijn.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  movie_data JSONB, -- Opgeslagen TMDB data (titel, poster, etc.)
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, movie_id)
);
```

---

## PostgreSQL RPC Functie: `check_and_create_match`

Deze functie wordt aangeroepen na elke 'like' swipe om te controleren of er een match is.

**Logica:**
1. Tel hoeveel gebruikers in de sessie de film hebben geliked
2. Tel het totaal aantal leden in de sessie
3. Als beide getallen gelijk zijn → INSERT in `matches` tabel

```sql
CREATE OR REPLACE FUNCTION check_and_create_match(
  p_session_id UUID,
  p_movie_id INTEGER,
  p_movie_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_members INTEGER;
  v_likes_count INTEGER;
  v_match_exists BOOLEAN;
BEGIN
  -- Haal totaal aantal leden op
  SELECT total_members INTO v_total_members
  FROM sessions
  WHERE id = p_session_id;

  -- Tel aantal likes voor deze film
  SELECT COUNT(*) INTO v_likes_count
  FROM swipes
  WHERE session_id = p_session_id
    AND movie_id = p_movie_id
    AND swiped_right = TRUE;

  -- Check of match al bestaat
  SELECT EXISTS(
    SELECT 1 FROM matches
    WHERE session_id = p_session_id
      AND movie_id = p_movie_id
  ) INTO v_match_exists;

  -- Als iedereen heeft geliked EN match bestaat nog niet
  IF v_likes_count = v_total_members AND NOT v_match_exists THEN
    INSERT INTO matches (session_id, movie_id, movie_data)
    VALUES (p_session_id, p_movie_id, p_movie_data);

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
```

---

## TMDB API Integratie

### API Key Configuratie

```javascript
const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // Verkrijg via https://www.themoviedb.org/settings/api
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
```

### Streaming Providers (Nederland)

```javascript
const STREAMING_PROVIDERS = {
  'Netflix': 8,
  'Videoland': 71,
  'Prime Video': 119,
  'Disney+': 337,
  'HBO Max': 380
};
```

### Genres

```javascript
const GENRES = {
  'Actie': 28,
  'Avontuur': 12,
  'Animatie': 16,
  'Komedie': 35,
  'Misdaad': 80,
  'Documentaire': 99,
  'Drama': 18,
  'Familie': 10751,
  'Fantasy': 14,
  'Geschiedenis': 36,
  'Horror': 27,
  'Muziek': 10402,
  'Mysterie': 9648,
  'Romantiek': 10749,
  'Sciencefiction': 878,
  'Thriller': 53,
  'Oorlog': 10752,
  'Western': 37
};
```

### Kijkwijzer Classificaties

```javascript
const CERTIFICATIONS = [
  { label: 'Alle leeftijden', value: 'AL' },
  { label: '6 jaar', value: '6' },
  { label: '9 jaar', value: '9' },
  { label: '12 jaar', value: '12' },
  { label: '16 jaar', value: '16' }
];
```

### Films Ophalen met Filters

**Endpoint:** `/discover/movie`

**Cruciale Parameters:**

```javascript
const params = {
  api_key: TMDB_API_KEY,
  language: 'nl-NL',
  region: 'NL',
  watch_region: 'NL',

  // Streaming providers (OR logica met |)
  with_watch_providers: '8|337|119', // Netflix|Disney+|Prime Video

  // Genres (AND logica met ,)
  with_genres: '16,10751', // Animatie EN Familie

  // Leeftijdsclassificatie
  certification_country: 'NL',
  'certification.lte': '12', // Maximaal 12 jaar

  // Sortering en kwaliteit
  sort_by: 'popularity.desc',
  'vote_count.gte': 50, // Minimaal 50 stemmen voor betrouwbaarheid

  page: 1
};
```

**Volledige API Call:**

```javascript
async function fetchMovies(filters) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'nl-NL',
    region: 'NL',
    watch_region: 'NL',
    with_watch_providers: filters.providers.join('|'), // OR
    with_genres: filters.genres.join(','), // AND
    certification_country: 'NL',
    'certification.lte': filters.maxCertification,
    sort_by: 'popularity.desc',
    'vote_count.gte': 50,
    page: filters.page || 1
  });

  const response = await fetch(`${TMDB_BASE_URL}/discover/movie?${params}`);
  const data = await response.json();

  return data.results; // Array van films
}
```

---

## Functionaliteit Requirements

### 1. Groep Creëren (Host Flow)

**Stappen:**
1. Gebruiker landt op homepage
2. Klikt op "Nieuwe Sessie Starten"
3. Selecteert filters:
   - **Streaming diensten** (checkboxes, multi-select)
   - **Genres** (checkboxes, multi-select)
   - **Max leeftijd** (dropdown)
4. Voert optioneel een naam in
5. Klikt "Sessie Aanmaken"
6. Systeem:
   - Genereert unieke `session_id`
   - Genereert unieke `user_id` (opslaan in localStorage)
   - INSERT in `sessions` tabel met filters
   - INSERT in `session_members` tabel
   - Redirect naar `/?session={session_id}`
7. Toont deelbare link + QR code (optioneel)

### 2. Deelnemen aan Groep (Member Flow)

**Stappen:**
1. Gebruiker opent link `/?session={session_id}`
2. Systeem checkt:
   - Is `session_id` geldig?
   - Is sessie nog actief?
3. Vraagt om naam (optioneel)
4. Genereert unieke `user_id` (localStorage)
5. INSERT in `session_members`
6. UPDATE `sessions.total_members` (+1)
7. Toont swipe interface

### 3. Films Laden

**Logica:**
1. Haal filters op uit `sessions` tabel via `session_id`
2. Roep TMDB `/discover/movie` aan met deze filters
3. Laad eerste 20 films (page 1)
4. Prefetch volgende pagina als gebruiker door 15 films heen is
5. Cache films in memory om dubbele API calls te voorkomen

### 4. Swipe Interface

**UI Layout:**

```
┌─────────────────────────────────┐
│         [Logo] Movie Matcher     │
├─────────────────────────────────┤
│                                  │
│   ┌─────────────────────────┐   │
│   │                         │   │
│   │   [MOVIE POSTER]        │   │
│   │                         │   │
│   │   Titel: Frozen         │   │
│   │   Jaar: 2013            │   │
│   │   Rating: 7.4/10        │   │
│   │                         │   │
│   │   Genres: Animatie,     │   │
│   │           Familie        │   │
│   │                         │   │
│   │   Beschrijving...       │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                  │
│   [❌ DISLIKE]    [❤️ LIKE]      │
│                                  │
│   Nog 47 films te swipen         │
└─────────────────────────────────┘
```

**Interacties:**
- **Swipe links** → Dislike (voeg toe aan `swipes` met `swiped_right=FALSE`)
- **Swipe rechts** → Like (voeg toe aan `swipes` met `swiped_right=TRUE`, roep RPC aan)
- **Knoppen** → Alternatief voor touch gestures (desktop)
- **Animatie** → Kaart vliegt weg in swipe richting

### 5. Matching Logica

**Flow:**
1. Gebruiker swipet rechts op film X
2. INSERT in `swipes` tabel
3. Roep `check_and_create_match()` RPC functie aan
4. RPC functie:
   - Telt likes voor film X in sessie
   - Vergelijkt met `total_members`
   - Als gelijk → INSERT in `matches`
5. Supabase Realtime detecteert nieuwe match
6. Alle clients ontvangen realtime update
7. Toon match notificatie (confetti animatie + modal)

### 6. Realtime Synchronisatie

**Supabase Realtime Setup:**

```javascript
// Subscribe to nieuwe matches
const matchesChannel = supabase
  .channel('matches')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'matches',
      filter: `session_id=eq.${sessionId}`
    },
    (payload) => {
      // Nieuwe match ontvangen!
      showMatchNotification(payload.new);
    }
  )
  .subscribe();
```

### 7. Matches Pagina

**UI Layout:**

```
┌─────────────────────────────────┐
│  [← Terug]      Matches (3)     │
├─────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐   │
│  │ [Poster] Frozen          │   │
│  │ 2013 • 7.4/10            │   │
│  │ Animatie, Familie         │   │
│  │ [TMDB Link] [Trailer]    │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ [Poster] Inside Out      │   │
│  │ 2015 • 8.1/10            │   │
│  │ Animatie, Familie         │   │
│  │ [TMDB Link] [Trailer]    │   │
│  └──────────────────────────┘   │
│                                  │
│  └─ Geen matches meer ─┘         │
└─────────────────────────────────┘
```

**Features:**
- Lijst van alle matches voor deze sessie
- Sorteer op match datum (nieuwste eerst)
- Link naar TMDB pagina
- Optioneel: Embedded trailer (YouTube)
- Realtime updates (nieuwe matches verschijnen automatisch)

### 8. Sessie Restarten (Host Only)

**Functionaliteit:**
- Knop "Sessie Restarten" (alleen zichtbaar voor host)
- DELETE alle swipes en matches voor deze sessie
- Reset naar swipe interface met nieuwe set films
- Alle members blijven in sessie

---

## UI/UX Specificaties

### Kleuren Schema

```css
:root {
  --primary: #10b981; /* Groen voor likes */
  --danger: #ef4444; /* Rood voor dislikes */
  --background: #0f172a; /* Donkere achtergrond */
  --surface: #1e293b; /* Kaart achtergrond */
  --text: #f1f5f9; /* Lichte tekst */
  --text-secondary: #94a3b8; /* Secundaire tekst */
  --accent: #3b82f6; /* Blauw voor knoppen */
}
```

### Typografie

- **Primair font:** Inter (Google Fonts)
- **Heading:** 600 weight
- **Body:** 400 weight
- **Code/Mono:** Fira Code (optioneel)

### Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
```

### Animaties

**Swipe Animatie:**
```css
.swipe-left {
  transform: translateX(-150%) rotate(-30deg);
  opacity: 0;
  transition: all 0.3s ease-out;
}

.swipe-right {
  transform: translateX(150%) rotate(30deg);
  opacity: 0;
  transition: all 0.3s ease-out;
}
```

**Match Notificatie:**
- Confetti effect (gebruik `canvas-confetti` library via CDN)
- Modal met "It's a Match!" tekst
- Show matched film poster
- Fade in animatie

---

## File Structuur

```
movie-matcher/
├── index.html              # Hoofdpagina (swipe interface)
├── matches.html            # Matches overzicht pagina
├── styles.css              # Custom CSS (aanvulling op Tailwind)
├── app.js                  # Hoofd Alpine.js applicatie logica
├── config.js               # API keys en configuratie
├── supabase.js             # Supabase client initialisatie
├── tmdb.js                 # TMDB API calls en helpers
├── utils.js                # Helper functies (user ID, etc.)
└── README.md               # Setup instructies
```

---

## Implementatie Volgorde

### Fase 1: Setup (30-45 min)

1. **Supabase Project:**
   - Maak nieuw project aan op supabase.com
   - Voer alle SQL schema's uit in SQL Editor
   - Voer RPC functie uit
   - Kopieer project URL en anon key

2. **TMDB API:**
   - Registreer op themoviedb.org
   - Verkrijg API key van settings/api pagina
   - Test API key met browser: `https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY`

3. **Project Initialisatie:**
   - Maak nieuwe directory `movie-matcher/`
   - Maak alle files aan (zie file structuur)
   - Voeg API keys toe aan `config.js`

### Fase 2: Basis Setup (30 min)

1. **HTML Structuur:**
   - Laad CDN libraries (Tailwind, Alpine.js, Hammer.js)
   - Maak basis layout met navigation
   - Setup Alpine.js data stores

2. **Supabase Connectie:**
   - Initialiseer Supabase client
   - Test connectie met simple query
   - Setup localStorage voor user ID

3. **Routing Logica:**
   - Detect `?session=` parameter
   - Show "Create Session" vs "Join Session" flow

### Fase 3: Sessie Management (45 min)

1. **Create Session Flow:**
   - Formulier met filters (providers, genres, certification)
   - Validatie van minimaal 1 provider en 1 genre
   - INSERT in Supabase `sessions` tabel
   - Genereer deelbare link

2. **Join Session Flow:**
   - Valideer session ID bestaat
   - Optionele naam input
   - INSERT in `session_members`
   - UPDATE `total_members` count

### Fase 4: TMDB Integratie (30 min)

1. **Discover API:**
   - Implementeer `fetchMovies()` functie
   - Parse filters naar API parameters
   - Handle pagination logica
   - Error handling voor API failures

2. **Film Data Caching:**
   - Store gefetchte films in Alpine.js store
   - Prefetch logica voor volgende pagina
   - Prevent dubbele API calls

### Fase 5: Swipe Interface (45 min)

1. **Film Kaart Component:**
   - Layout met poster, titel, jaar, rating
   - Truncated synopsis (max 3 regels)
   - Genre badges

2. **Swipe Gestures:**
   - Hammer.js pan gesture setup
   - Visual feedback tijdens drag
   - Threshold voor swipe accept (bijv. 100px)
   - Fallback knoppen voor desktop

3. **Swipe Actions:**
   - INSERT in `swipes` tabel
   - Next film laden
   - Progress counter updaten

### Fase 6: Matching Systeem (30 min)

1. **RPC Call:**
   - Na elke rechts swipe: call `check_and_create_match()`
   - Pass session ID, movie ID, movie data

2. **Realtime Subscription:**
   - Subscribe to `matches` table INSERTs
   - Filter op session ID
   - Trigger match notification bij nieuwe match

3. **Match Notificatie:**
   - Confetti animatie
   - Modal met film details
   - "Bekijk Matches" knop

### Fase 7: Matches Pagina (30 min)

1. **Matches Lijst:**
   - Fetch alle matches voor sessie
   - Grid/lijst layout met film cards
   - Link naar TMDB pagina

2. **Realtime Updates:**
   - Subscribe to nieuwe matches
   - Append nieuwe matches aan lijst
   - Smooth scroll naar nieuwe match

### Fase 8: Polish & Testing (30 min)

1. **Error Handling:**
   - Network failures (retry logica)
   - Invalid session ID (error message)
   - No movies found (empty state)

2. **Loading States:**
   - Skeleton loaders voor film kaarten
   - Spinner tijdens API calls
   - "Laden..." tekst bij session join

3. **Responsive Design:**
   - Test op mobile (375px width)
   - Test op tablet (768px width)
   - Test op desktop (1280px width)

4. **Multi-User Testing:**
   - Open sessie in 2 browsers/devices
   - Verifieer realtime synchronisatie
   - Test matching logica met 2+ gebruikers

---

## Setup Instructies

### 1. Supabase Configuratie

```bash
# 1. Ga naar https://supabase.com
# 2. Maak nieuw project aan
# 3. Open SQL Editor
# 4. Voer alle CREATE TABLE statements uit
# 5. Voer CREATE FUNCTION statement uit
# 6. Ga naar Settings > API
# 7. Kopieer:
#    - Project URL
#    - anon (public) key
```

### 2. TMDB API Key

```bash
# 1. Ga naar https://www.themoviedb.org
# 2. Maak account aan (gratis)
# 3. Ga naar Settings > API
# 4. Vraag API key aan (kies "Developer" optie)
# 5. Kopieer API Key (v3 auth)
```

### 3. Configuratie File

**`config.js`:**

```javascript
// Supabase configuratie
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key';

// TMDB configuratie
export const TMDB_API_KEY = 'your-tmdb-api-key';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
```

### 4. Lokaal Testen

```bash
# Gebruik een lokale server (vereist voor CORS)
# Optie 1: Python
python -m http.server 8000

# Optie 2: Node.js (npx)
npx serve .

# Optie 3: VS Code Live Server extensie

# Open browser: http://localhost:8000
```

---

## Testing Checklist

### ✅ Sessie Management
- [ ] Nieuwe sessie aanmaken met filters
- [ ] Unieke session ID wordt gegenereerd
- [ ] Deelbare link werkt in nieuwe browser
- [ ] Join sessie flow werkt
- [ ] `total_members` count klopt

### ✅ TMDB API
- [ ] Films worden geladen met correcte filters
- [ ] Streaming provider filter werkt (OR logica)
- [ ] Genre filter werkt (AND logica)
- [ ] Leeftijdsclassificatie filter werkt
- [ ] Pagination werkt (meer films na 20 swipes)
- [ ] Posters laden correct
- [ ] Nederlandse titels worden getoond

### ✅ Swipe Functionaliteit
- [ ] Touch swipe werkt op mobile
- [ ] Knoppen werken op desktop
- [ ] Swipe animatie is smooth
- [ ] Volgende film laadt na swipe
- [ ] Progress counter werkt
- [ ] Swipes worden opgeslagen in database

### ✅ Matching Systeem
- [ ] RPC functie wordt aangeroepen na rechts swipe
- [ ] Match wordt gecreëerd als iedereen heeft geliked
- [ ] Match notificatie verschijnt voor alle gebruikers
- [ ] Confetti animatie speelt af
- [ ] Match wordt toegevoegd aan matches pagina

### ✅ Realtime Functionaliteit
- [ ] Nieuwe matches verschijnen direct bij alle gebruikers
- [ ] Geen pagina refresh nodig
- [ ] Realtime werkt met 2+ devices tegelijk

### ✅ Matches Pagina
- [ ] Alle matches worden getoond
- [ ] Sorteer op datum (nieuwste eerst)
- [ ] Link naar TMDB werkt
- [ ] Nieuwe matches verschijnen automatisch

### ✅ Responsive Design
- [ ] Werkt op mobile (375px)
- [ ] Werkt op tablet (768px)
- [ ] Werkt op desktop (1280px+)
- [ ] Touch gestures werken op touch devices
- [ ] Knoppen werken op non-touch devices

### ✅ Error Handling
- [ ] Ongeldige session ID toont error
- [ ] Network failures worden afgehandeld
- [ ] Geen films gevonden toont empty state
- [ ] API rate limiting wordt afgehandeld

---

## Potentiële Problemen & Oplossingen

### Probleem 1: CORS Errors met TMDB API

**Symptoom:** Console error: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Oorzicht:** TMDB API ondersteunt CORS, maar alleen met juiste headers.

**Oplossing:**
- Zorg dat je `api_key` parameter correct meestuurt
- Test eerst in browser: `https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY`
- Als het blijft falen: gebruik serverless function als proxy (Vercel Functions)

### Probleem 2: Supabase Realtime Niet Werkend

**Symptoom:** Matches verschijnen niet automatisch bij andere gebruikers.

**Oorzicht:** Realtime subscriptions vereisen correcte setup.

**Oplossing:**
```javascript
// Controleer of Realtime is enabled in Supabase dashboard
// Database > Replication > Enable Realtime voor 'matches' tabel

// Check connection status
const channel = supabase.channel('matches');
channel.on('system', { event: '*' }, (payload) => {
  console.log('Channel status:', payload);
});
```

### Probleem 3: RPC Functie Geeft Foutmelding

**Symptoom:** Error bij aanroepen van `check_and_create_match`.

**Oorzicht:** SQL syntax error of verkeerde parameters.

**Oplossing:**
- Test RPC functie direct in Supabase SQL Editor
- Check parameter types (UUID vs TEXT vs INTEGER)
- Controleer of functie bestaat: `SELECT * FROM pg_proc WHERE proname = 'check_and_create_match';`

### Probleem 4: Certificatie Filter Geeft Geen Resultaten

**Symptoom:** Geen films worden geretourneerd ondanks geldige filters.

**Oorzicht:** TMDB certificatie codes verschillen per land.

**Oplossing:**
- Verifieer NL certificatie codes via: `https://api.themoviedb.org/3/certification/movie/list?api_key=YOUR_KEY`
- Mogelijk `certification.lte` niet ondersteund voor NL → Gebruik client-side filtering op `release_dates`

### Probleem 5: localStorage Werkt Niet

**Symptoom:** User ID gaat verloren na refresh.

**Oorzicht:** localStorage werkt niet in incognito mode of is disabled.

**Oplossing:**
```javascript
// Fallback naar sessionStorage of in-memory storage
function getUserId() {
  try {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('userId', userId);
    }
    return userId;
  } catch (e) {
    // Fallback als localStorage niet beschikbaar is
    if (!window._tempUserId) {
      window._tempUserId = crypto.randomUUID();
    }
    return window._tempUserId;
  }
}
```

---

## Deployment

### Vercel (Aanbevolen)

```bash
# 1. Installeer Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy vanuit project directory
cd movie-matcher
vercel

# 4. Volg prompts
# - Project name: movie-matcher
# - Framework: Other
# - Build command: (leeg laten)
# - Output directory: .

# 5. Productie deployment
vercel --prod
```

### Netlify

```bash
# 1. Installeer Netlify CLI
npm i -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
cd movie-matcher
netlify deploy

# 4. Productie
netlify deploy --prod
```

### GitHub Pages

```bash
# 1. Maak GitHub repo
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/movie-matcher.git
git push -u origin main

# 2. Enable GitHub Pages
# - Ga naar repo Settings > Pages
# - Source: Deploy from branch
# - Branch: main, folder: / (root)

# 3. Wacht 1-2 minuten
# Site beschikbaar op: https://username.github.io/movie-matcher
```

---

## Uitbreidingen (Optioneel - Toekomstige Versies)

### V2 Features
- [ ] **Accountsysteem:** Persistente gebruikers met profielen
- [ ] **Sessie Geschiedenis:** Bekijk oude matches van eerdere sessies
- [ ] **Watchlist Export:** Export matches naar Trakt, Letterboxd, etc.
- [ ] **Trailer Previews:** Embedded YouTube trailers op kaarten
- [ ] **Advanced Filters:** Acteurs, regisseurs, decennia
- [ ] **Swipe Statistieken:** "Je hebt 87% komedie geliked"
- [ ] **Undo Knop:** Laatste swipe ongedaan maken
- [ ] **Chat Functionaliteit:** Discussie binnen groep
- [ ] **Stemming per Match:** Prioriteer welke film eerst te kijken

### V3 Features
- [ ] **TV Shows Ondersteuning:** Niet alleen films, ook series
- [ ] **Hybrid Mode:** Combineer films + series in één sessie
- [ ] **Scheduled Sessions:** Plan swipe sessies voor later
- [ ] **Notifications:** Push notifications bij nieuwe matches
- [ ] **Social Sharing:** Deel matches op social media
- [ ] **Public Profiles:** Deel je film smaak met anderen

---

## Licentie & Credits

- **TMDB API:** Vereist attributie (toon "Powered by TMDB" logo)
- **Supabase:** Open-source, zelf-hostbaar
- **Alpine.js:** MIT License
- **Tailwind CSS:** MIT License
- **Hammer.js:** MIT License

---

## Nuttige Links

- **TMDB API Docs:** https://developers.themoviedb.org/3
- **Supabase Docs:** https://supabase.com/docs
- **Alpine.js Docs:** https://alpinejs.dev/start-here
- **Tailwind CSS Docs:** https://tailwindcss.com/docs
- **Hammer.js Docs:** https://hammerjs.github.io/getting-started/

---

## Contact & Support

Voor vragen over implementatie:
1. Check TMDB API docs voor film data problemen
2. Check Supabase docs voor database/realtime problemen
3. Test met console.log() en Chrome DevTools Network tab
4. Gebruik Supabase Dashboard SQL Editor om queries te testen

---

**Succes met de implementatie! 🎬🍿**

Deze prompt bevat alle informatie die je nodig hebt om de volledige applicatie te bouwen. Kopieer deze naar je nieuwe Claude Code instantie en vraag: "Bouw deze applicatie stap voor stap volgens de implementatie volgorde."
