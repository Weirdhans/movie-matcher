-- ============================================
-- MOVIE MATCHER - DATABASE SETUP
-- ============================================
-- Voer deze SQL statements uit in Supabase SQL Editor
-- https://supabase.com/dashboard/project/kjgoagtpjjyonujmsyvi/sql

-- ============================================
-- TABEL 1: SESSIONS
-- ============================================
-- Slaat informatie op over elke swipe-sessie (groep)

CREATE TABLE IF NOT EXISTS sessions (
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

-- ============================================
-- TABEL 2: SESSION_MEMBERS
-- ============================================
-- Houdt bij welke gebruikers deel uitmaken van een sessie

CREATE TABLE IF NOT EXISTS session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Anonieme ID uit localStorage
  user_name TEXT, -- Optionele naam ingevoerd door gebruiker
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, user_id)
);

-- ============================================
-- TABEL 3: SWIPES
-- ============================================
-- Registreert elke swipe actie van gebruikers

CREATE TABLE IF NOT EXISTS swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  movie_id INTEGER NOT NULL, -- TMDB movie ID
  swiped_right BOOLEAN NOT NULL, -- TRUE = like, FALSE = dislike
  swiped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, user_id, movie_id)
);

-- ============================================
-- TABEL 4: MATCHES
-- ============================================
-- Bevat films die door alle groepsleden geliked zijn

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  movie_data JSONB, -- Opgeslagen TMDB data (titel, poster, etc.)
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(session_id, movie_id)
);

-- ============================================
-- RPC FUNCTIE: CHECK_AND_CREATE_MATCH
-- ============================================
-- Deze functie wordt aangeroepen na elke 'like' swipe
-- om te controleren of er een match is

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

-- ============================================
-- INDEXES VOOR BETERE PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_session_members_session_id ON session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_swipes_session_id ON swipes(session_id);
CREATE INDEX IF NOT EXISTS idx_swipes_movie_id ON swipes(movie_id);
CREATE INDEX IF NOT EXISTS idx_matches_session_id ON matches(session_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - OPTIONEEL
-- ============================================
-- Als je RLS wilt gebruiken voor extra beveiliging:
-- (Voor deze app is het niet strikt noodzakelijk omdat alles via anon key gaat)

-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on session_members" ON session_members FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on swipes" ON swipes FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true);

-- ============================================
-- VERIFICATIE QUERIES
-- ============================================
-- Voer deze uit om te controleren of alles correct is aangemaakt:

-- Controleer tabellen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sessions', 'session_members', 'swipes', 'matches')
ORDER BY table_name;

-- Controleer RPC functie
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_and_create_match';

-- ============================================
-- KLAAR!
-- ============================================
-- Na het uitvoeren van deze queries:
-- 1. Ga naar Database > Replication in Supabase dashboard
-- 2. Schakel Realtime in voor de 'matches' tabel
-- 3. Start je lokale webserver en test de app!
