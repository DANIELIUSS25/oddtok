// OddTok Narrative Scanner — uses Perplexity to scan X/Twitter discussions
// Requires PERPLEXITY_API_KEY in Netlify env vars
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "PERPLEXITY_API_KEY not set" }) };

  let category;
  try { category = JSON.parse(event.body).category || "all"; } catch { category = "all"; }

  const catPrompts = {
    all: "AI, cryptocurrency, US elections, tech companies, and geopolitics",
    ai: "artificial intelligence, AI models, OpenAI, Anthropic, Google AI, AI regulation",
    crypto: "Bitcoin, Ethereum, Solana, crypto regulation, DeFi, NFTs, stablecoins",
    elections: "US elections, Trump, Biden, 2028 presidential race, Senate races, political polls",
    tech: "tech companies, Apple, Google, Microsoft, Tesla, Meta, startups, IPOs, layoffs",
    geopolitics: "US-China relations, Russia-Ukraine, NATO, Middle East, sanctions, military",
  };
  const topics = catPrompts[category] || catPrompts.all;

  const systemPrompt = `You are OddTok's narrative velocity scanner. You monitor X (Twitter) and social media for the hottest discussions in the last 6 hours.

Return ONLY valid JSON — no markdown, no backticks, no preamble:
{
  "narratives": [
    {
      "rank": 1,
      "title": "Short narrative headline (5-8 words)",
      "description": "One sentence explaining what's being discussed (15-25 words)",
      "category": "ai"|"crypto"|"elections"|"tech"|"geopolitics"|"finance",
      "velocity": 85-100 for rank 1, decreasing for lower ranks,
      "sentiment": "bullish"|"bearish"|"neutral"|"divided",
      "keyPhrases": ["phrase1", "phrase2", "phrase3"],
      "sampleTweet": "A realistic example of what people are posting (30-50 words)"
    }
  ],
  "scanTime": "current ISO timestamp",
  "totalNarratives": 10
}

Rules:
- Exactly 10 narratives, ranked by mention velocity (how fast discussion is spreading)
- velocity scores: #1 gets 90-100, #10 gets 30-45. Relative to each other.
- Each narrative must be SPECIFIC — cite names, numbers, events. Not generic.
- Focus on the last 6 hours of real discussion on X/Twitter
- keyPhrases should be actual hashtags or phrases trending
- sampleTweet should sound like a real X post (casual, opinionated, uses abbreviations)
- Categories must be one of: ai, crypto, elections, tech, geopolitics, finance`;

  const userPrompt = `Scan X (Twitter) for the last 6 hours. Find the top 10 fastest-spreading narratives about: ${topics}

Rank them by velocity — how fast the discussion is growing, not just total volume. A new story exploding in 2 hours beats an old story with steady mentions.

Return the JSON.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error: `API ${response.status}` }) };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ narratives: [], error: "parse_failed", raw: raw.slice(0, 200) }) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        narratives: (parsed.narratives || []).slice(0, 10),
        scanTime: parsed.scanTime || new Date().toISOString(),
        citations: data.citations || [],
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
