# VIBENT - Complete Implementation Guide

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

## Architecture Overview

```
Visitor ↔ Express Server (src/index.js)
         ↓
    Middleware Stack
    ├── Authentication (OAuth 2.0)
    ├── Rate Limiting
    ├── Session Management
    └── Error Handling
         ↓
Conversation Engine
├── Intent Classifier (AI/NLP)
├── Feature Router
└── State Manager
         ↓
    Plugs Integration Layer
    ├── TMDB (Movies)
    ├── Eventbrite (Events)
    ├── Amadeus (Travel)
    └── Spotify (Music)
```

## Core Components

### 1. Conversation Engine (`src/core/conversation-engine.js`)
Processes user messages, classifies intent, routes to appropriate feature.

```javascript
const processMessage = async (message, userId, sessionId) => {
  // 1. Analyze user intent
  const intent = await intentClassifier.classify(message);
  
  // 2. Route to appropriate handler
  const handler = getFeatureHandler(intent);
  
  // 3. Execute and format response
  const response = await handler.execute(message, userId);
  return formatResponse(response);
};
```

### 2. Intent Classifier (`src/core/intent-classifier.js`)
Uses AI/NLP to understand user queries.

**Intents handled:**
- `suggest_movie` → Suggest Something → Movies
- `suggest_book` → Suggest Something → Books
- `book_event` → Book an Event
- `plan_trip` → Weekend Trip Planner
- `find_events` → Event Planner
- `entertainment_genie` → Entertainment Genie (mood-based)

### 3. Session Manager (`src/core/session-manager.js`)
Maintains conversation context and user preferences.

**Session Structure:**
```javascript
{
  sessionId: "sess_xyz",
  userId: "user_123",
  createdAt: "2025-01-15T10:00:00Z",
  messages: [...],
  preferences: {
    favoriteGenres: [...],
    budgetRange: {...},
    preferences: {...}
  },
  lastActivity: "2025-01-15T10:15:00Z",
  ttl: 1800 // seconds
}
```

## API Plug Integrations (3+ Required Plugs)

### Plug 1: TMDB Movies API
**File:** `src/plugs/tmdb-plug.js`

```javascript
const getTMDBMovies = async (filters) => {
  const params = {
    api_key: process.env.TMDB_API_KEY,
    sort_by: filters.sortBy || 'popularity.desc',
    with_genres: filters.genres,
    vote_average_gte: filters.minRating
  };
  return axios.get(`${TMDB_BASE_URL}/discover/movie`, { params });
};
```

**Endpoints Used:**
- `GET /discover/movie` - Movie discovery
- `GET /search/movie` - Movie search
- `GET /movie/{id}` - Movie details

### Plug 2: Eventbrite Events API
**File:** `src/plugs/eventbrite-plug.js`

```javascript
const getEvents = async (location, interests) => {
  const response = await axios.get(
    `${EVENTBRITE_BASE_URL}/events/search`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        location: location,
        categories: mapInterests(interests),
        expand: 'venue,category'
      }
    }
  );
  return response.data.events;
};
```

**Features:**
- Event search by location
- Filter by category (Music, Tech, Comedy, etc)
- OAuth token refresh mechanism

### Plug 3: Amadeus Travel API
**File:** `src/plugs/amadeus-plug.js`

```javascript
const getTripPlans = async (city, budget, theme) => {
  const response = await axios.get(
    `${AMADEUS_BASE_URL}/v1/shopping/destinations`,
    {
      params: {
        keyword: city,
        max: 3
      }
    }
  );
  // Enrich with activities based on theme
  return enrichTripData(response.data, theme);
};
```

### Plug 4: Spotify Playlists API
**File:** `src/plugs/spotify-plug.js`

```javascript
const getPlaylist = async (mood, mood_description) => {
  const searchQuery = `mood:${mood_description}`;
  return axios.get(
    `${SPOTIFY_BASE_URL}/search`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: searchQuery,
        type: 'playlist',
        limit: 5
      }
    }
  );
};
```

## Feature Implementations

### Feature 1: Suggest Something
**File:** `src/features/suggest-something.js`

Flow:
1. Ask category: Movies, Books, Games, Food
2. Collect preferences (genre, rating, year)
3. Fetch from TMDB or similar
4. Return carousel with suggestions
5. Allow user to select

