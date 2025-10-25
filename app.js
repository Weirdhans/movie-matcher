// ============================================
// MOVIE MATCHER - MAIN APPLICATION LOGIC
// ============================================

import { STREAMING_PROVIDERS_LIST, GENRES_LIST, CERTIFICATIONS, GENRES } from './config.js';
import {
  getUserId,
  getSessionIdFromUrl,
  updateUrlWithSession,
  generateShareLink,
  copyToClipboard,
  showToast
} from './utils.js';
import {
  initSupabase,
  createSession,
  getSession,
  joinSession,
  checkIfSessionMember,
  recordSwipe,
  checkAndCreateMatch,
  subscribeToMatches,
  subscribeToMembers,
  undoLastSwipe,
  getMemberSwipeCounts,
  updateSessionFilters
} from './supabase.js';
import {
  fetchMovies,
  getPosterUrl,
  prefetchNextPage,
  clearMoviesCache
} from './tmdb.js';

// ============================================
// ALPINE.JS COMPONENT
// ============================================

document.addEventListener('alpine:init', () => {
  Alpine.data('movieMatcherApp', () => ({
    // State
    loading: true,
    loadingMovies: false,
    userId: null,
    sessionId: null,
    sessionData: null,
    userName: '',

    // Filter Options
    streamingProviders: STREAMING_PROVIDERS_LIST,
    genres: GENRES_LIST,
    certifications: CERTIFICATIONS,

    // Selected Filters (for creating session)
    selectedProviders: [],
    selectedGenres: [],
    selectedCertification: '12',
    requiredVotes: 2, // V2: Configureerbare match drempel

    // Movies
    movies: [],
    currentMovieIndex: 0,
    currentPage: 1,

    // Share Link
    showShareLink: false,
    shareLink: '',

    // Matches
    matchCount: 0,
    showMatchModal: false,
    matchedMovie: null,

    // Realtime
    realtimeChannel: null,
    membersChannel: null,

    // V2 Features
    showJoinModal: false,
    joinName: '',
    members: [],
    showTrailerModal: false,
    trailerUrl: '',
    showFilmDetailsModal: false,
    filmDetails: null,
    showFiltersModal: false,
    showMembersWidget: false,
    canUndo: false,

    // ============================================
    // INITIALIZATION
    // ============================================

    async init() {
      console.log('🎬 Movie Matcher App Initialized');

      // Initialiseer Supabase
      initSupabase();

      // Genereer of haal user ID op
      this.userId = getUserId();
      console.log('👤 User ID:', this.userId);

      // Check of er een session ID in URL staat
      const urlSessionId = getSessionIdFromUrl();

      if (urlSessionId) {
        console.log('🔗 Session ID gevonden in URL:', urlSessionId);
        this.sessionId = urlSessionId;
        await this.loadSessionData(urlSessionId);

        // V2: Check of gebruiker al lid is van deze sessie
        const isAlreadyMember = await this.checkIfMember(urlSessionId);

        if (isAlreadyMember) {
          console.log('✅ Gebruiker is al lid, ga direct naar swipen');
          // Direct films laden en swipen
          await this.loadMovies();
          this.setupRealtimeSubscription();
          this.setupMembersSubscription();
          await this.loadMemberCounts();
          this.loading = false;
        } else {
          console.log('👋 Nieuwe gebruiker, toon join modal');
          // Toon join modal voor naam invoer
          this.showJoinModal = true;
          this.loading = false;
        }
      } else {
        console.log('✨ Geen session ID gevonden, toon create session form');
        this.loading = false;
      }
    },

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    async createSession() {
      // Validatie
      if (this.selectedProviders.length === 0) {
        alert('⚠️ Selecteer minimaal 1 streaming dienst');
        return;
      }

      if (this.selectedGenres.length === 0) {
        alert('⚠️ Selecteer minimaal 1 genre');
        return;
      }

      console.log('🚀 Sessie aanmaken...');
      this.loading = true;

      // Creëer sessie in database (V2: met required_votes)
      const { data, error } = await createSession(
        this.userId,
        this.selectedProviders,
        this.selectedGenres,
        this.selectedCertification,
        this.requiredVotes
      );

      if (error) {
        console.error('❌ Fout bij aanmaken sessie:', error);
        alert('Fout bij aanmaken sessie: ' + error);
        this.loading = false;
        return;
      }

      this.sessionId = data.id;
      this.sessionData = data;

      console.log('✅ Sessie aangemaakt:', this.sessionId);

      // Update URL
      updateUrlWithSession(this.sessionId);

      // Genereer share link
      this.shareLink = generateShareLink(this.sessionId);

      // Toon share link screen
      this.showShareLink = true;
      this.loading = false;
    },

    async loadSessionData(sessionId) {
      const { data, error } = await getSession(sessionId);

      if (error || !data) {
        console.error('❌ Sessie niet gevonden:', error);
        alert('Ongeldige sessie link. Ga terug naar de homepage om een nieuwe sessie te starten.');
        return false;
      }

      this.sessionData = data;
      return true;
    },

    async checkIfMember(sessionId) {
      // Check of de huidige gebruiker al lid is van deze sessie
      const { data, error } = await checkIfSessionMember(sessionId, this.userId);

      if (error) {
        console.error('❌ Fout bij checken membership:', error);
        return false;
      }

      console.log('👥 Membership check:', data ? 'Wel lid' : 'Niet lid');
      return !!data; // Retourneert true als data bestaat
    },

    async submitJoin() {
      if (!this.joinName.trim()) {
        alert('⚠️ Voer je naam in om door te gaan');
        return;
      }

      console.log('👋 Joining sessie met naam:', this.joinName);
      this.loading = true;
      this.showJoinModal = false;

      // Join sessie als lid met naam
      await joinSession(this.sessionId, this.userId, this.joinName);

      // Laad films
      await this.loadMovies();

      // Setup realtime subscriptions
      this.setupRealtimeSubscription();
      this.setupMembersSubscription();

      // Laad member counts
      await this.loadMemberCounts();

      this.loading = false;
    },

    async startSwiping() {
      console.log('▶️ Start swiping...');
      this.showShareLink = false;

      // Laad films
      await this.loadMovies();

      // Setup realtime subscriptions
      this.setupRealtimeSubscription();
      this.setupMembersSubscription();

      // Laad member counts
      await this.loadMemberCounts();
    },

    // ============================================
    // MOVIES
    // ============================================

    async loadMovies() {
      if (!this.sessionData) {
        console.error('❌ Geen sessie data beschikbaar');
        return;
      }

      console.log('🎬 Films laden met filters...');
      this.loadingMovies = true;

      const filters = {
        providers: this.sessionData.streaming_providers || [],
        genres: this.sessionData.genres || [],
        maxCertification: this.sessionData.max_certification || '12'
      };

      console.log('📋 Filters:', filters);

      const result = await fetchMovies(filters, this.currentPage);

      if (result.error) {
        console.error('❌ Fout bij laden films:', result.error);
        alert('Fout bij laden films: ' + result.error);
        this.loadingMovies = false;
        return;
      }

      this.movies = result.results || [];
      console.log(`✅ ${this.movies.length} films geladen`);

      // Prefetch volgende pagina
      if (result.page < result.totalPages) {
        prefetchNextPage(filters, result.page);
      }

      this.loadingMovies = false;
    },

    // ============================================
    // SWIPE ACTIONS
    // ============================================

    async swipeLeft() {
      await this.handleSwipe(false);
    },

    async swipeRight() {
      await this.handleSwipe(true);
    },

    async handleSwipe(swipedRight) {
      if (this.movies.length === 0) return;

      const movie = this.movies[this.currentMovieIndex];

      console.log(`👆 Swipe ${swipedRight ? 'RECHTS' : 'LINKS'}:`, movie.title);

      // Bouw movie data object (voor partial matches)
      const movieData = {
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        overview: movie.overview,
        genres: movie.genre_ids?.map(id => ({
          id: id,
          name: this.getGenreName(id)
        }))
      };

      // Registreer swipe in database (met movie data)
      await recordSwipe(this.sessionId, this.userId, movie.id, swipedRight, movieData);

      // Als rechts swipe, check voor match (V2: retourneert object met match info)
      if (swipedRight) {
        const matchResult = await checkAndCreateMatch(
          this.sessionId,
          movie.id,
          movieData
        );

        if (matchResult.is_match) {
          console.log('🎉 MATCH!');
          this.showMatchNotification({
            movie_id: movie.id,
            movie_data: {
              title: movie.title,
              poster_path: movie.poster_path
            }
          });
        } else {
          // V2: Toon progress indicator
          console.log(`👍 ${matchResult.likes_count}/${matchResult.required_votes} likes`);
        }
      }

      // V2: Enable undo button
      this.canUndo = true;

      // Ga naar volgende film
      this.nextMovie();
    },

    nextMovie() {
      this.currentMovieIndex++;

      // Check of we meer films moeten laden
      const remainingMovies = this.movies.length - this.currentMovieIndex;

      if (remainingMovies <= 5) {
        console.log('📥 Bijna door films heen, volgende pagina laden...');
        this.currentPage++;
        this.loadMoreMovies();
      }

      // Als we aan het einde zijn
      if (this.currentMovieIndex >= this.movies.length) {
        console.log('✅ Alle films doorgeswiped');
        // Optioneel: toon "geen films meer" bericht
      }
    },

    async loadMoreMovies() {
      if (!this.sessionData) return;

      const filters = {
        providers: this.sessionData.streaming_providers || [],
        genres: this.sessionData.genres || [],
        maxCertification: this.sessionData.max_certification || '12'
      };

      const result = await fetchMovies(filters, this.currentPage);

      if (result.results && result.results.length > 0) {
        this.movies = [...this.movies, ...result.results];
        console.log(`✅ ${result.results.length} extra films geladen`);
      }
    },

    // ============================================
    // REALTIME SUBSCRIPTIONS
    // ============================================

    setupRealtimeSubscription() {
      if (!this.sessionId) return;

      console.log('👂 Subscribing op matches...');

      this.realtimeChannel = subscribeToMatches(this.sessionId, (newMatch) => {
        console.log('🎉 Nieuwe match ontvangen via Realtime!', newMatch);
        this.matchCount++;
        this.showMatchNotification(newMatch);
      });
    },

    setupMembersSubscription() {
      if (!this.sessionId) return;

      console.log('👂 Subscribing op nieuwe members...');

      this.membersChannel = subscribeToMembers(this.sessionId, (newMember) => {
        console.log('👋 Nieuw lid via Realtime:', newMember);
        this.loadMemberCounts(); // Refresh member lijst
      });
    },

    async loadMemberCounts() {
      if (!this.sessionId) return;

      const { data } = await getMemberSwipeCounts(this.sessionId);
      if (data) {
        this.members = data;
        console.log('✅ Member counts geladen:', this.members);
      }
    },

    // ============================================
    // MATCH NOTIFICATION
    // ============================================

    showMatchNotification(match) {
      console.log('🎉 Toon match notificatie:', match);

      this.matchedMovie = match;
      this.showMatchModal = true;

      // Confetti animatie
      if (window.confetti) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Extra burst na 200ms
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });

          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 200);
      }
    },

    closeMatchModal() {
      this.showMatchModal = false;
      this.matchedMovie = null;
    },

    // ============================================
    // HELPERS
    // ============================================

    getPosterUrl(posterPath) {
      return getPosterUrl(posterPath, 'w500');
    },

    getGenreName(genreId) {
      // Zoek genre naam op basis van ID
      const genreEntry = Object.entries(GENRES).find(([name, id]) => id === genreId);
      return genreEntry ? genreEntry[0] : 'Onbekend';
    },

    async copyShareLink() {
      const success = await copyToClipboard(this.shareLink);

      if (success) {
        alert('✅ Link gekopieerd naar clipboard!');
      } else {
        alert('❌ Kon link niet kopiëren. Kopieer handmatig: ' + this.shareLink);
      }
    },

    goToMatches() {
      if (this.sessionId) {
        window.location.href = `matches.html?session=${this.sessionId}`;
      }
    },

    // ============================================
    // V2 NIEUWE FUNCTIES
    // ============================================

    async handleUndo() {
      if (!this.canUndo) return;

      console.log('⏮️ Undo laatste swipe...');

      const { data, error } = await undoLastSwipe(this.sessionId, this.userId);

      if (data?.success) {
        // Ga terug naar vorige film
        this.currentMovieIndex = Math.max(0, this.currentMovieIndex - 1);
        this.canUndo = false;

        // Toon feedback
        if (window.Alpine?.store) {
          Alpine.store('toast').show('✅ Swipe ongedaan gemaakt', 'success');
        }
      } else {
        alert('❌ Kon swipe niet ongedaan maken: ' + (data?.message || 'Geen swipes om ongedaan te maken'));
      }
    },

    toggleMembersWidget() {
      this.showMembersWidget = !this.showMembersWidget;
    },

    openFiltersModal() {
      this.showFiltersModal = true;
    },

    closeFiltersModal() {
      this.showFiltersModal = false;
    },

    async saveFilters() {
      console.log('💾 Filters opslaan...');

      const { data, error } = await updateSessionFilters(
        this.sessionId,
        this.sessionData.streaming_providers,
        this.sessionData.genres,
        this.sessionData.max_certification
      );

      if (data) {
        this.showFiltersModal = false;

        // Clear cache en herlaad films
        clearMoviesCache();
        this.currentMovieIndex = 0;
        this.currentPage = 1;
        await this.loadMovies();

        if (window.Alpine?.store) {
          Alpine.store('toast').show('✅ Filters bijgewerkt', 'success');
        }
      } else {
        alert('❌ Kon filters niet updaten: ' + error);
      }
    },

    openTrailer() {
      if (this.movies.length === 0) return;

      const movie = this.movies[this.currentMovieIndex];
      console.log('🎬 Trailer openen voor:', movie.title);

      // TODO: Fetch trailer URL van TMDB
      // Voor nu: placeholder
      this.trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;
      this.showTrailerModal = true;
    },

    closeTrailer() {
      this.showTrailerModal = false;
      this.trailerUrl = '';
    },

    openFilmDetails() {
      if (this.movies.length === 0) return;

      const movie = this.movies[this.currentMovieIndex];
      console.log('ℹ️ Film details openen voor:', movie.title);

      this.filmDetails = movie;
      this.showFilmDetailsModal = true;
    },

    closeFilmDetails() {
      this.showFilmDetailsModal = false;
      this.filmDetails = null;
    },

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
      console.log('🧹 Cleanup...');

      // Unsubscribe van realtime channels
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }
      if (this.membersChannel) {
        this.membersChannel.unsubscribe();
      }

      // Clear movies cache
      clearMoviesCache();
    }
  }));

  // ============================================
  // GLOBAL TOAST STORE
  // ============================================

  Alpine.store('toast', {
    visible: false,
    message: '',
    type: 'info',

    show(message, type = 'info', duration = 3000) {
      this.message = message;
      this.type = type;
      this.visible = true;

      setTimeout(() => {
        this.visible = false;
      }, duration);
    }
  });
});

