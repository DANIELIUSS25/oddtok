# OddTok v6 — Perplexity AI Integration Setup

## How it works

Each market card in the OddTok feed now has a **"Why this is moving"** section powered by Perplexity AI. When you scroll to a card, OddTok:

1. Sends the event title + category to a Netlify serverless function
2. The function calls Perplexity's `sonar` model with a focused prompt
3. Returns 3 bullet points explaining recent news driving the market
4. Displays headline, bullets, sentiment tag, and source citations

Results are cached per market ID — scrolling back to a card won't re-fetch.

## Setup (5 minutes)

### 1. Get a Perplexity API Key
- Go to https://www.perplexity.ai/settings/api
- Create an API key
- Copy it

### 2. Add to Netlify Environment Variables
- Go to your Netlify site → **Site settings** → **Environment variables**
- Click **Add a variable**
- Key: `PERPLEXITY_API_KEY`
- Value: your API key from step 1
- Click **Save**

### 3. Redeploy
- Go to **Deploys** → **Trigger deploy** → **Deploy site**
- The serverless function at `/api/perplexity` will now be live

## Architecture

```
Browser (App.jsx)
  ↓ POST /api/perplexity
  ↓ { question, category }
  
Netlify Function (netlify/functions/perplexity.js)
  ↓ POST https://api.perplexity.ai/chat/completions
  ↓ Bearer PERPLEXITY_API_KEY (from env)
  
Perplexity API (sonar model)
  ↓ Returns structured JSON
  
Browser renders "Why this is moving" section
```

**API key is NEVER exposed to the browser.** The serverless function keeps it server-side.

## Graceful Degradation

If Perplexity is unavailable (no API key, rate limit, offline):
- Cards still render normally with all existing features
- The "Why this is moving" section simply doesn't appear
- Static bull/bear analysis (from the analysis pool) remains in the "More" expand
- No errors shown to the user

## Cost Estimate

- Perplexity `sonar` model: ~$0.001 per request
- Each card fetches once, then caches
- ~30 markets loaded per session = ~$0.03/session
- With 1000 daily users: ~$30/month
