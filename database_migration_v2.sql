-- ============================================
-- MOVIE MATCHER V2 - DATABASE MIGRATION
-- ============================================
-- Voer dit bestand uit in Supabase SQL Editor
-- https://supabase.com/dashboard/project/kjgoagtpjjyonujmsyvi/sql

-- ============================================
-- 1. UPDATE SESSIONS TABLE
-- ============================================
-- Voeg required_votes kolom toe voor configureerbare match drempel

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS required_votes INTEGER DEFAULT 2;

-- Update bestaande sessions: zet required_votes gelijk aan total_members
UPDATE sessions
SET required_votes = total_members
WHERE required_votes IS NULL OR required_votes = 2;

-- ============================================
-- 2. NIEUWE RPC: check_and_create_match_v2
-- ============================================
-- Flexibele match functie die werkt met required_votes ipv total_members

CREATE OR REPLACE FUNCTION check_and_create_match_v2(
  p_session_id UUID,
  p_movie_id INTEGER,
  p_movie_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_required_votes INTEGER;
  v_likes_count INTEGER;
  v_match_exists BOOLEAN;
BEGIN
  -- Haal required votes op (ipv total_members)
  SELECT required_votes INTO v_required_votes
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

  -- Match als likes >= required_votes (ipv == total_members)
  IF v_likes_count >= v_required_votes AND NOT v_match_exists THEN
    INSERT INTO matches (session_id, movie_id, movie_data)
    VALUES (p_session_id, p_movie_id, p_movie_data);

    RETURN jsonb_build_object(
      'is_match', TRUE,
      'likes_count', v_likes_count,
      'required_votes', v_required_votes
    );
  END IF;

  RETURN jsonb_build_object(
    'is_match', FALSE,
    'likes_count', v_likes_count,
    'required_votes', v_required_votes
  );
END;
$$;

-- ============================================
-- 3. NIEUWE RPC: get_partial_matches
-- ============================================
-- Haal films op die door sommigen zijn geliked maar nog geen volledige match

CREATE OR REPLACE FUNCTION get_partial_matches(
  p_session_id UUID,
  p_min_votes INTEGER DEFAULT 1
)
RETURNS TABLE (
  movie_id INTEGER,
  likes_count BIGINT,
  movie_data JSONB,
  voters TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH liked_movies AS (
    SELECT
      s.movie_id,
      COUNT(*)::BIGINT as like_count,
      ARRAY_AGG(COALESCE(sm.user_name, 'Anoniem') ORDER BY s.swiped_at) as voter_names
    FROM swipes s
    LEFT JOIN session_members sm ON s.user_id = sm.user_id AND s.session_id = sm.session_id
    WHERE s.session_id = p_session_id
      AND s.swiped_right = TRUE
      -- Alleen films die NOG GEEN volledige match zijn
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE m.session_id = s.session_id
          AND m.movie_id = s.movie_id
      )
    GROUP BY s.movie_id
    HAVING COUNT(*) >= p_min_votes
  )
  SELECT
    lm.movie_id,
    lm.like_count,
    NULL::JSONB as movie_data,  -- We vullen dit client-side in met TMDB data
    lm.voter_names
  FROM liked_movies lm
  ORDER BY lm.like_count DESC;
END;
$$;

-- ============================================
-- 4. NIEUWE RPC: undo_last_swipe
-- ============================================
-- Maak laatste swipe ongedaan en verwijder match indien nodig

CREATE OR REPLACE FUNCTION undo_last_swipe(
  p_session_id UUID,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_swipe_id UUID;
  v_movie_id INTEGER;
  v_was_like BOOLEAN;
  v_required_votes INTEGER;
  v_remaining_likes INTEGER;
BEGIN
  -- Haal laatste swipe op
  SELECT id, movie_id, swiped_right
  INTO v_last_swipe_id, v_movie_id, v_was_like
  FROM swipes
  WHERE session_id = p_session_id
    AND user_id = p_user_id
  ORDER BY swiped_at DESC
  LIMIT 1;

  -- Check of er een swipe is om ongedaan te maken
  IF v_last_swipe_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Geen swipes om ongedaan te maken'
    );
  END IF;

  -- Verwijder swipe
  DELETE FROM swipes WHERE id = v_last_swipe_id;

  -- Als het een like was, check of match moet worden verwijderd
  IF v_was_like THEN
    -- Haal required votes op
    SELECT required_votes INTO v_required_votes
    FROM sessions WHERE id = p_session_id;

    -- Tel overgebleven likes
    SELECT COUNT(*) INTO v_remaining_likes
    FROM swipes
    WHERE session_id = p_session_id
      AND movie_id = v_movie_id
      AND swiped_right = TRUE;

    -- Verwijder match als er nu te weinig likes zijn
    IF v_remaining_likes < v_required_votes THEN
      DELETE FROM matches
      WHERE session_id = p_session_id
        AND movie_id = v_movie_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'movie_id', v_movie_id,
    'was_like', v_was_like,
    'message', 'Swipe ongedaan gemaakt'
  );