// ============================================
// HAMMER.JS SWIPE GESTURES SETUP
// ============================================

// Setup swipe gestures na Alpine.js initialisatie
document.addEventListener('alpine:initialized', () => {
  console.log('🔨 Hammer.js swipe gestures setup...');

  // Wacht tot movie card element beschikbaar is
  setTimeout(() => {
    const movieCard = document.querySelector('.movie-card');

    if (!movieCard || !window.Hammer) {
      console.warn('⚠️ Movie card of Hammer.js niet gevonden');
      return;
    }

    const hammer = new Hammer(movieCard);

    // Enable horizontal panning
    hammer.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL });

    let initialTransform = 0;

    hammer.on('panstart', (e) => {
      movieCard.classList.add('dragging');
      initialTransform = 0;
    });

    hammer.on('panmove', (e) => {
      const deltaX = e.deltaX;
      const rotation = deltaX / 10; // Rotatie gebaseerd op swipe afstand

      movieCard.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

      // Visual feedback
      if (Math.abs(deltaX) > 100) {
        if (deltaX > 0) {
          movieCard.setAttribute('data-swipe-direction', 'right');
        } else {
          movieCard.setAttribute('data-swipe-direction', 'left');
        }
      } else {
        movieCard.removeAttribute('data-swipe-direction');
      }
    });

    hammer.on('panend', (e) => {
      movieCard.classList.remove('dragging');
      movieCard.removeAttribute('data-swipe-direction');

      const deltaX = e.deltaX;
      const threshold = 100; // Minimum swipe afstand

      if (Math.abs(deltaX) > threshold) {
        // Swipe accepted
        if (deltaX > 0) {
          // Swipe rechts
          movieCard.classList.add('swipe-right');
          Alpine.store('app')?.swipeRight();
        } else {
          // Swipe links
          movieCard.classList.add('swipe-left');
          Alpine.store('app')?.swipeLeft();
        }

        // Reset na animatie
        setTimeout(() => {
          movieCard.classList.remove('swipe-left', 'swipe-right');
          movieCard.style.transform = '';
        }, 300);
      } else {
        // Swipe rejected, spring terug
        movieCard.style.transform = '';
      }
    });

    console.log('✅ Hammer.js swipe gestures actief');
  }, 1000);
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Alleen actief als er een sessie is
  if (!window.Alpine?.store('app')?.sessionId) return;

  // Arrow Left = dislike
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    window.Alpine.store('app')?.swipeLeft();
  }

  // Arrow Right = like
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    window.Alpine.store('app')?.swipeRight();
  }

  // Escape = close modal
  if (e.key === 'Escape') {
    if (window.Alpine.store('app')?.showMatchModal) {
      window.Alpine.store('app').closeMatchModal();
    }
  }
});

console.log('✅ Movie Matcher App Loaded');
