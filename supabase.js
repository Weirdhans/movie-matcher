// ============================================
// SUPABASE CLIENT INITIALISATIE
// ============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Supabase client instance (wordt geïnitialiseerd via CDN)
let supabaseClient = null;

/**
 * Initialiseer Supabase client
 * Deze functie moet aangeroepen worden na het laden van de Supabase CDN library
 */
export function initSupabase() {
  if (!window.supabase) {
    console.error('❌ Supabase library niet geladen. Zorg dat de CDN script is toegevoegd aan je HTML.');
    return null;
  }

  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
    console.error('❌ SUPABASE_URL niet geconfigureerd in config.js');
    return null;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    console.error('❌ SUPABASE_ANON_KEY niet geconfigureerd in config.js');
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client geïnitialiseerd');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Fout bij initialiseren Supabase:', error);
    return null;
  }
}

/**
 * Haal Supabase client op
 */
export function getSupabase() {
  if (!supabaseClient) {
    console.warn('⚠️ Supabase client nog niet geïnitialiseerd. Roep initSupabase() aan.');
    return initSupabase();
  }
  return supabaseClient;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Check of gebruiker lid is van een sessie
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { data, error }
 */
export async function checkIfSessionMember(sessionId, userId) {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij checken membership:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Maak nieuwe sessie aan
 * @param {string} hostUserId - User ID van de host
 * @param {Array<string>} streamingProviders - Array van provider IDs
 * @param {Array<string>} genres - Array van genre IDs
 * @param {string} maxCertification - Max leeftijdsrating
 * @param {number} requiredVotes - Aantal vereiste likes voor match (default = aantal leden)
 * @returns {Promise<Object>} Sessie object of error
 */
export async function createSession(hostUserId, streamingProviders, genres, maxCertification, requiredVotes = 2) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    // Insert sessie
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        host_user_id: hostUserId,
        streaming_providers: streamingProviders,
        genres: genres,
        max_certification: maxCertification,
        is_active: true,
        total_members: 1,
        required_votes: requiredVotes
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Insert host als eerste member
    const { error: memberError } = await supabase
      .from('session_members')
      .insert({
        session_id: session.id,
        user_id: hostUserId,
        user_name: 'Host'
      });

    if (memberError) throw memberError;

    console.log('✅ Sessie aangemaakt:', session.id);
    return { data: session, error: null };
  } catch (error) {
    console.error('❌ Fout bij aanmaken sessie:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Haal sessie op
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Sessie object of error
 */
export async function getSession(sessionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    console.log('✅ Sessie opgehaald:', sessionId);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij ophalen sessie:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Join bestaande sessie
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} userName - Optionele gebruikersnaam
 * @returns {Promise<Object>} Result of error
 */
export async function joinSession(sessionId, userId, userName = null) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    // Check of gebruiker al lid is
    const { data: existingMember } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      console.log('✅ Gebruiker is al lid van deze sessie');
      return { data: existingMember, error: null };
    }

    // Insert nieuwe member
    const { data: member, error: memberError } = await supabase
      .from('session_members')
      .insert({
        session_id: sessionId,
        user_id: userId,
        user_name: userName
      })
      .select()
      .single();

    if (memberError) throw memberError;

    // Update total_members count
    const { error: updateError } = await supabase.rpc('increment_total_members', {
      session_id: sessionId
    });

    // Als RPC functie niet bestaat, doe het handmatig
    if (updateError) {
      const { data: session } = await supabase
        .from('sessions')
        .select('total_members')
        .eq('id', sessionId)
        .single();

      await supabase
        .from('sessions')
        .update({ total_members: (session?.total_members || 0) + 1 })
        .eq('id', sessionId);
    }

    console.log('✅ Gebruiker toegevoegd aan sessie');
    return { data: member, error: null };
  } catch (error) {
    console.error('❌ Fout bij joinen sessie:', error);
    return { data: null, error: error.message };
  }
}

// ============================================
// SWIPE MANAGEMENT
// ============================================

/**
 * Registreer swipe actie
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {number} movieId - TMDB movie ID
 * @param {boolean} swipedRight - True = like, false = dislike
 * @param {Object} movieData - Film data (optioneel, voor partial matches)
 * @returns {Promise<Object>} Result of error
 */
