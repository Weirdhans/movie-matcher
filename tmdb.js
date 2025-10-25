// ============================================
// TMDB API HELPER FUNCTIES
// ============================================

import {
  TMDB_API_KEY,
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE,
  APP_CONFIG
} from './config.js';

// Cache voor gefetchte films om dubbele API calls te voorkomen
const moviesCache = new Map();
let currentPage = 1;
let totalPages = 1;

/**
 * Check of TMDB API geconfigureerd is
 * @returns {boolean}
 */
function isConfigured() {
  if (!TMDB_API_KEY || TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
    console.error('❌ TMDB_API_KEY niet geconfigureerd in config.js');
    return false;
  }
  return true;
}

/**
 * Fetch films van TMDB Discover API met filters
 * @param {Object} filters - Filter object
 * @param {Array<string>} filters.providers - Streaming provider IDs
 * @param {Array<string>} filters.genres - Genre IDs
 * @param {string} filters.maxCertification - Max leeftijdsrating
 * @param {number} filters.page - Pagina nummer (optioneel)
 * @returns {Promise<Object>} Object met results array en pagination info
 */
export async function fetchMovies(filters, page = 1) {
  if (!isConfigured()) {
    return { results: [], page: 1, totalPages: 0, error: 'API niet geconfigureerd' };
  }

  // Check cache
  const cacheKey = `${filters.providers.join(',')}-${filters.genres.join(',')}-${filters.maxCertification}-${page}`;
  if (moviesCache.has(cacheKey)) {
    console.log('📦 Films geladen uit cache:', cacheKey);
    return moviesCache.get(cacheKey);
  }

  try {
    // Bouw query parameters
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: APP_CONFIG.language,
      region: APP_CONFIG.region,
      watch_region: APP_CONFIG.region,
      sort_by: APP_CONFIG.defaultSort,
      'vote_count.gte': APP_CONFIG.minVoteCount,
      page: page
    });

    // Streaming providers (OR logica met |)
    if (filters.providers && filters.providers.length > 0) {
      params.append('with_watch_providers', filters.providers.join('|'));
    }

    // Genres (AND logica met ,)
    if (filters.genres && filters.genres.length > 0) {
      params.append('with_genres', filters.genres.join(','));
    }

    // Leeftijdsclassificatie
    if (filters.maxCertification) {
      params.append('certification_country', 'NL');
      params.append('certification.lte', filters.maxCertification);
    }

    const url = `${TMDB_BASE_URL}/discover/movie?${params}`;
    console.log('🎬 Fetching movies:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update pagination info
    currentPage = data.page;
    totalPages = data.total_pages;

    const result = {
      results: data.results || [],
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      error: null
    };

    // Cache het resultaat
    moviesCache.set(cacheKey, result);

    console.log(`✅ ${data.results.length} films opgehaald (pagina ${data.page}/${data.total_pages})`);

    return result;
  } catch (error) {
    console.error('❌ Fout bij fetchen films:', error);
    return {
      results: [],
      page: 1,
      totalPages: 0,
      totalResults: 0,
      error: error.message
    };
  }
}

/**
 * Haal gedetailleerde informatie op over een specifieke film
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<Object>} Film details object
 */
export async function fetchMovieDetails(movieId) {
  if (!isConfigured()) return null;

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: APP_CONFIG.language,
      append_to_response: 'videos,credits,watch/providers'
    });

    const url = `${TMDB_BASE_URL}/movie/${movieId}?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Film details opgehaald:', data.title);

    return data;
  } catch (error) {
    console.error('❌ Fout bij fetchen film details:', error);
    return null;
  }
}

/**
 * Haal trailer URL op voor een film
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<string|null>} YouTube trailer URL of null
 */
export async function fetchMovieTrailer(movieId) {
  if (!isConfigured()) return null;

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: APP_CONFIG.language
    });

    const url = `${TMDB_BASE_URL}/movie/${movieId}/videos?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Zoek naar YouTube trailer
    const trailer = data.results.find(
      video => video.type === 'Trailer' && video.site === 'YouTube'
    );

    if (trailer) {
      return `https://www.youtube.com/watch?v=${trailer.key}`;
    }

    return null;
  } catch (error) {
    console.error('❌ Fout bij fetchen trailer:', error);
    return null;
  }
}

/**
 * Genereer volledige poster URL
 * @param {string} posterPath - Poster path van TMDB (bijv. "/abc123.jpg")
 * @param {string} size - Poster size (w92, w154, w185, w342, w500, w780, original)
 * @returns {string|null} Volledige poster URL of null
 */
