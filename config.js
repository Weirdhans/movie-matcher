// ============================================
// MOVIE MATCHER - CONFIGURATIE
// ============================================
// Vul hier je API credentials in na setup

// ============================================
// SUPABASE CONFIGURATIE
// ============================================
// Verkrijg deze gegevens via:
// 1. Ga naar https://supabase.com
// 2. Open je project
// 3. Ga naar Settings > API
// 4. Kopieer de URL en anon key

export const SUPABASE_URL = 'https://kjgoagtpjjyonujmsyvi.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZ29hZ3Rwamp5b251am1zeXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTI0MDgsImV4cCI6MjA3Njk2ODQwOH0.pBvnG0anKmg_YG38BdvahuPTN3ABM2GoRKOKEHQTcZk';

// ============================================
// TMDB API CONFIGURATIE
// ============================================
// Verkrijg je API key via:
// 1. Ga naar https://www.themoviedb.org
// 2. Maak een account aan
// 3. Ga naar Settings > API
// 4. Vraag een API key aan (kies "Developer")
// 5. Kopieer de API Key (v3 auth)

export const TMDB_API_KEY = 'a8c3fc5b5704ab0cf753f1cfaff6ac65';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// ============================================
// STREAMING PROVIDERS (NEDERLAND)
// ============================================
// TMDB provider IDs voor Nederlandse streaming diensten

export const STREAMING_PROVIDERS = {
  'Netflix': 8,
  'Videoland': 71,
  'Prime Video': 119,
  'Disney+': 337,
  'HBO Max': 380
};

// Array versie voor gemakkelijke iteratie in UI
export const STREAMING_PROVIDERS_LIST = [
  { id: '8', name: 'Netflix' },
  { id: '71', name: 'Videoland' },
  { id: '119', name: 'Prime Video' },
  { id: '337', name: 'Disney+' },
  { id: '380', name: 'HBO Max' }
];

// ============================================
// FILM GENRES
// ============================================
// TMDB genre IDs

export const GENRES = {
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

// Array versie voor gemakkelijke iteratie in UI
export const GENRES_LIST = [
  { id: '28', name: 'Actie' },
  { id: '12', name: 'Avontuur' },
  { id: '16', name: 'Animatie' },
  { id: '35', name: 'Komedie' },
  { id: '80', name: 'Misdaad' },
  { id: '99', name: 'Documentaire' },
  { id: '18', name: 'Drama' },
  { id: '10751', name: 'Familie' },
  { id: '14', name: 'Fantasy' },
  { id: '36', name: 'Geschiedenis' },
  { id: '27', name: 'Horror' },
  { id: '10402', name: 'Muziek' },
  { id: '9648', name: 'Mysterie' },
  { id: '10749', name: 'Romantiek' },
  { id: '878', name: 'Sciencefiction' },
  { id: '53', name: 'Thriller' },
  { id: '10752', name: 'Oorlog' },
  { id: '37', name: 'Western' }
];

// ============================================
// KIJKWIJZER CLASSIFICATIES (NEDERLAND)
// ============================================

export const CERTIFICATIONS = [
  { value: 'AL', label: 'Alle leeftijden' },
  { value: '6', label: '6 jaar' },
  { value: '9', label: '9 jaar' },
  { value: '12', label: '12 jaar' },
  { value: '16', label: '16 jaar' }
];

// ============================================
// APP INSTELLINGEN
// ============================================

export const APP_CONFIG = {
  // Aantal films om per keer op te halen van TMDB
  moviesPerPage: 20,

  // Wanneer nieuwe pagina prefetchen (aantal films over)
  prefetchThreshold: 5,

  // Minimaal aantal stemmen voor film betrouwbaarheid
  minVoteCount: 50,

  // Default sortering
  defaultSort: 'popularity.desc',

  // Regio voor streaming providers
  region: 'NL',

  // Taal voor film informatie
  language: 'nl-NL'
};