export async function recordSwipe(sessionId, userId, movieId, swipedRight, movieData = null) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    console.log(`📤 Swipe data naar DB:`, { movieId, swipedRight, hasMovieData: !!movieData, movieData });

    const { data, error } = await supabase
      .from('swipes')
      .insert({
        session_id: sessionId,
        user_id: userId,
        movie_id: movieId,
        swiped_right: swipedRight,
        movie_data: movieData
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Swipe geregistreerd: ${swipedRight ? 'LIKE' : 'DISLIKE'} voor film ${movieId}`);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij registreren swipe:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Check en creëer match V2 (roept RPC functie aan met required_votes logica)
 * @param {string} sessionId - Session ID
 * @param {number} movieId - TMDB movie ID
 * @param {Object} movieData - Film data om op te slaan
 * @returns {Promise<Object>} Object met is_match, likes_count, required_votes
 */
export async function checkAndCreateMatch(sessionId, movieId, movieData) {
  const supabase = getSupabase();
  if (!supabase) return { is_match: false, likes_count: 0, required_votes: 0 };

  try {
    const { data, error } = await supabase.rpc('check_and_create_match_v2', {
      p_session_id: sessionId,
      p_movie_id: movieId,
      p_movie_data: movieData
    });

    if (error) throw error;

    if (data?.is_match) {
      console.log(`🎉 MATCH! Film: ${movieId} (${data.likes_count}/${data.required_votes} likes)`);
    } else {
      console.log(`👍 Like geregistreerd (${data.likes_count}/${data.required_votes} likes)`);
    }

    return data || { is_match: false, likes_count: 0, required_votes: 0 };
  } catch (error) {
    console.error('❌ Fout bij checken match:', error);
    return { is_match: false, likes_count: 0, required_votes: 0 };
  }
}

// ============================================
// MATCHES OPHALEN
// ============================================

/**
 * Haal alle matches op voor een sessie
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Array van matches of error
 */
export async function getMatches(sessionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('session_id', sessionId)
      .order('matched_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ ${data.length} matches opgehaald`);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij ophalen matches:', error);
    return { data: null, error: error.message };
  }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe op nieuwe matches voor een sessie
 * @param {string} sessionId - Session ID
 * @param {Function} callback - Functie die aangeroepen wordt bij nieuwe match
 * @returns {Object} Channel object (gebruik .unsubscribe() om te stoppen)
 */
export function subscribeToMatches(sessionId, callback) {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Kan niet subscriben: Supabase niet geïnitialiseerd');
    return null;
  }

  console.log('👂 Subscribing op matches voor sessie:', sessionId);

  const channel = supabase
    .channel(`matches-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        console.log('🎉 Nieuwe match ontvangen via Realtime!', payload.new);
        callback(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('📡 Realtime subscription status:', status);
    });

  return channel;
}

/**
 * Subscribe op nieuwe members voor een sessie
 * @param {string} sessionId - Session ID
 * @param {Function} callback - Functie die aangeroepen wordt bij nieuwe member
 * @returns {Object} Channel object
 */
export function subscribeToMembers(sessionId, callback) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const channel = supabase
    .channel(`members-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_members',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        console.log('👋 Nieuw lid toegevoegd:', payload.new);
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// ============================================
// V2 NIEUWE FUNCTIES
// ============================================

/**
 * Haal partial matches op (films die door sommigen geliked zijn)
 * @param {string} sessionId - Session ID
 * @param {number} minVotes - Minimum aantal likes (default 1)
 * @returns {Promise<Object>} Array van partial matches of error
 */
export async function getPartialMatches(sessionId, minVotes = 1) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase.rpc('get_partial_matches', {
      p_session_id: sessionId,
      p_min_votes: minVotes
    });

    if (error) throw error;

    console.log(`✅ ${data.length} partial matches opgehaald`);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij ophalen partial matches:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Maak laatste swipe ongedaan
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result object met success boolean
 */
export async function undoLastSwipe(sessionId, userId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase.rpc('undo_last_swipe', {
      p_session_id: sessionId,
      p_user_id: userId
    });

    if (error) throw error;

    if (data.success) {
      console.log('⏮️ Laatste swipe ongedaan gemaakt:', data.movie_id);
    }

    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij undo swipe:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Haal swipe counts op voor alle session members
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Array van member swipe counts
 */
export async function getMemberSwipeCounts(sessionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase.rpc('get_member_swipe_counts', {
      p_session_id: sessionId
    });

    if (error) throw error;

    console.log(`✅ Swipe counts opgehaald voor ${data.length} members`);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij ophalen member swipe counts:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Update session filters (host only)
 * @param {string} sessionId - Session ID
 * @param {Array<string>} streamingProviders - Array van provider IDs
 * @param {Array<string>} genres - Array van genre IDs
 * @param {string} maxCertification - Max leeftijdsrating
 * @returns {Promise<Object>} Result object
 */
export async function updateSessionFilters(sessionId, streamingProviders, genres, maxCertification) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase.rpc('update_session_filters', {
      p_session_id: sessionId,
      p_streaming_providers: streamingProviders,
      p_genres: genres,
      p_max_certification: maxCertification
    });

    if (error) throw error;

    console.log('✅ Session filters bijgewerkt');
    return { data: true, error: null };
  } catch (error) {
    console.error('❌ Fout bij updaten filters:', error);
    return { data: false, error: error.message };
  }
}

/**
 * Haal sessie statistieken op
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Statistieken object
 */
export async function getSessionStats(sessionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase niet geïnitialiseerd' };

  try {
    const { data, error } = await supabase.rpc('get_session_stats', {
      p_session_id: sessionId
    });

    if (error) throw error;

    console.log('✅ Session stats opgehaald:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Fout bij ophalen stats:', error);
    return { data: null, error: error.message };
  }
}