**Example Response:**
```json
{
  "type": "carousel",
  "suggestions": [
    {
      "id": "movie_123",
      "title": "Inception",
      "genre": "Sci-Fi",
      "rating": 8.8,
      "year": 2010,
      "image": "url",
      "cta": ["Watch Now", "Add to List"]
    }
  ]
}
```

### Feature 2: Book an Event
**File:** `src/features/book-event.js`

Flow:
1. Ask event type: Movies, TalkShow, Concerts
2. Location-based search
3. Display carousel
4. Handle booking

### Feature 3: Weekend Trip Planner
**File:** `src/features/weekend-trip-planner.js`

Flow:
1. Input: City, Budget, Theme
2. Fetch destinations (Amadeus)
3. AI generates itinerary
4. Return with Save/Share options

### Feature 4: Event Planner
**File:** `src/features/event-planner.js`

Flow:
1. Location + Interests
2. Fetch events
3. AI vibe descriptions
4. "What to Wear" suggestions

### Feature 5: Entertainment Genie ✨
**File:** `src/features/entertainment-genie.js`

Unique Feature - Vague queries → Creative experiences

```javascript
const generateMicroExperience = async (vague_query) => {
  // 1. Mood interpretation
  const mood = await interpretMood(vague_query);
  
  // 2. Get components
  const playlist = await getSpotifyPlaylist(mood);
  const activity = await generateActivity(mood);
  const nearby_event = await findNearbyEvent(mood);
  
  // 3. Combine
  return {
    micro_experience: mood.description,
    playlist: playlist.uri,
    activity: activity.suggestion,
    event: nearby_event.name
  };
};
```

## OAuth 2.0 Authentication

**File:** `src/auth/oauth-handler.js`

```javascript
const oauthFlow = async (provider, code) => {
  // 1. Exchange code for token
  const token_response = await axios.post(
    provider.token_endpoint,
    {
      client_id: process.env[`${provider}_CLIENT_ID`],
      client_secret: process.env[`${provider}_CLIENT_SECRET`],
      code: code,
      redirect_uri: process.env.OAUTH_REDIRECT_URI
    }
  );
  
  // 2. Store secure token
  await tokenManager.store(userId, token_response.tokens);
  
  // 3. Return access
  return { access_token: token_response.access_token };
};
```

## Error Handling & Resilience

**File:** `src/utils/error-handler.js`

```javascript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## AI Enhancements

**File:** `src/ai/llm-handler.js`

```javascript
const generateItin erary = async (destination, theme, budget) => {
  const prompt = `
Generate a 2-day itinerary for ${destination}.
Theme: ${theme}
Budget: $${budget}
Return JSON with: activities, timings, costs, descriptions
  `;
  
  return await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1000
  });
};
```

## Testing

```bash
npm test                 # All tests
npm run test:oauth       # OAuth flow tests
npm run test:flows       # Feature flow tests
```

## Deployment

**Docker:**
```bash
docker build -t vibent .
docker run -p 3000:3000 --env-file .env vibent
```

**To SalesIQ:**
- Follow `deployment/salesiq-deploy.md`
- Configure webhooks for bot events
- Set OAuth credentials in SalesIQ dashboard

## Performance Optimization

- Response Time Target: < 1 second
- API Latency: < 500ms per plug
- Caching: Redis for popular queries
- Rate Limiting: 100 requests per 15 minutes

## Key Files Summary

| File | Purpose |
|------|----------|
| `src/index.js` | Express server entry |
| `src/core/conversation-engine.js` | Main chat logic |
| `src/core/intent-classifier.js` | Intent detection |
| `src/plugs/*.js` | API integrations |
| `src/features/*.js` | Feature handlers |
| `src/auth/oauth-handler.js` | OAuth flows |
| `src/ai/llm-handler.js` | LLM integration |
| `src/middleware/rate-limiter.js` | Rate limiting |

## Documentation Files

- `README.md` - Project overview
- `IMPLEMENTATION.md` - This file
- `docs/API_DOCUMENTATION.md` - API endpoints
- `docs/OAUTH_GUIDE.md` - OAuth setup
- `docs/BOT_FLOWS.md` - Feature flows

---

**Project Status:** ✅ Ready for Deployment  
**Last Updated:** 2025-01-15  
**Version:** 1.0.0