export function getPosterUrl(posterPath, size = 'w500') {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

/**
 * Genereer volledige backdrop URL
 * @param {string} backdropPath - Backdrop path van TMDB
 * @param {string} size - Backdrop size (w300, w780, w1280, original)
 * @returns {string|null} Volledige backdrop URL of null
 */
export function getBackdropUrl(backdropPath, size = 'w1280') {
  if (!backdropPath) return null;
  return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
}

/**
 * Converteer genre IDs naar namen
 * @param {Array<Object>} genreObjects - Array van genre objecten van TMDB
 * @returns {Array<string>} Array van genre namen
 */
export function getGenreNames(genreObjects) {
  if (!genreObjects || !Array.isArray(genreObjects)) return [];
  return genreObjects.map(genre => genre.name);
}

/**
 * Format runtime (minuten) naar uren en minuten
 * @param {number} runtime - Runtime in minuten
 * @returns {string} Formatted string (bijv. "2u 15m")
 */
export function formatRuntime(runtime) {
  if (!runtime) return 'Onbekend';

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}u`;

  return `${hours}u ${minutes}m`;
}

/**
 * Haal streaming providers op voor een film in Nederland
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<Array>} Array van streaming providers
 */
export async function fetchStreamingProviders(movieId) {
  if (!isConfigured()) return [];

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY
    });

    const url = `${TMDB_BASE_URL}/movie/${movieId}/watch/providers?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Haal Nederlandse providers op
    const nlProviders = data.results?.NL;

    if (!nlProviders) return [];

    // Combineer flatrate, rent en buy providers
    const providers = [
      ...(nlProviders.flatrate || []),
      ...(nlProviders.rent || []),
      ...(nlProviders.buy || [])
    ];

    // Remove duplicates based on provider_id
    const uniqueProviders = Array.from(
      new Map(providers.map(p => [p.provider_id, p])).values()
    );

    return uniqueProviders;
  } catch (error) {
    console.error('❌ Fout bij fetchen streaming providers:', error);
    return [];
  }
}

/**
 * Prefetch volgende pagina films (voor betere UX)
 * @param {Object} filters - Filter object
 * @param {number} currentPage - Huidige pagina
 */
export async function prefetchNextPage(filters, currentPage) {
  // Prefetch alleen als er nog meer pagina's zijn
  if (currentPage < totalPages) {
    console.log(`🔮 Prefetching pagina ${currentPage + 1}...`);
    await fetchMovies(filters, currentPage + 1);
  }
}

/**
 * Search films op titel
 * @param {string} query - Zoekterm
 * @param {number} page - Pagina nummer
 * @returns {Promise<Object>} Search results
 */
export async function searchMovies(query, page = 1) {
  if (!isConfigured()) return { results: [], page: 1, totalPages: 0 };

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: APP_CONFIG.language,
      query: query,
      page: page,
      region: APP_CONFIG.region
    });

    const url = `${TMDB_BASE_URL}/search/movie?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`🔍 ${data.results.length} zoekresultaten voor "${query}"`);

    return {
      results: data.results || [],
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results
    };
  } catch (error) {
    console.error('❌ Fout bij zoeken films:', error);
    return { results: [], page: 1, totalPages: 0 };
  }
}

/**
 * Haal populaire films op (voor fallback)
 * @param {number} page - Pagina nummer
 * @returns {Promise<Object>} Popular movies
 */
export async function fetchPopularMovies(page = 1) {
  if (!isConfigured()) return { results: [], page: 1, totalPages: 0 };

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: APP_CONFIG.language,
      page: page,
      region: APP_CONFIG.region
    });

    const url = `${TMDB_BASE_URL}/movie/popular?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`✅ ${data.results.length} populaire films opgehaald`);

    return {
      results: data.results || [],
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results
    };
  } catch (error) {
    console.error('❌ Fout bij fetchen populaire films:', error);
    return { results: [], page: 1, totalPages: 0 };
  }
}

/**
 * Clear de movie cache (gebruik bij reset)
 */
export function clearMoviesCache() {
  moviesCache.clear();
  currentPage = 1;
  totalPages = 1;
  console.log('🗑️ Movies cache gecleared');
}

/**
 * Haal huidige pagination state op
 * @returns {Object} Object met currentPage en totalPages
 */
export function getPaginationInfo() {
  return {
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };
}