END;
$$;

-- ============================================
-- 5. NIEUWE RPC: get_member_swipe_counts
-- ============================================
-- Haal swipe counts op voor alle leden (voor member status tracking)

CREATE OR REPLACE FUNCTION get_member_swipe_counts(
  p_session_id UUID
)
RETURNS TABLE (
  user_id TEXT,
  user_name TEXT,
  swipe_count BIGINT,
  last_swipe_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.user_id,
    COALESCE(sm.user_name, 'Anoniem') as user_name,
    COUNT(s.id)::BIGINT as swipe_count,
    MAX(s.swiped_at) as last_swipe_at
  FROM session_members sm
  LEFT JOIN swipes s ON sm.user_id = s.user_id AND sm.session_id = s.session_id
  WHERE sm.session_id = p_session_id
  GROUP BY sm.user_id, sm.user_name
  ORDER BY sm.joined_at;
END;
$$;

-- ============================================
-- 6. NIEUWE RPC: update_session_filters
-- ============================================
-- Update session filters (voor host)

CREATE OR REPLACE FUNCTION update_session_filters(
  p_session_id UUID,
  p_streaming_providers TEXT[],
  p_genres TEXT[],
  p_max_certification TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sessions
  SET
    streaming_providers = p_streaming_providers,
    genres = p_genres,
    max_certification = p_max_certification
  WHERE id = p_session_id;

  RETURN FOUND;
END;
$$;

-- ============================================
-- 7. NIEUWE RPC: get_session_stats
-- ============================================
-- Haal sessie statistieken op voor matches pagina

CREATE OR REPLACE FUNCTION get_session_stats(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_swipes BIGINT;
  v_total_likes BIGINT;
  v_full_matches BIGINT;
  v_avg_match_rating NUMERIC;
BEGIN
  -- Tel totaal aantal swipes
  SELECT COUNT(*) INTO v_total_swipes
  FROM swipes
  WHERE session_id = p_session_id;

  -- Tel totaal aantal likes
  SELECT COUNT(*) INTO v_total_likes
  FROM swipes
  WHERE session_id = p_session_id
    AND swiped_right = TRUE;

  -- Tel volledige matches
  SELECT COUNT(*) INTO v_full_matches
  FROM matches
  WHERE session_id = p_session_id;

  -- Bereken gemiddelde rating van matches
  SELECT AVG((movie_data->>'vote_average')::NUMERIC) INTO v_avg_match_rating
  FROM matches
  WHERE session_id = p_session_id
    AND movie_data->>'vote_average' IS NOT NULL;

  RETURN jsonb_build_object(
    'total_swipes', v_total_swipes,
    'total_likes', v_total_likes,
    'full_matches', v_full_matches,
    'avg_match_rating', COALESCE(v_avg_match_rating, 0),
    'match_rate', CASE
      WHEN v_total_swipes > 0
      THEN ROUND((v_full_matches::NUMERIC / v_total_swipes * 100), 1)
      ELSE 0
    END
  );
END;
$$;

-- ============================================
-- VERIFICATIE QUERIES
-- ============================================
-- Voer deze uit om te checken of alles correct is aangemaakt

-- Check of required_votes kolom bestaat
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sessions'
  AND column_name = 'required_votes';

-- Check alle nieuwe RPC functies
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_and_create_match_v2',
    'get_partial_matches',
    'undo_last_swipe',
    'get_member_swipe_counts',
    'update_session_filters',
    'get_session_stats'
  )
ORDER BY routine_name;

-- ============================================
-- KLAAR!
-- ============================================
-- Na het uitvoeren van deze migration:
-- 1. Check de verificatie query outputs hierboven
-- 2. Als alles OK is, ga terug naar Claude Code
-- 3. Laat Claude weten dat de migration is uitgevoerd
-- 4. Dan kunnen we doorgaan met de frontend updates!

-- Expected output van verificatie:
-- - required_votes kolom met type INTEGER en default 2
-- - 6 RPC functies in de lijst
