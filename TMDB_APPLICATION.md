# TMDB API Application Summary

## Application Information

**Application Name:** Movie Matcher

**Application Type:** Web Application

**Application URL:** (Will be deployed to Vercel/Netlify after development)

**Application Description:**

Movie Matcher is a collaborative film discovery web application that helps groups of people (families, friends, roommates) find movies they all want to watch together. Think of it as "Tinder for Movies" - users swipe through films, and when everyone in the group likes the same movie, it's a match!

## How We Use TMDB API

Our application uses The Movie Database (TMDB) API to:

1. **Discover Movies**: Fetch movies based on user-selected filters including:
   - Streaming providers available in the Netherlands (Netflix, Disney+, Prime Video, etc.)
   - Genre preferences (Action, Comedy, Drama, Animation, etc.)
   - Age ratings (Kijkwijzer certification system)
   - Popularity and vote count for quality assurance

2. **Display Movie Information**: Show users:
   - Movie posters and backdrop images
   - Titles (in Dutch when available)
   - Release years
   - User ratings (vote average)
   - Plot summaries/overviews
   - Genre tags

3. **Enhanced Features**:
   - Movie trailers (YouTube integration)
   - Streaming provider availability in the Netherlands
   - Links back to TMDB movie pages for more details

## Technical Implementation

- **Frontend**: HTML, CSS (Tailwind), JavaScript (Alpine.js)
- **Backend**: Supabase (PostgreSQL + Realtime)
- **API Usage**: Client-side TMDB API v3 calls
- **Target Audience**: Dutch-speaking users (nl-NL)
- **Region**: Netherlands (NL)

## API Endpoints Used

- `/discover/movie` - Main endpoint for filtered movie discovery
- `/movie/{movie_id}` - Detailed movie information
- `/movie/{movie_id}/videos` - Trailer videos
- `/movie/{movie_id}/watch/providers` - Streaming availability

## Attribution

We will prominently display "Powered by TMDB" logo on our application as required by TMDB's terms of service.

## API Key Usage

- **Type**: API Key (v3 auth)
- **Expected Usage**: Low to moderate (hobby/educational project)
- **Caching**: Yes, we implement client-side caching to minimize API calls
- **Rate Limiting**: We respect TMDB's rate limits

## Project Status

Currently in development. This is an open-source, non-commercial project aimed at making movie selection easier for groups.

## Contact

- **Developer**: Hans
- **Location**: Netherlands
- **Project Type**: Educational/Personal Project

---

## Quick Copy-Paste Summary for TMDB Form

**Application Summary:**
Movie Matcher is a collaborative web app that helps groups find movies to watch together. Users swipe through films filtered by streaming services, genres, and ratings. When everyone likes a movie, it's a match! We use TMDB API to discover movies, display posters/info, and show streaming availability in the Netherlands. Non-commercial educational project with TMDB attribution displayed.

**Application URL:**
In development - will be deployed to Vercel/Netlify

**What is the purpose of your application?**
To help groups of people (families, friends) collaboratively discover movies they all want to watch by swiping through TMDB's movie database with customizable filters.
