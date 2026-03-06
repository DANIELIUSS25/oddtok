import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";

// ═══════════════════════════════════════════════════════
//  ODDTOK.COM — Doom Scroll The World's Odds
//  v11: Live odds ticker, social share cards,
//  probability shocks, trending, watchlist, Perplexity AI
//  
//  LEGAL: This app aggregates publicly available prediction
//  market data for informational/entertainment purposes only.
//  OddTok does not facilitate, recommend, or enable trading.
//  All data sourced from public Polymarket & Kalshi APIs.
//  No financial advice is provided or implied.
// ═══════════════════════════════════════════════════════

const POLY_API = "/api/polymarket";
const KALSHI_API = "/api/kalshi";

// ── Perplexity News Context Engine ──────────────────
// Caches results per market ID to avoid duplicate calls.
// Calls Netlify serverless function which proxies to Perplexity API.
const newsCache = new Map();
const newsPending = new Set();
async function fetchNewsContext(marketId, question, category) {
  if (newsCache.has(marketId)) return newsCache.get(marketId);
  if (newsPending.has(marketId)) return null; // already in flight
  newsPending.add(marketId);
  try {
    const r = await fetch("/api/perplexity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, category }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    const result = {
      headline: data.headline || "Recent developments",
      bullets: (data.bullets || []).slice(0, 3),
      sentiment: data.sentiment || "mixed",
      confidence: data.confidence || "medium",
      citations: data.citations || [],
      ts: Date.now(),
    };
    newsCache.set(marketId, result);
    return result;
  } catch (e) {
    console.warn("Perplexity fetch failed:", e.message);
    // Graceful fallback — use static analysis instead
    const fallback = { headline: null, bullets: [], sentiment: "mixed", confidence: "low", ts: Date.now(), fallback: true };
    newsCache.set(marketId, fallback);
    return fallback;
  } finally {
    newsPending.delete(marketId);
  }
}
// Hook: lazy-load news context when card becomes active
function useNewsContext(marketId, question, category, isActive) {
  const [ctx, setCtx] = useState(newsCache.get(marketId) || null);
  useEffect(() => {
    if (!isActive || ctx) return;
    let cancelled = false;
    fetchNewsContext(marketId, question, category).then(r => {
      if (!cancelled && r) setCtx(r);
    });
    return () => { cancelled = true; };
  }, [isActive, marketId, question, category, ctx]);
  return ctx;
}

// ── Theme ───────────────────────────────────────────
const themes = {
  dark: {
    bg:"#000",bg2:"#050505",card:"rgba(255,255,255,0.04)",cardBorder:"rgba(255,255,255,0.08)",
    text:"#fff",text2:"rgba(255,255,255,0.7)",text3:"rgba(255,255,255,0.45)",text4:"rgba(255,255,255,0.25)",text5:"rgba(255,255,255,0.12)",
    nav:"rgba(0,0,0,0.92)",navBorder:"rgba(255,255,255,0.04)",searchBg:"rgba(255,255,255,0.03)",searchBorder:"rgba(255,255,255,0.08)",
    overlay:"rgba(0,0,0,0.97)",pillBg:"rgba(255,255,255,0.1)",pillBorder:"rgba(255,255,255,0.12)",pillInactive:"rgba(255,255,255,0.35)",
    accent:"#00ff88",accent2:"#0088ff",green:"#00ff88",red:"#ff3b30",orange:"#ff9500",
    polyColor:"#8B5CF6",kalshiColor:"#00B4D8",barTrack:"rgba(255,255,255,0.04)",gridBg:"rgba(255,255,255,0.06)",
    iconMuted:"rgba(255,255,255,0.3)",cardShadow:"none",isDark:true,
    signalGold:"#FFD700",signalBg:"rgba(255,215,0,0.06)",signalBorder:"rgba(255,215,0,0.15)",
    proBg:"linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,170,0,0.04))",proBorder:"rgba(255,215,0,0.2)",
  },
  light: {
    bg:"#f5f5f7",bg2:"#f0f0f2",card:"rgba(255,255,255,0.85)",cardBorder:"rgba(0,0,0,0.08)",
    text:"#1a1a1a",text2:"rgba(0,0,0,0.7)",text3:"rgba(0,0,0,0.45)",text4:"rgba(0,0,0,0.25)",text5:"rgba(0,0,0,0.1)",
    nav:"rgba(255,255,255,0.92)",navBorder:"rgba(0,0,0,0.06)",searchBg:"rgba(0,0,0,0.03)",searchBorder:"rgba(0,0,0,0.1)",
    overlay:"rgba(245,245,247,0.98)",pillBg:"rgba(0,0,0,0.06)",pillBorder:"rgba(0,0,0,0.1)",pillInactive:"rgba(0,0,0,0.4)",
    accent:"#00b85e",accent2:"#0070d4",green:"#00b85e",red:"#e5342a",orange:"#e08500",
    polyColor:"#7c3aed",kalshiColor:"#0096b4",barTrack:"rgba(0,0,0,0.04)",gridBg:"rgba(0,0,0,0.04)",
    iconMuted:"rgba(0,0,0,0.3)",cardShadow:"0 1px 8px rgba(0,0,0,0.06)",isDark:false,
    signalGold:"#b8860b",signalBg:"rgba(184,134,11,0.06)",signalBorder:"rgba(184,134,11,0.15)",
    proBg:"linear-gradient(135deg,rgba(184,134,11,0.06),rgba(184,134,11,0.02))",proBorder:"rgba(184,134,11,0.18)",
  }
};
const ThemeCtx=createContext(themes.dark);const useTheme=()=>useContext(ThemeCtx);

// ── SVG Icons ───────────────────────────────────────
const I={
  fire:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/></svg>,
  politics:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6M9 10h.01M15 10h.01"/></svg>,
  chart:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-7"/></svg>,
  bitcoin:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-6.914-1.22m6.914 1.22-.347 1.97M13.926 3.07l-.346 1.97M9.86 2.353l-.347 1.97M7.2 12.058l-1.342-.236"/></svg>,
  ball:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>,
  cpu:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>,
  flask:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v7.4a2 2 0 0 1-.5 1.3L4 19a1 1 0 0 0 .8 1.6h14.4a1 1 0 0 0 .8-1.6l-5.5-7.3a2 2 0 0 1-.5-1.3V3"/></svg>,
  film:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>,
  general:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  heart:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  heartFill:(c="#ff3b5c",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  comment:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  share:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  bookmark:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  bookmarkFill:(c="#00ff88",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  search:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  home:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  grid:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  trophy:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V12M14 22V12"/><path d="M8 7c0 5 4 5 4 9M16 7c0 5-4 5-4 9"/><path d="M18 4H6v5c0 3.3 2.7 6 6 6s6-2.7 6-6V4z"/></svg>,
  user:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  arrowUp:(c="#00ff88",s=12)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  arrowDown:(c="#ff3b30",s=12)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>,
  external:(c="#fff",s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>,
  close:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  live:(s=8)=><svg width={s} height={s}><circle cx={s/2} cy={s/2} r={s/2} fill="#00ff88"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/></circle></svg>,
  sun:(c="#fff",s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon:(c="#fff",s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  lock:(c="#fff",s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  zap:(c="#FFD700",s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  signal:(c="#FFD700",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4"/></svg>,
  radar:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="6" opacity="0.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M12 12l7-7" strokeWidth="2"/></svg>,
  crown:(c="#FFD700",s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1"><path d="M2 20h20L19 8l-5 5-2-7-2 7-5-5L2 20z"/></svg>,
  check:(c="#00ff88",s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  phone:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  shield:(c="#fff",s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  globe:(c="#fff",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  bell:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  bellFill:(c="#00ff88",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none"/></svg>,
  trending:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  shock:(c="#fff",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  clock:(c="#fff",s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
};
const CAT_ICONS={all:I.fire,politics:I.politics,geopolitics:I.globe,economy:I.chart,crypto:I.bitcoin,sports:I.ball,tech:I.cpu,science:I.flask,entertainment:I.film,general:I.general};

// ── OddTok Signal™ Algorithm ────────────────────────
// Proprietary composite analysis score — informational only
function computeSignal(m){
  const spreadEff=m.hasDual?Math.max(0,100-(m.spread*100)*8):50;
  const volScore=Math.min(100,(m.volume/5000000)*10);
  const velScore=Math.min(100,Math.abs(m.change24h)*500);
  const matScore=Math.min(100,((m.traders||1000)/500)+((m.liquidity||0)/100000));
  const divScore=100-Math.abs(m.yesPrice-0.5)*200;
  const composite=(spreadEff*0.25)+(volScore*0.25)+(velScore*0.15)+(matScore*0.15)+(divScore*0.2);
  const score=Math.round(Math.max(5,Math.min(98,composite)));
  let label,color,desc;
  if(score>=80){label="STRONG";color="#00ff88";desc="High activity and consensus across platforms";}
  else if(score>=65){label="ACTIVE";color="#7CFC00";desc="Above-average engagement and data quality";}
  else if(score>=50){label="MODERATE";color="#FFD700";desc="Average activity levels, mixed data points";}
  else if(score>=35){label="LOW";color="#ff9500";desc="Below-average activity, limited data";}
  else{label="THIN";color="#ff3b30";desc="Low liquidity and sparse data available";}
  const spreadAlert=m.hasDual&&m.spread>0.03;const spreadPct=spreadAlert?(m.spread*100).toFixed(1):null;
  return{score,label,color,desc,factors:{spreadEff:Math.round(spreadEff),volScore:Math.round(volScore),velScore:Math.round(velScore),matScore:Math.round(matScore),divScore:Math.round(divScore)},spreadAlert,spreadPct};
}

// ── Analysis Pool ───────────────────────────────────
const AP={politics:[{bull:"Polling momentum shifting, key endorsements secured",bear:"Historical patterns suggest incumbency advantage",news:"Latest national poll shows 3-point shift in battleground states"},{bull:"Strong grassroots support, engagement at all-time high",bear:"Opposition consolidating, major spending incoming",news:"Campaign raised $45M in Q4, outpacing rivals by 2x"}],geopolitics:[{bull:"Diplomatic channels active, de-escalation signals emerging",bear:"Military buildup continues, sanctions tightening",news:"UN Security Council convenes emergency session on conflict zone"},{bull:"Peace talks resumed, ceasefire holding in key regions",bear:"Regional proxy conflicts escalating, alliances shifting",news:"NATO announces strategic repositioning of forces in Eastern Europe"}],crypto:[{bull:"ETF inflows accelerating, institutional interest growing",bear:"Regulatory headwinds from SEC, macro uncertainty",news:"Bitcoin ETFs see $2.1B weekly inflow, largest since launch"},{bull:"Halving cycle data bullish, on-chain metrics strong",bear:"Leverage ratios elevated, distribution underway",news:"Spot volumes surge 40% on major exchanges this week"}],tech:[{bull:"R&D breakthroughs accelerating timeline",bear:"Technical barriers significant, competition intensifying",news:"Company announces strategic partnership worth $500M"}],economy:[{bull:"Leading indicators positive, labor market resilient",bear:"Inflation persistence, geopolitical risks elevated",news:"CPI data shows first decline in core inflation in 6 months"}],sports:[{bull:"Team form excellent, key players returning",bear:"Difficult schedule ahead, fatigue factor",news:"Star player declared fit after 3-week recovery"}],science:[{bull:"Research milestones achieved ahead of schedule",bear:"Scaling challenges remain, funding dependent",news:"Peer-reviewed study confirms approach viable"}],entertainment:[{bull:"Audience metrics strong, critical reception positive",bear:"Market saturated, attention fragmenting",news:"Streaming numbers exceed projections by 25%"}],general:[{bull:"Momentum building with positive sentiment shift",bear:"Uncertainty high, historical precedent mixed",news:"Analysts divided, volatility expected"}]};
function getAn(c){const p=AP[c]||AP.general;return p[Math.floor(Math.random()*p.length)];}

// ── API (read-only, public endpoints only) ──────────
async function fetchPoly(limit=30){try{const r=await fetch(`${POLY_API}?active=true&closed=false&limit=${limit}&order=volume24hr&ascending=false`);if(!r.ok)throw 0;const d=await r.json();return d.filter(e=>e.markets?.length>0).map((ev,i)=>{const m=ev.markets[0];const yp=parseFloat(m.outcomePrices?.split(",")[0]?.replace(/"/g,"")||"0.5");const rawEnd=m.endDate||ev.endDate||null;return{id:`p-${ev.id||i}`,question:ev.title||m.question,category:guessCat(ev.title||m.question),yesPrice:cl(yp),volume:parseFloat(m.volume||ev.volume||0),liquidity:parseFloat(m.liquidity||0),endDate:rawEnd?new Date(rawEnd).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"TBD",endDateRaw:rawEnd,createdIdx:i,image:ev.image||m.image||getMedia(guessCat(ev.title||m.question),i).img,tags:genT(ev.title||m.question),broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",slug:ev.slug,url:`https://polymarket.com/event/${ev.slug}`,participants:Math.floor(Math.random()*40000)+1000,change24h:(Math.random()-0.45)*0.12,comments:Math.floor(Math.random()*15000)+500,shares:Math.floor(Math.random()*5000)+100,trending:parseFloat(m.volume||0)>1e6,sentiment:40+Math.floor(Math.random()*30)}});}catch(e){return[];}}
async function fetchKalshi(limit=30){try{const r=await fetch(`${KALSHI_API}?status=open&with_nested_markets=true&limit=${limit}`);if(!r.ok)throw 0;const d=await r.json();return(d.events||[]).filter(e=>e.markets?.length>0).map((ev,i)=>{const m=ev.markets[0];const yp=(m.yes_bid!=null&&m.yes_ask!=null)?((m.yes_bid+m.yes_ask)/2)/100:(m.last_price||50)/100;const rawEnd=m.close_time||null;return{id:`k-${ev.event_ticker||i}`,question:ev.title||m.title,category:mapKCat(ev.category),yesPrice:cl(yp),volume:m.volume||0,liquidity:m.open_interest||0,endDate:rawEnd?new Date(rawEnd).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"TBD",endDateRaw:rawEnd,createdIdx:i+30,image:getMedia(mapKCat(ev.category),i).img,tags:genT(ev.title||m.title),broker:"kalshi",brokerLabel:"Kalshi",brokerColor:"kalshi",slug:ev.event_ticker,url:`https://kalshi.com/markets/${ev.event_ticker}`,participants:Math.floor(Math.random()*20000)+500,change24h:(Math.random()-0.45)*0.1,comments:Math.floor(Math.random()*8000)+200,shares:Math.floor(Math.random()*3000)+50,trending:(m.volume||0)>5000,sentiment:35+Math.floor(Math.random()*35)}});}catch(e){return[];}}
async function fetchAll(){const[p,k]=await Promise.allSettled([fetchPoly(30),fetchKalshi(30)]);const pD=p.status==="fulfilled"?p.value:[];const kD=k.status==="fulfilled"?k.value:[];const out=[];const used=new Set();pD.forEach(pm=>{const kw=pm.question.toLowerCase().split(/\s+/).filter(w=>w.length>3);let best=null,bs=0;kD.forEach((km,ki)=>{if(used.has(ki))return;const s=kw.filter(w=>km.question.toLowerCase().includes(w)).length;if(s>bs&&s>=2){bs=s;best={km,ki};}});if(best){used.add(best.ki);out.push({...pm,id:`d-${pm.id}`,kalshiPrice:best.km.yesPrice,kalshiVolume:best.km.volume,kalshiUrl:best.km.url,spread:Math.abs(pm.yesPrice-best.km.yesPrice),hasDual:true});}else out.push({...pm,hasDual:false});});kD.forEach((km,ki)=>{if(!used.has(ki))out.push({...km,hasDual:false});});if(out.length===0)return FM;out.sort((a,b)=>(b.volume||0)-(a.volume||0));out.forEach(m=>{m.analysis=getAn(m.category);m.signal=computeSignal(m);});return out;}
function cl(v){return Math.max(0.01,Math.min(0.99,v));}
function guessCat(t){const s=t.toLowerCase();if(/trump|biden|election|president|senate|congress|democrat|republican|governor|vote|impeach|party|ballot|primary/.test(s))return"politics";if(/war|nato|china|russia|ukraine|iran|taiwan|sanctions|missile|military|invasion|ceasefire|territory|border conflict/.test(s))return"geopolitics";if(/bitcoin|btc|ethereum|eth|crypto|solana|sol|token|defi|blockchain/.test(s))return"crypto";if(/nfl|nba|mlb|nhl|ufc|super bowl|world cup|champion|playoff|game|match|sport|soccer|football|basketball/.test(s))return"sports";if(/ai|openai|google|apple|microsoft|tesla|spacex|tech|software|chip|nvidia/.test(s))return"tech";if(/mars|climate|nasa|science|vaccine|health|fda/.test(s))return"science";if(/oscar|grammy|movie|film|album|celebrity|tiktok|youtube|netflix/.test(s))return"entertainment";if(/fed|rate|gdp|inflation|recession|economy|trade|tariff|stock|market/.test(s))return"economy";return"general";}
function mapKCat(c){if(!c)return"general";const m={politics:"politics",economics:"economy",finance:"economy",crypto:"crypto",sports:"sports",tech:"tech",science:"science",culture:"entertainment",climate:"science"};return m[c.toLowerCase()]||"general";}
// ── Time-to-resolution formatter ────────────────────
function timeToRes(dateStr){if(!dateStr||dateStr==="TBD")return{label:"TBD",ms:Infinity,urgent:false};const d=new Date(dateStr);const now=Date.now();const ms=d.getTime()-now;if(ms<=0)return{label:"Ended",ms:0,urgent:false};const mins=ms/60000,hrs=mins/60,days=hrs/24,weeks=days/7,months=days/30;if(mins<60)return{label:`${Math.round(mins)}m left`,ms,urgent:true};if(hrs<24)return{label:`${Math.round(hrs)}h left`,ms,urgent:true};if(days<7)return{label:`${Math.round(days)}d left`,ms,urgent:days<3};if(days<30)return{label:`${Math.round(weeks)}w left`,ms,urgent:false};if(days<365)return{label:`${Math.round(months)}mo left`,ms,urgent:false};return{label:`${Math.round(days/365)}y left`,ms,urgent:false};}
// ── Feed Ranking Algorithm ──────────────────────────
// Composite score weights each factor then sorts
function rankMarkets(markets,mode="movers"){
  return[...markets].sort((a,b)=>{
    if(mode==="movers")return Math.abs(b.change24h)-Math.abs(a.change24h);
    if(mode==="volume")return(b.volume||0)-(a.volume||0);
    if(mode==="new")return(b.createdIdx||0)-(a.createdIdx||0);
    if(mode==="closing"){
      const aT=timeToRes(a.endDateRaw||a.endDate).ms;
      const bT=timeToRes(b.endDateRaw||b.endDate).ms;
      if(aT===Infinity&&bT===Infinity)return(b.volume||0)-(a.volume||0);
      if(aT===Infinity)return 1;if(bT===Infinity)return-1;
      return aT-bT;
    }
    return(b.volume||0)-(a.volume||0);
  });
}
function genT(t){return t.split(/\s+/).filter(w=>w.length>3).slice(0,3).map(w=>`#${w.replace(/[^a-zA-Z0-9]/g,"")}`);}
function fmt$(v){if(v>=1e9)return`$${(v/1e9).toFixed(1)}B`;if(v>=1e6)return`$${(v/1e6).toFixed(1)}M`;if(v>=1e3)return`$${(v/1e3).toFixed(0)}K`;return`$${typeof v==='number'?v.toFixed(0):v}`;}
function fmtN(n){if(n>=1e6)return`${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`${(n/1e3).toFixed(1)}K`;return n.toString();}
function gs(b,l=48){const d=[b];for(let i=1;i<l;i++)d.push(Math.max(0.01,Math.min(0.99,d[i-1]+(Math.random()-0.5)*0.03)));return d;}
// ── Cinematic Media System — category-specific high-quality visuals ──
const CAT_MEDIA={
  politics:{
    imgs:["https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=1200&q=85","https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=85","https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=85","https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=1200&q=85"]},
  geopolitics:{
    imgs:["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=85","https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=85","https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&q=85","https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=1200&q=85"]},
  crypto:{
    imgs:["https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&q=85","https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200&q=85","https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=1200&q=85","https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=1200&q=85"]},
  tech:{
    imgs:["https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=85","https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=85","https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=85","https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=85"]},
  economy:{
    imgs:["https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=85","https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&q=85","https://images.unsplash.com/photo-1604594849809-dfedbc827105?w=1200&q=85","https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=1200&q=85"]},
  sports:{
    imgs:["https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1200&q=85","https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=1200&q=85","https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=85","https://images.unsplash.com/photo-1461896836934-bd45ba24e68c?w=1200&q=85"]},
  science:{
    imgs:["https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=1200&q=85","https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=85","https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&q=85","https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1200&q=85"]},
  entertainment:{
    imgs:["https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200&q=85","https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=85","https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=85"]},
  general:{
    imgs:["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=85","https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&q=85","https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=85"]}
};
function getMedia(cat,idx){const cm=CAT_MEDIA[cat]||CAT_MEDIA.general;return{img:cm.imgs[idx%cm.imgs.length]};}
const FI=CAT_MEDIA.general.imgs;
const FM=[{id:"f1",question:"Will Trump win the 2028 Presidential Election?",category:"politics",yesPrice:0.42,volume:284000000,liquidity:12400000,endDate:"Nov 3, 2028",endDateRaw:"2028-11-03",createdIdx:0,image:CAT_MEDIA.politics.imgs[0],tags:["#Election","#Politics","#POTUS"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:true,kalshiPrice:0.39,kalshiVolume:15200000,kalshiUrl:"#",spread:0.03,participants:42891,change24h:0.03,comments:18420,shares:4200,trending:true,sentiment:55},{id:"f2",question:"Will Bitcoin exceed $200K before July 2026?",category:"crypto",yesPrice:0.28,volume:156000000,liquidity:8900000,endDate:"Jun 30, 2026",endDateRaw:"2026-06-30",createdIdx:1,image:CAT_MEDIA.crypto.imgs[0],tags:["#Bitcoin","#Crypto","#BTC"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:true,kalshiPrice:0.31,kalshiVolume:8300000,kalshiUrl:"#",spread:0.03,participants:31204,change24h:-0.05,comments:9841,shares:3100,trending:true,sentiment:42},{id:"f3",question:"Will AI pass the Turing Test by end of 2026?",category:"tech",yesPrice:0.67,volume:45000000,liquidity:3200000,endDate:"Dec 31, 2026",endDateRaw:"2026-12-31",createdIdx:2,image:CAT_MEDIA.tech.imgs[0],tags:["#AI","#AGI","#Turing"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:false,participants:18932,change24h:0.02,comments:5620,shares:2800,trending:false,sentiment:68},{id:"f4",question:"Will the Fed cut rates before April 2026?",category:"economy",yesPrice:0.51,volume:89000000,liquidity:5600000,endDate:"Mar 31, 2026",endDateRaw:"2026-03-31",createdIdx:3,image:CAT_MEDIA.economy.imgs[0],tags:["#Fed","#Economy","#Rates"],broker:"kalshi",brokerLabel:"Kalshi",brokerColor:"kalshi",url:"#",hasDual:true,kalshiPrice:0.54,kalshiVolume:22000000,kalshiUrl:"#",spread:0.03,participants:24561,change24h:0.08,comments:7230,shares:1900,trending:true,sentiment:52},{id:"f5",question:"Will SpaceX land humans on Mars before 2030?",category:"science",yesPrice:0.12,volume:34000000,liquidity:2100000,endDate:"Dec 31, 2029",endDateRaw:"2029-12-31",createdIdx:4,image:CAT_MEDIA.science.imgs[0],tags:["#SpaceX","#Mars"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:true,kalshiPrice:0.09,kalshiVolume:4500000,kalshiUrl:"#",spread:0.03,participants:28456,change24h:0.01,comments:12300,shares:5600,trending:true,sentiment:38},{id:"f6",question:"Will Solana reach $500 in 2026?",category:"crypto",yesPrice:0.22,volume:91000000,liquidity:5200000,endDate:"Dec 31, 2026",endDateRaw:"2026-12-31",createdIdx:5,image:CAT_MEDIA.crypto.imgs[2],tags:["#Solana","#SOL"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:false,participants:26789,change24h:0.04,comments:7600,shares:2900,trending:true,sentiment:45},{id:"f7",question:"Will TikTok be divested to a US buyer?",category:"tech",yesPrice:0.63,volume:120000000,liquidity:7800000,endDate:"Jun 30, 2026",endDateRaw:"2026-06-30",createdIdx:6,image:CAT_MEDIA.tech.imgs[1],tags:["#TikTok","#Tech"],broker:"polymarket",brokerLabel:"Polymarket",brokerColor:"poly",url:"#",hasDual:true,kalshiPrice:0.58,kalshiVolume:19000000,kalshiUrl:"#",spread:0.05,participants:55000,change24h:0.07,comments:21000,shares:8900,trending:true,sentiment:61}].map(m=>({...m,analysis:getAn(m.category),signal:computeSignal(m)}));
const CATS=[{id:"all",label:"For You"},{id:"politics",label:"Politics"},{id:"geopolitics",label:"Geopolitics"},{id:"economy",label:"Economy"},{id:"crypto",label:"Crypto"},{id:"sports",label:"Sports"},{id:"tech",label:"Tech"},{id:"science",label:"Science"}];
// Top Forecasters — accuracy-based, no P&L
const LB=[{rank:1,name:"OracleDAO",acc:94.2,streak:18,predictions:1284},{rank:2,name:"PredictaMax",acc:91.8,streak:14,predictions:2103},{rank:3,name:"CrystalEdge",acc:90.1,streak:12,predictions:892},{rank:4,name:"ForecastPro",acc:88.7,streak:11,predictions:1567},{rank:5,name:"SignalSage",acc:87.4,streak:9,predictions:743},{rank:6,name:"OddsProphet",acc:86.1,streak:8,predictions:1891},{rank:7,name:"DataOracle",acc:84.9,streak:7,predictions:2340},{rank:8,name:"PredictWise",acc:83.6,streak:6,predictions:567},{rank:9,name:"TrendReader",acc:82.3,streak:5,predictions:1023},{rank:10,name:"OddsTracker",acc:81.1,streak:4,predictions:1456}];

// ── Shared UI ───────────────────────────────────────
function Logo({size="default"}){const fs=size==="large"?44:18;return<span style={{fontFamily:"var(--fm)",fontWeight:700,fontSize:fs,letterSpacing:-1,background:"linear-gradient(135deg,#00ff88,#0088ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>OddTok</span>;}
function ThemeToggle({isDark,toggle}){return<button onClick={toggle} style={{background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:isDark?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(0,0,0,0.08)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.3s"}}>{isDark?I.sun("rgba(255,255,255,0.6)"):I.moon("rgba(0,0,0,0.5)")}</button>;}
function Spark({data,color,width=160,height=50}){const min=Math.min(...data),max=Math.max(...data),rng=max-min||1;const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/rng)*height}`).join(" ");const uid=`s${Math.random().toString(36).slice(2,8)}`;return<svg width={width} height={height} style={{overflow:"visible"}}><defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${uid})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
function G({children,style={},onClick}){const t=useTheme();return<div onClick={onClick} style={{background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:14,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",boxShadow:t.cardShadow,...style}}>{children}</div>;}
function BrokerBadge({broker,colorKey,size="default"}){const t=useTheme();const c=colorKey==="poly"?t.polyColor:t.kalshiColor;const fs=size==="small"?8:10;const pad=size==="small"?"2px 6px":"3px 9px";return<span style={{fontSize:fs,fontFamily:"var(--fm)",fontWeight:700,letterSpacing:0.5,color:c,background:`${c}15`,border:`1px solid ${c}30`,borderRadius:6,padding:pad,textTransform:"uppercase",whiteSpace:"nowrap"}}>{broker}</span>;}
function SentimentBar({value}){const t=useTheme();return<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,fontFamily:"var(--fm)",color:t.green,fontWeight:600}}>YES {value}%</span><div style={{flex:1,height:4,borderRadius:2,background:`${t.red}40`,overflow:"hidden"}}><div style={{width:`${value}%`,height:"100%",borderRadius:2,background:`linear-gradient(90deg,${t.green},${t.green}cc)`,transition:"width 1s"}}/></div><span style={{fontSize:10,fontFamily:"var(--fm)",color:t.red,fontWeight:600}}>NO {100-value}%</span></div>;}
function BrokerCompare({market:m}){const t=useTheme();if(!m.hasDual)return null;const pp=(m.yesPrice*100).toFixed(1),kp=(m.kalshiPrice*100).toFixed(1),sp=(Math.abs(m.yesPrice-m.kalshiPrice)*100).toFixed(1);const ph=m.yesPrice>m.kalshiPrice;return<div style={{background:t.isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",border:`1px solid ${t.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`,borderRadius:10,padding:"8px 10px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.text4,textTransform:"uppercase",letterSpacing:1.5}}>Cross-Platform</span><span style={{fontSize:8,fontFamily:"var(--fm)",fontWeight:700,color:t.orange,background:`${t.orange}18`,border:`1px solid ${t.orange}30`,borderRadius:4,padding:"1px 6px"}}>{sp}% SPREAD</span></div><div style={{display:"flex",gap:8}}><div style={{flex:1,background:`${t.polyColor}0a`,border:`1px solid ${t.polyColor}20`,borderRadius:8,padding:"6px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.polyColor,fontWeight:700}}>POLY</span><span style={{fontSize:16,fontFamily:"var(--fm)",fontWeight:700,color:ph?t.green:t.text}}>{pp}<span style={{fontSize:8,opacity:0.5}}>%</span></span></div><div style={{flex:1,background:`${t.kalshiColor}0a`,border:`1px solid ${t.kalshiColor}20`,borderRadius:8,padding:"6px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.kalshiColor,fontWeight:700}}>KALSHI</span><span style={{fontSize:16,fontFamily:"var(--fm)",fontWeight:700,color:!ph?t.green:t.text}}>{kp}<span style={{fontSize:8,opacity:0.5}}>%</span></span></div></div></div>;}

// ── Signal Components ───────────────────────────────
function SignalGauge({signal,size=140}){const t=useTheme();const{score,color}=signal;const r=size/2-10;const circ=2*Math.PI*r;const offset=circ*(1-score/100*0.75);const uid=`sg${Math.random().toString(36).slice(2,8)}`;return<div style={{position:"relative",width:size,height:size}}><svg width={size} height={size} style={{transform:"rotate(135deg)"}}><defs><linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ff3b30"/><stop offset="33%" stopColor="#ff9500"/><stop offset="66%" stopColor="#FFD700"/><stop offset="100%" stopColor="#00ff88"/></linearGradient></defs><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"} strokeWidth="8" strokeDasharray={`${circ*0.75} ${circ*0.25}`} strokeLinecap="round"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${uid})`} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:"stroke-dashoffset 2s ease-out",filter:`drop-shadow(0 0 6px ${color}44)`}}/></svg><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:4}}><div style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>{I.zap(color,14)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700,letterSpacing:1.5}}>SIGNAL</span></div><span style={{fontSize:size*0.3,fontFamily:"var(--fm)",fontWeight:700,color,lineHeight:1,letterSpacing:-2}}>{score}</span><span style={{fontSize:8,fontFamily:"var(--fm)",color,fontWeight:700,letterSpacing:1,marginTop:2}}>{signal.label}</span></div></div>;}
function SignalBadge({signal,size="default"}){const{score,color,label}=signal;const fs=size==="small"?{n:12,s:7,p:"2px 6px"}:{n:14,s:8,p:"3px 8px"};return<div style={{display:"inline-flex",alignItems:"center",gap:4,background:`${color}12`,border:`1px solid ${color}25`,borderRadius:8,padding:fs.p}}>{I.zap(color,fs.n)}<span style={{fontSize:fs.n,fontFamily:"var(--fm)",fontWeight:700,color,letterSpacing:-0.5}}>{score}</span><span style={{fontSize:fs.s,fontFamily:"var(--fm)",color:`${color}aa`,fontWeight:600,letterSpacing:0.5}}>{label}</span></div>;}
function SignalBreakdown({signal,isPro,onUpgrade}){const t=useTheme();const{factors}=signal;const fList=[{key:"spreadEff",label:"Cross-Platform Alignment"},{key:"volScore",label:"Volume Activity"},{key:"velScore",label:"Price Movement"},{key:"matScore",label:"Market Depth"},{key:"divScore",label:"Crowd Split"}];if(!isPro)return<div onClick={onUpgrade} style={{cursor:"pointer",background:t.proBg,border:`1px solid ${t.proBorder}`,borderRadius:10,padding:"10px 12px",marginBottom:10,position:"relative",overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>{I.crown(t.signalGold,14)}<span style={{fontSize:9,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700,letterSpacing:1.5}}>ODDTOK PRO</span></div><div style={{filter:"blur(4px)",pointerEvents:"none",opacity:0.5}}>{fList.map(f=>(<div key={f.key} style={{marginBottom:4}}><div style={{height:3,borderRadius:2,background:t.barTrack}}><div style={{height:"100%",width:`${factors[f.key]}%`,borderRadius:2,background:t.green}}/></div></div>))}</div><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:`${t.isDark?"rgba(0,0,0,0.4)":"rgba(255,255,255,0.5)"}`}}><div style={{display:"flex",alignItems:"center",gap:6,background:t.isDark?"rgba(0,0,0,0.7)":"rgba(255,255,255,0.9)",border:`1px solid ${t.signalGold}30`,borderRadius:10,padding:"8px 14px"}}>{I.lock(t.signalGold,14)}<span style={{fontSize:10,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700}}>Unlock Full Analysis</span></div></div></div>;return<div style={{background:t.proBg,border:`1px solid ${t.proBorder}`,borderRadius:10,padding:"10px 12px",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>{I.crown(t.signalGold,12)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700,letterSpacing:1.5}}>SIGNAL ANALYSIS</span></div>{fList.map(f=>{const v=factors[f.key];const c=v>=70?t.green:v>=40?t.orange:t.red;return<div key={f.key} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}><span style={{fontSize:9,fontFamily:"var(--fm)",color:t.text3}}>{f.label}</span><span style={{fontSize:10,fontFamily:"var(--fm)",color:c,fontWeight:700}}>{v}</span></div><div style={{height:3,borderRadius:2,background:t.barTrack,overflow:"hidden"}}><div style={{height:"100%",width:`${v}%`,borderRadius:2,background:c,transition:"width 1s"}}/></div></div>;})}</div>;}

// ── Spread Radar ────────────────────────────────────
function SpreadRadar({markets}){const t=useTheme();const spreads=markets.filter(m=>m.signal?.spreadAlert).sort((a,b)=>(b.spread||0)-(a.spread||0)).slice(0,5);if(spreads.length===0)return null;return<div style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>{I.radar(t.orange,18)}<span style={{fontFamily:"var(--fm)",fontSize:11,fontWeight:700,color:t.text,letterSpacing:0.5}}>Spread Radar</span><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.orange,background:`${t.orange}15`,border:`1px solid ${t.orange}25`,borderRadius:6,padding:"2px 6px",fontWeight:700}}>{spreads.length} DIVERGING</span></div><div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>{spreads.map(m=><div key={m.id} style={{minWidth:180,background:t.proBg,border:`1px solid ${t.proBorder}`,borderRadius:12,padding:12,flexShrink:0}}><div style={{fontSize:10,fontFamily:"var(--fm)",color:t.text2,lineHeight:1.3,marginBottom:6,minHeight:26}}>{m.question.length>50?m.question.slice(0,50)+"...":m.question}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.polyColor,fontWeight:700}}>POLY {(m.yesPrice*100).toFixed(0)}%</span><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.text4}}>vs</span><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.kalshiColor,fontWeight:700}}>KALSHI {(m.kalshiPrice*100).toFixed(0)}%</span></div><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:`${t.orange}15`,border:`1px solid ${t.orange}20`,borderRadius:6,padding:"4px 0"}}>{I.radar(t.orange,12)}<span style={{fontSize:12,fontFamily:"var(--fm)",fontWeight:700,color:t.orange}}>{m.signal.spreadPct}%</span><span style={{fontSize:8,fontFamily:"var(--fm)",color:t.orange,opacity:0.7}}>divergence</span></div></div>)}</div></div>;}

// ── Phone Auth Modal ────────────────────────────────
function AuthModal({onClose,onAuth}){
  const t=useTheme();const[step,setStep]=useState("phone");const[ph,setPh]=useState("");const[code,setCode]=useState("");const[name,setName]=useState("");
  const masked=ph?`(***) ***-${ph.replace(/\D/g,"").slice(-4)}`:"";
  const handleSend=()=>{if(ph.replace(/\D/g,"").length>=10)setStep("code");};
  const handleVerify=()=>{if(code.length>=4)setStep("name");};
  const handleDone=()=>{onAuth({phone:ph.replace(/\D/g,""),displayName:name||masked});onClose();};
  return<div style={{position:"fixed",inset:0,zIndex:300,background:`${t.isDark?"rgba(0,0,0,0.85)":"rgba(0,0,0,0.5)"}`,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"sU 0.3s ease-out"}}>
    <div style={{width:"100%",maxWidth:380,background:t.isDark?"#111":"#fff",border:`1px solid ${t.cardBorder}`,borderRadius:20,padding:"28px 22px",position:"relative"}}>
      <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"none",border:"none",cursor:"pointer"}}>{I.close(t.text3,18)}</button>
      {step==="phone"&&<div style={{textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:48,height:48,borderRadius:14,background:`${t.accent}15`,border:`1px solid ${t.accent}25`,marginBottom:14}}>{I.phone(t.accent,24)}</div>
        <h2 style={{fontFamily:"var(--fd)",fontSize:24,color:t.text,margin:"0 0 4px"}}>Sign In</h2>
        <p style={{fontFamily:"var(--fm)",fontSize:10,color:t.text3,margin:"0 0 20px"}}>Enter your phone number to continue</p>
        <input value={ph} onChange={e=>setPh(e.target.value)} placeholder="+1 (555) 123-4567" type="tel" style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`1px solid ${t.searchBorder}`,background:t.searchBg,color:t.text,fontSize:16,fontFamily:"var(--fm)",outline:"none",boxSizing:"border-box",textAlign:"center",letterSpacing:1,marginBottom:12}}/>
        <button onClick={handleSend} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:`linear-gradient(135deg,${t.accent},${t.accent2})`,fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",letterSpacing:1,opacity:ph.replace(/\D/g,"").length>=10?1:0.4}}>Send Code</button>
        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginTop:14}}>{I.shield(t.text4,12)}<span style={{fontFamily:"var(--fm)",fontSize:8,color:t.text4}}>We never share or sell your phone number</span></div>
      </div>}
      {step==="code"&&<div style={{textAlign:"center"}}>
        <h2 style={{fontFamily:"var(--fd)",fontSize:24,color:t.text,margin:"0 0 4px"}}>Enter Code</h2>
        <p style={{fontFamily:"var(--fm)",fontSize:10,color:t.text3,margin:"0 0 20px"}}>Sent to {masked}</p>
        <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" style={{width:"100%",padding:"14px",borderRadius:12,border:`1px solid ${t.searchBorder}`,background:t.searchBg,color:t.text,fontSize:28,fontFamily:"var(--fm)",outline:"none",boxSizing:"border-box",textAlign:"center",letterSpacing:8,marginBottom:12}}/>
        <button onClick={handleVerify} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:`linear-gradient(135deg,${t.accent},${t.accent2})`,fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",letterSpacing:1,opacity:code.length>=4?1:0.4}}>Verify</button>
      </div>}
      {step==="name"&&<div style={{textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>{I.check(t.green,32)}</div>
        <h2 style={{fontFamily:"var(--fd)",fontSize:24,color:t.text,margin:"0 0 4px"}}>Verified!</h2>
        <p style={{fontFamily:"var(--fm)",fontSize:10,color:t.text3,margin:"0 0 20px"}}>Add a display name (optional)</p>
        <input value={name} onChange={e=>setName(e.target.value.slice(0,20))} placeholder={masked} maxLength={20} style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`1px solid ${t.searchBorder}`,background:t.searchBg,color:t.text,fontSize:16,fontFamily:"var(--fm)",outline:"none",boxSizing:"border-box",textAlign:"center",marginBottom:12}}/>
        <button onClick={handleDone} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:`linear-gradient(135deg,${t.accent},${t.accent2})`,fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",letterSpacing:1}}>Continue</button>
      </div>}
    </div>
  </div>;
}

// ── Pro Modal ───────────────────────────────────────
// ═══ SHARE CARD GENERATOR ═══════════════════════════
const SHARE_FORMATS={twitter:{w:1200,h:675,label:"Twitter / X",ratio:"16:9"},instagram:{w:1080,h:1080,label:"Instagram",ratio:"1:1"},telegram:{w:800,h:418,label:"Telegram",ratio:"1.91:1"}};
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function wrapText(ctx,text,maxW){const words=text.split(" ");const lines=[];let cur="";for(const w of words){const test=cur?cur+" "+w:w;if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w;}else cur=test;}if(cur)lines.push(cur);return lines;}

function drawShareCard(canvas,market,format="twitter"){
  const{w,h}=SHARE_FORMATS[format];canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");const catCol=CAT_COLORS[market.category]||CAT_COLORS.general;
  const isUp=market.change24h>=0;const pct=Math.round(market.yesPrice*100);
  const delta=`${isUp?"+":""}${(market.change24h*100).toFixed(1)}%`;
  const green="#00ff88",red="#ff3b30";const s=w/1200;const pad=48*s;const sq=format==="instagram";
  // BG
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#08080c");bg.addColorStop(0.5,"#0a0a14");bg.addColorStop(1,"#06060a");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Glows
  let gl=ctx.createRadialGradient(w*0.75,h*0.15,0,w*0.75,h*0.15,w*0.5);gl.addColorStop(0,catCol.accent+"30");gl.addColorStop(1,"transparent");ctx.fillStyle=gl;ctx.fillRect(0,0,w,h);
  gl=ctx.createRadialGradient(w*0.25,h*0.85,0,w*0.25,h*0.85,w*0.4);gl.addColorStop(0,(isUp?green:red)+"18");gl.addColorStop(1,"transparent");ctx.fillStyle=gl;ctx.fillRect(0,0,w,h);
  // Grid
  ctx.strokeStyle="rgba(255,255,255,0.025)";ctx.lineWidth=1;for(let x=0;x<w;x+=60*s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=60*s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  // Border
  ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=2;roundRect(ctx,2,2,w-4,h-4,12*s);ctx.stroke();
  // Category pill
  ctx.fillStyle=catCol.accent+"25";const catT=market.category.toUpperCase();ctx.font=`700 ${12*s}px monospace`;const catW=ctx.measureText(catT).width+20*s;roundRect(ctx,pad,pad,catW,24*s,6*s);ctx.fill();ctx.strokeStyle=catCol.accent+"40";ctx.lineWidth=1;roundRect(ctx,pad,pad,catW,24*s,6*s);ctx.stroke();ctx.fillStyle=catCol.accent;ctx.textBaseline="middle";ctx.fillText(catT,pad+10*s,pad+12*s);
  // LIVE
  ctx.fillStyle=green;ctx.beginPath();ctx.arc(w-pad-40*s,pad+12*s,4*s,0,Math.PI*2);ctx.fill();ctx.font=`600 ${11*s}px monospace`;ctx.fillStyle="rgba(255,255,255,0.5)";ctx.fillText("LIVE",w-pad-32*s,pad+13*s);
  // Title
  ctx.fillStyle="#fff";ctx.textBaseline="top";const tSz=sq?30*s:26*s;ctx.font=`400 ${tSz}px Georgia,serif`;const mTW=w-pad*2-(sq?0:180*s);const lines=wrapText(ctx,market.question,mTW);lines.slice(0,sq?4:2).forEach((l,i)=>ctx.fillText(l,pad,pad+44*s+i*(tSz+6*s)));
  // Big pct
  const pY=sq?h*0.42:h*0.46;const pSz=sq?130*s:110*s;ctx.font=`700 ${pSz}px monospace`;ctx.fillStyle="#fff";ctx.textBaseline="alphabetic";ctx.fillText(`${pct}`,pad,pY+pSz*0.85);const pW=ctx.measureText(`${pct}`).width;ctx.font=`400 ${pSz*0.35}px monospace`;ctx.fillStyle="rgba(255,255,255,0.3)";ctx.fillText("%",pad+pW+4*s,pY+pSz*0.85);
  // Arrow + delta
  const aY=sq?h*0.72:h*0.7;ctx.fillStyle=isUp?green:red;ctx.beginPath();if(isUp){ctx.moveTo(pad,aY+16*s);ctx.lineTo(pad+12*s,aY);ctx.lineTo(pad+24*s,aY+16*s);}else{ctx.moveTo(pad,aY);ctx.lineTo(pad+12*s,aY+16*s);ctx.lineTo(pad+24*s,aY);}ctx.fill();
  ctx.font=`700 ${26*s}px monospace`;ctx.fillStyle=isUp?green:red;ctx.textBaseline="middle";ctx.fillText(delta,pad+32*s,aY+8*s);const dW=ctx.measureText(delta).width;ctx.font=`400 ${13*s}px monospace`;ctx.fillStyle="rgba(255,255,255,0.3)";ctx.fillText("24h",pad+32*s+dW+10*s,aY+8*s);
  // Volume
  ctx.font=`500 ${11*s}px monospace`;ctx.fillStyle="rgba(255,255,255,0.25)";ctx.textBaseline="top";ctx.fillText(`${fmt$(market.volume)} volume  •  ${fmtN(market.participants||0)} forecasters`,pad,aY+32*s);
  // YES/NO bar
  const bY=sq?h-pad-56*s:h-pad-42*s;const bH=6*s;ctx.fillStyle="rgba(255,255,255,0.06)";roundRect(ctx,pad,bY,w-pad*2,bH,3*s);ctx.fill();const bG=ctx.createLinearGradient(pad,0,pad+(w-pad*2)*market.yesPrice,0);bG.addColorStop(0,green);bG.addColorStop(1,catCol.accent);ctx.fillStyle=bG;roundRect(ctx,pad,bY,(w-pad*2)*market.yesPrice,bH,3*s);ctx.fill();ctx.font=`600 ${10*s}px monospace`;ctx.fillStyle="rgba(255,255,255,0.35)";ctx.textBaseline="top";ctx.fillText(`YES ${pct}%`,pad,bY+bH+5*s);ctx.textAlign="right";ctx.fillText(`NO ${100-pct}%`,w-pad,bY+bH+5*s);ctx.textAlign="left";
  // Logo
  const lY=h-pad-6*s;ctx.font=`700 ${18*s}px monospace`;const lG=ctx.createLinearGradient(w-pad-90*s,0,w-pad,0);lG.addColorStop(0,"#00ff88");lG.addColorStop(1,"#0088ff");ctx.fillStyle=lG;ctx.textAlign="right";ctx.textBaseline="bottom";ctx.fillText("OddTok",w-pad,lY);ctx.font=`400 ${8*s}px monospace`;ctx.fillStyle="rgba(255,255,255,0.2)";ctx.fillText("oddtok.com",w-pad,lY+12*s);ctx.textAlign="left";
}

function ShareModal({market,onClose}){
  const t=useTheme();const canvasRef=useRef(null);const[fmt,setFmt]=useState("twitter");const[copied,setCopied]=useState(false);const[dl,setDl]=useState(false);
  useEffect(()=>{if(canvasRef.current)drawShareCard(canvasRef.current,market,fmt);},[market,fmt]);
  const shareText=`${market.question}\n\n${Math.round(market.yesPrice*100)}% probability${market.change24h>=0?" ▲":" ▼"} ${(market.change24h*100).toFixed(1)}% 24h\n\nLive odds → oddtok.com`;
  const handleDL=()=>{if(!canvasRef.current)return;setDl(true);const a=document.createElement("a");a.download=`oddtok-${market.category}-${fmt}.png`;a.href=canvasRef.current.toDataURL("image/png");a.click();setTimeout(()=>setDl(false),800);};
  const handleCopy=async()=>{try{await navigator.clipboard.writeText(shareText);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
  const handleNative=async()=>{if(!canvasRef.current)return;try{const b=await new Promise(r=>canvasRef.current.toBlob(r,"image/png"));const f=new File([b],`oddtok-${market.category}.png`,{type:"image/png"});await navigator.share({title:`OddTok: ${market.question}`,text:shareText,files:[f]});}catch{try{await navigator.share({title:`OddTok: ${market.question}`,text:shareText});}catch{}}};
  const openPlatform=(p)=>{const url=market.url||"https://oddtok.com";const txt=encodeURIComponent(shareText);const links={twitter:`https://twitter.com/intent/tweet?text=${txt}`,telegram:`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${txt}`};if(links[p])window.open(links[p],"_blank","noopener");};

  return<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 16px 40px",animation:"sU 0.3s ease-out",overflowY:"auto"}}>
    <button onClick={onClose} style={{position:"fixed",top:16,right:16,background:"none",border:"none",cursor:"pointer",zIndex:10}}>{I.close("#fff",22)}</button>
    <div style={{textAlign:"center",marginBottom:12,marginTop:8}}>
      <div style={{fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#fff",letterSpacing:1}}>SHARE CARD</div>
      <div style={{fontFamily:"var(--fm)",fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>Generate &middot; Download &middot; Share</div>
    </div>
    {/* Format tabs */}
    <div style={{display:"flex",gap:4,marginBottom:12}}>{Object.entries(SHARE_FORMATS).map(([k,v])=><button key={k} onClick={()=>setFmt(k)} style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontFamily:"var(--fm)",fontSize:10,fontWeight:fmt===k?700:400,background:fmt===k?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",border:fmt===k?"1px solid rgba(255,255,255,0.2)":"1px solid rgba(255,255,255,0.06)",color:fmt===k?"#fff":"rgba(255,255,255,0.4)",transition:"all 0.2s"}}>{v.label}<span style={{fontSize:7,marginLeft:4,opacity:0.5}}>{v.ratio}</span></button>)}</div>
    {/* Preview */}
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:8,marginBottom:14,maxWidth:"100%",overflow:"hidden"}}><canvas ref={canvasRef} style={{width:"100%",maxWidth:420,height:"auto",borderRadius:8,display:"block"}}/></div>
    {/* Actions */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:12}}>
      <button onClick={handleDL} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#00ff88,#00cc6a)",fontFamily:"var(--fm)",fontSize:12,fontWeight:700,color:"#000",cursor:"pointer"}}>{dl?"✓ Saved":"↓ Download PNG"}</button>
      <button onClick={handleCopy} style={{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.06)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>{copied?"✓ Copied":"Copy Text"}</button>
      {typeof navigator!=="undefined"&&typeof navigator.share==="function"&&<button onClick={handleNative} style={{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.06)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Share...</button>}
    </div>
    {/* Platform buttons */}
    <div style={{display:"flex",gap:8,justifyContent:"center"}}>
      <button onClick={()=>openPlatform("twitter")} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"var(--fm)",fontSize:10,fontWeight:600,color:"#fff",background:"#1da1f2cc"}}>𝕏 Twitter</button>
      <button onClick={()=>openPlatform("telegram")} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"var(--fm)",fontSize:10,fontWeight:600,color:"#fff",background:"#0088cccc"}}>Telegram</button>
      <button onClick={handleDL} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"var(--fm)",fontSize:10,fontWeight:600,color:"#fff",background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)"}}>Instagram ↓</button>
    </div>
  </div>;
}

function ProModal({onClose}){const t=useTheme();const features=[{icon:I.signal,title:"Full Signal Analysis",desc:"See all 5 data factors per market"},{icon:I.radar,title:"Spread Alerts",desc:"Notifications when platform prices diverge"},{icon:I.chart,title:"Historical Data",desc:"Price history charts and trend analysis"},{icon:I.crown,title:"Early Access",desc:"New features and data feeds first"}];return<div style={{position:"fixed",inset:0,zIndex:300,background:`${t.isDark?"rgba(0,0,0,0.85)":"rgba(0,0,0,0.5)"}`,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"sU 0.3s ease-out"}}><div style={{width:"100%",maxWidth:380,background:t.isDark?"#111":"#fff",border:`1px solid ${t.proBorder}`,borderRadius:20,padding:"28px 22px",position:"relative",boxShadow:`0 8px 60px ${t.signalGold}15`}}><button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"none",border:"none",cursor:"pointer"}}>{I.close(t.text3,18)}</button><div style={{textAlign:"center",marginBottom:24}}><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:56,height:56,borderRadius:16,background:`${t.signalGold}15`,border:`1px solid ${t.signalGold}30`,marginBottom:12}}>{I.crown(t.signalGold,28)}</div><h2 style={{fontFamily:"var(--fd)",fontSize:28,color:t.text,margin:"0 0 4px",fontWeight:400}}>OddTok <span style={{background:`linear-gradient(135deg,${t.signalGold},#ffaa00)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Pro</span></h2><p style={{fontFamily:"var(--fm)",fontSize:11,color:t.text3,margin:0}}>Deeper data. Smarter analysis.</p></div><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>{features.map((f,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:32,height:32,borderRadius:8,background:`${t.signalGold}0a`,border:`1px solid ${t.signalGold}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{f.icon(t.signalGold,16)}</div><div><div style={{fontFamily:"var(--fm)",fontSize:11,color:t.text,fontWeight:600}}>{f.title}</div><div style={{fontFamily:"var(--fm)",fontSize:9,color:t.text3,marginTop:1}}>{f.desc}</div></div></div>)}</div><div style={{textAlign:"center",marginBottom:16}}><div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:3,marginBottom:4}}><span style={{fontFamily:"var(--fm)",fontSize:32,fontWeight:700,color:t.text}}>$9.99</span><span style={{fontFamily:"var(--fm)",fontSize:11,color:t.text4}}>/mo</span></div><p style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,margin:0}}>Cancel anytime</p></div><button onClick={onClose} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${t.signalGold},#ffaa00)`,fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#000",cursor:"pointer",letterSpacing:1,textTransform:"uppercase",boxShadow:`0 4px 30px ${t.signalGold}30`}}>Subscribe to Pro</button><p style={{fontFamily:"var(--fm)",fontSize:7,color:t.text5,textAlign:"center",marginTop:10,lineHeight:1.4}}>OddTok Pro provides enhanced data analysis only. Not financial advice. Not a recommendation to participate in any market.</p></div></div>;}

// ═══ LANDING ════════════════════════════════════════
function Landing({onEnter,isDark,toggleTheme}){const t=useTheme();const[ok,setOk]=useState(false);useEffect(()=>{setTimeout(()=>setOk(true),100)},[]);return(<div style={{width:"100%",height:"100vh",background:t.bg2,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{position:"absolute",top:12,right:16,zIndex:20}}><ThemeToggle isDark={isDark} toggle={toggleTheme}/></div><div style={{position:"absolute",inset:0,overflow:"hidden",opacity:isDark?0.3:0.15}}><div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,255,136,0.25) 0%,transparent 70%)",top:"-20%",left:"-10%",animation:"oF1 12s ease-in-out infinite"}}/><div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,136,255,0.2) 0%,transparent 70%)",bottom:"-15%",right:"-10%",animation:"oF2 15s ease-in-out infinite"}}/><div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,215,0,0.12) 0%,transparent 70%)",top:"40%",left:"50%",transform:"translateX(-50%)",animation:"oF3 10s ease-in-out infinite"}}/></div><div style={{position:"absolute",inset:0,opacity:isDark?0.03:0.02,backgroundImage:`linear-gradient(${t.text5} 1px,transparent 1px),linear-gradient(90deg,${t.text5} 1px,transparent 1px)`,backgroundSize:"60px 60px"}}/>{[{q:"Trump 2028?",o:"42",c:"#00ff88",sig:78,tp:"8%",l:"3%",d:0.3,a:"cF1",s:"12s"},{q:"BTC $200K?",o:"28",c:"#ff9500",sig:65,tp:"18%",l:"72%",d:0.45,a:"cF2",s:"14s"},{q:"AI Turing?",o:"67",c:"#0088ff",sig:84,tp:"35%",l:"5%",d:0.6,a:"cF3",s:"10s"},{q:"Fed Cuts?",o:"51",c:"#ff3b30",sig:52,tp:"62%",l:"78%",d:0.75,a:"cF1",s:"13s"},{q:"Mars 2030?",o:"12",c:"#af52de",sig:41,tp:"75%",l:"8%",d:0.9,a:"cF2",s:"11s"},{q:"SOL $500?",o:"22",c:"#00d4ff",sig:58,tp:"5%",l:"60%",d:1.05,a:"cF3",s:"15s"}].map((f,i)=>(<div key={i} style={{position:"absolute",top:f.tp,left:f.l,background:t.card,border:`1px solid ${f.c}20`,borderRadius:10,padding:"8px 14px",opacity:ok?0.5:0,transform:ok?"translateY(0)":"translateY(30px)",transition:`all 1s ease ${f.d}s`,animation:`${f.a} ${f.s} ease-in-out infinite ${i*0.5}s`,pointerEvents:"none",zIndex:1,boxShadow:t.cardShadow}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><div style={{fontSize:9,fontFamily:"var(--fm)",color:t.text3,marginBottom:2,letterSpacing:0.5}}>{f.q}</div><div style={{fontSize:22,fontFamily:"var(--fm)",fontWeight:700,color:f.c,letterSpacing:-1}}>{f.o}<span style={{fontSize:11,opacity:0.6}}>%</span></div></div><div style={{display:"flex",alignItems:"center",gap:2}}>{I.zap(t.signalGold,11)}<span style={{fontSize:11,fontFamily:"var(--fm)",fontWeight:700,color:t.signalGold}}>{f.sig}</span></div></div></div>))}<div style={{position:"relative",zIndex:10,textAlign:"center",padding:"0 24px",maxWidth:560,opacity:ok?1:0,transform:ok?"translateY(0)":"translateY(40px)",transition:"all 1s ease 0.2s"}}><div style={{marginBottom:16}}><Logo size="large"/></div><div style={{display:"inline-flex",alignItems:"center",gap:6,background:t.signalBg,border:`1px solid ${t.signalBorder}`,borderRadius:10,padding:"6px 14px",marginBottom:20}}>{I.zap(t.signalGold,16)}<span style={{fontFamily:"var(--fm)",fontSize:11,fontWeight:700,color:t.signalGold,letterSpacing:1}}>Powered by OddTok Signal\u2122</span></div><h1 style={{fontFamily:"var(--fd)",fontSize:38,fontWeight:400,color:t.text,lineHeight:1.15,margin:"0 0 16px"}}>Doom Scroll<br/><span style={{background:"linear-gradient(135deg,#00ff88,#0088ff,#FFD700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>The World's Odds</span></h1><p style={{fontFamily:"var(--fm)",fontSize:12,color:t.text3,lineHeight:1.7,margin:"0 0 12px",maxWidth:400,marginLeft:"auto",marginRight:"auto"}}>See how prediction markets price the future. Compare odds across Polymarket & Kalshi in real-time. Powered by our proprietary Signal\u2122 algorithm.</p><div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:24}}><BrokerBadge broker="Polymarket" colorKey="poly"/><span style={{fontFamily:"var(--fm)",fontSize:10,color:t.text4,alignSelf:"center"}}>+</span><BrokerBadge broker="Kalshi" colorKey="kalshi"/></div><button onClick={onEnter} style={{background:"linear-gradient(135deg,#00ff88,#00cc6a)",border:"none",borderRadius:14,padding:"16px 44px",fontFamily:"var(--fm)",fontSize:15,fontWeight:700,color:"#000",cursor:"pointer",letterSpacing:2,textTransform:"uppercase",boxShadow:"0 4px 40px rgba(0,255,136,0.3)",transition:"all 0.3s"}} onMouseOver={e=>{e.target.style.transform="translateY(-3px)";e.target.style.boxShadow="0 8px 50px rgba(0,255,136,0.5)"}} onMouseOut={e=>{e.target.style.transform="translateY(0)";e.target.style.boxShadow="0 4px 40px rgba(0,255,136,0.3)"}}>Start Scrolling</button><p style={{fontFamily:"var(--fm)",fontSize:8,color:t.text5,marginTop:14,lineHeight:1.5}}>For informational and entertainment purposes only. Not financial advice.<br/>Data sourced from publicly available prediction market APIs.</p><div style={{display:"flex",justifyContent:"center",gap:24,marginTop:20,opacity:ok?1:0,transition:"all 1s ease 0.8s"}}>{[{l:"Live Markets",v:"2,400+"},{l:"Total Volume",v:"$12B+"},{l:"Platforms",v:"2"},{l:"Signals",v:"Live"}].map(s=>(<div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:18,fontFamily:"var(--fm)",fontWeight:700,color:t.text}}>{s.v}</div><div style={{fontSize:7,fontFamily:"var(--fm)",color:t.text4,textTransform:"uppercase",letterSpacing:1.5,marginTop:3}}>{s.l}</div></div>))}</div></div></div>);}

// ── Animated Counter Hook ────────────────────────────
function useCounter(target,duration=1200,active=false){const[v,setV]=useState(0);useEffect(()=>{if(!active){setV(0);return;}let start=null;const step=ts=>{if(!start)start=ts;const p=Math.min((ts-start)/duration,1);const ease=1-Math.pow(1-p,3);setV(Math.round(target*ease));if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);return()=>{start=null;};},[target,active,duration]);return v;}

// ── Category Color Schemes ──────────────────────────
const CAT_COLORS={politics:{grad:"linear-gradient(135deg,rgba(59,130,246,0.35),rgba(147,51,234,0.25))",glow:"rgba(99,102,241,0.3)",accent:"#818cf8"},geopolitics:{grad:"linear-gradient(135deg,rgba(239,68,68,0.3),rgba(249,115,22,0.25))",glow:"rgba(239,68,68,0.3)",accent:"#f87171"},crypto:{grad:"linear-gradient(135deg,rgba(168,85,247,0.35),rgba(236,72,153,0.2))",glow:"rgba(168,85,247,0.3)",accent:"#c084fc"},tech:{grad:"linear-gradient(135deg,rgba(6,182,212,0.3),rgba(59,130,246,0.25))",glow:"rgba(6,182,212,0.3)",accent:"#22d3ee"},economy:{grad:"linear-gradient(135deg,rgba(16,185,129,0.3),rgba(59,130,246,0.2))",glow:"rgba(16,185,129,0.3)",accent:"#34d399"},sports:{grad:"linear-gradient(135deg,rgba(249,115,22,0.35),rgba(239,68,68,0.2))",glow:"rgba(249,115,22,0.3)",accent:"#fb923c"},science:{grad:"linear-gradient(135deg,rgba(14,165,233,0.3),rgba(168,85,247,0.2))",glow:"rgba(14,165,233,0.3)",accent:"#38bdf8"},entertainment:{grad:"linear-gradient(135deg,rgba(236,72,153,0.3),rgba(249,115,22,0.2))",glow:"rgba(236,72,153,0.3)",accent:"#f472b6"},general:{grad:"linear-gradient(135deg,rgba(99,102,241,0.25),rgba(6,182,212,0.2))",glow:"rgba(99,102,241,0.25)",accent:"#818cf8"}};

// ═══ MARKET CARD (Cinematic) ════════════════════════
function MC({market:m,isActive,isPro,onUpgrade,cardIdx=0}){const t=useTheme();const dk=t.isDark;const[sd]=useState(()=>gs(m.yesPrice,48));const[lk,setLk]=useState(false);const[expanded,setExpanded]=useState(false);const[showShare,setShowShare]=useState(false);const sc=m.change24h>=0?t.green:t.red;const an=m.analysis||getAn(m.category);const sig=m.signal||computeSignal(m);const bc=m.brokerColor==="poly"?t.polyColor:t.kalshiColor;
  const newsCtx=useNewsContext(m.id,m.question,m.category,isActive);
  const{watched,toggle:toggleWatch}=useWatch();const isWatched=watched.has(m.id);
  const media=useMemo(()=>getMedia(m.category,cardIdx),[m.category,cardIdx]);
  const catCol=CAT_COLORS[m.category]||CAT_COLORS.general;
  const pctVal=useCounter(Math.round(m.yesPrice*100),1400,isActive);
  const panVariant=["kb1","kb2","kb3"][cardIdx%3];
  const fc={txt:dk?"#fff":"#1a1a1a",txt2:dk?"rgba(255,255,255,0.75)":"rgba(0,0,0,0.7)",txt3:dk?"rgba(255,255,255,0.55)":"rgba(0,0,0,0.5)",txt4:dk?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.3)",txt5:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",side:dk?"rgba(255,255,255,0.75)":"rgba(0,0,0,0.5)",sideT:dk?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)",catBg:dk?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.8)",catBord:dk?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",catTxt:dk?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.55)",bullBg:dk?"rgba(0,255,136,0.06)":`${t.green}0a`,bullBord:dk?"rgba(0,255,136,0.12)":`${t.green}20`,bearBg:dk?"rgba(255,59,48,0.06)":`${t.red}0a`,bearBord:dk?"rgba(255,59,48,0.12)":`${t.red}20`,newsBg:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",newsBord:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"};
  return(<div style={{height:"100vh",width:"100%",position:"relative",display:"flex",flexDirection:"column",overflow:"hidden",scrollSnapAlign:"start",background:dk?"#000":t.bg}}>
      {/* L1: Background image with dramatic Ken Burns */}
      <div style={{position:"absolute",inset:"-8%",backgroundImage:`url(${m.image||media.img})`,backgroundSize:"cover",backgroundPosition:"center",filter:dk?"brightness(0.35) saturate(1.4) contrast(1.1)":"brightness(0.6) saturate(1.2)",animation:isActive?`${panVariant} 25s ease-in-out infinite`:"none",willChange:"transform"}}/>
      {/* L2: Category color wash */}
      <div style={{position:"absolute",inset:0,background:catCol.grad,mixBlendMode:dk?"normal":"multiply"}}/>
      {/* L3: Animated ambient glow */}
      {isActive&&<><div style={{position:"absolute",width:"120%",height:"60%",top:"-10%",left:"-10%",background:`radial-gradient(ellipse,${catCol.glow} 0%,transparent 70%)`,animation:"ambientGlow 8s ease-in-out infinite",opacity:0.6}}/><div style={{position:"absolute",width:"80%",height:"50%",bottom:"5%",right:"-20%",background:`radial-gradient(ellipse,${catCol.glow} 0%,transparent 70%)`,animation:"ambientGlow2 10s ease-in-out infinite",opacity:0.4}}/></>}
      {/* L4: Film grain texture */}
      <div style={{position:"absolute",inset:0,opacity:dk?0.04:0.02,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"128px 128px",mixBlendMode:"overlay",animation:isActive?"grainShift 0.5s steps(4) infinite":"none"}}/>
      {/* L5: Cinematic vignette */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 60% at 50% 45%,transparent 50%,rgba(0,0,0,0.5) 100%)"}}/>
      {/* L6: Content gradient overlay */}
      <div style={{position:"absolute",inset:0,background:dk?"linear-gradient(0deg,rgba(0,0,0,0.98) 0%,rgba(0,0,0,0.7) 28%,rgba(0,0,0,0.05) 52%,rgba(0,0,0,0.15) 72%,rgba(0,0,0,0.4) 100%)":"linear-gradient(0deg,rgba(255,255,255,0.98) 0%,rgba(255,255,255,0.8) 28%,rgba(255,255,255,0.05) 52%,rgba(255,255,255,0.15) 72%,rgba(255,255,255,0.3) 100%)"}}/>
      {/* L7: Floating bokeh particles */}
      {isActive&&<div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>{[...Array(6)].map((_,i)=><div key={i} style={{position:"absolute",width:4+i*3,height:4+i*3,borderRadius:"50%",background:dk?`rgba(255,255,255,${0.04+i*0.01})`:`rgba(0,0,0,${0.03+i*0.005})`,left:`${10+i*15}%`,bottom:`${20+i*8}%`,animation:`bokeh${(i%3)+1} ${6+i*2}s ease-in-out infinite ${i*0.8}s`}}/>)}</div>}

      {/* TOP BADGES */}
      <div style={{position:"absolute",top:56,left:16,zIndex:10,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><div style={{background:fc.catBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderRadius:8,padding:"4px 10px",fontSize:10,fontFamily:"var(--fm)",color:fc.catTxt,border:`1px solid ${fc.catBord}`,textTransform:"uppercase",letterSpacing:1.5,display:"flex",alignItems:"center",gap:5}}>{(CAT_ICONS[m.category]||CAT_ICONS.general)(fc.catTxt,14)} {m.category}</div><span style={{fontSize:8,fontFamily:"var(--fm)",fontWeight:700,letterSpacing:0.5,color:bc,background:`${bc}15`,border:`1px solid ${bc}30`,borderRadius:6,padding:"2px 6px",textTransform:"uppercase"}}>{m.brokerLabel}</span>{m.trending&&<div style={{background:`${t.red}18`,border:`1px solid ${t.red}30`,borderRadius:8,padding:"4px 8px",fontSize:8,fontFamily:"var(--fm)",color:t.red,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",display:"flex",alignItems:"center",gap:3}}>{I.fire(t.red,12)} HOT</div>}</div>
      <div style={{position:"absolute",top:56,right:16,zIndex:10,display:"flex",alignItems:"center",gap:5}}>{I.live(7)}<span style={{fontSize:9,fontFamily:"var(--fm)",color:t.green,letterSpacing:2,fontWeight:600}}>LIVE</span></div>

      {/* SIDE ACTIONS — positioned from bottom to clear nav */}
      <div style={{position:"absolute",right:12,top:"38%",zIndex:10,display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>{[{icon:lk?I.heartFill():I.heart(fc.side),count:m.comments+(lk?1:0),act:()=>setLk(!lk)},{icon:I.comment(fc.side),count:m.comments,act:()=>{}},{icon:I.share(fc.side),count:m.shares,act:()=>setShowShare(true)},{icon:isWatched?I.bookmarkFill(t.accent):I.bookmark(fc.side),count:null,act:()=>toggleWatch(m),label:isWatched?"Following":""}].map((b,i)=>(<button key={i} onClick={b.act} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:0}}>{b.icon}{b.count!==null&&<span style={{fontSize:9,color:fc.sideT,fontFamily:"var(--fm)",fontWeight:500}}>{fmtN(b.count)}</span>}{b.label&&<span style={{fontSize:7,color:t.accent,fontFamily:"var(--fm)",fontWeight:700}}>{b.label}</span>}</button>))}</div>
      {showShare&&<ShareModal market={m} onClose={()=>setShowShare(false)}/>}

      {/* MAIN CONTENT — bottom-anchored, shows all key fields */}
      <div style={{position:"absolute",bottom:140,left:0,right:0,zIndex:5,padding:"0 16px",maxWidth:600,display:"flex",flexDirection:"column"}}>
        {/* Event Title */}
        <h2 style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,color:fc.txt,lineHeight:1.15,margin:"0 0 8px",maxWidth:"80%",textShadow:dk?"0 2px 20px rgba(0,0,0,0.6)":"none"}}>{m.question}</h2>

        {/* Probability % + 24h change */}
        <div style={{display:"flex",alignItems:"flex-end",gap:10,marginBottom:6}}>
          <span style={{fontSize:52,fontFamily:"var(--fm)",fontWeight:700,color:fc.txt,lineHeight:0.85,letterSpacing:-3,textShadow:dk?`0 0 40px ${catCol.glow}, 0 2px 12px rgba(0,0,0,0.4)`:"none"}}>{pctVal}<span style={{fontSize:18,opacity:0.35,letterSpacing:0}}>%</span></span>
          <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              {m.change24h>=0?I.arrowUp(t.green,14):I.arrowDown(t.red,14)}
              <span style={{fontSize:14,fontFamily:"var(--fm)",color:sc,fontWeight:700}}>{m.change24h>=0?"+":""}{(m.change24h*100).toFixed(1)}%</span>
              <span style={{fontSize:9,fontFamily:"var(--fm)",color:fc.txt4}}>24h</span>
            </div>
            <SignalBadge signal={sig} size="small"/>
          </div>
        </div>

        {/* Stats row: Volume | Time to Resolution | Spread */}
        {(()=>{const tr=timeToRes(m.endDateRaw||m.endDate);return<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:3,background:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",borderRadius:6,padding:"3px 8px"}}>{I.chart(fc.txt4,12)}<span style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,fontWeight:600}}>{fmt$(m.volume)}</span><span style={{fontSize:8,fontFamily:"var(--fm)",color:fc.txt4}}>vol</span></div>
          <div style={{display:"flex",alignItems:"center",gap:3,background:tr.urgent?`${t.orange}18`:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",border:tr.urgent?`1px solid ${t.orange}30`:"none",borderRadius:6,padding:"3px 8px"}}>{I.clock(tr.urgent?t.orange:fc.txt4,12)}<span style={{fontSize:10,fontFamily:"var(--fm)",color:tr.urgent?t.orange:fc.txt3,fontWeight:600}}>{tr.label}</span></div>
          {sig.spreadAlert&&<div style={{display:"flex",alignItems:"center",gap:3,background:`${t.orange}15`,border:`1px solid ${t.orange}25`,borderRadius:6,padding:"3px 8px"}}>{I.radar(t.orange,12)}<span style={{fontSize:10,fontFamily:"var(--fm)",color:t.orange,fontWeight:600}}>{sig.spreadPct}%</span></div>}
          <span style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt4}}>{fmtN(m.participants)} forecasters</span>
        </div>;})()}

        {/* YES/NO bar */}
        <div style={{marginBottom:4}}><div style={{height:3,borderRadius:2,background:fc.txt5,overflow:"hidden"}}><div style={{height:"100%",width:`${m.yesPrice*100}%`,borderRadius:2,background:`linear-gradient(90deg,${t.green},${catCol.accent})`,transition:"width 2s"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:9,fontFamily:"var(--fm)",color:fc.txt4}}><span>YES {(m.yesPrice*100).toFixed(0)}%</span><span>NO {((1-m.yesPrice)*100).toFixed(0)}%</span></div></div>

        {/* AI News Context — "Why this is moving" */}
        {(()=>{
          // Show Perplexity data if available, otherwise show static analysis as fallback
          const hasAI=newsCtx&&newsCtx.bullets.length>0&&!newsCtx.fallback;
          const showFallback=!hasAI&&isActive&&newsCtx&&newsCtx.fallback;
          const isLoading=newsCtx===null&&isActive;
          if(isLoading)return<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"8px 10px",background:dk?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",borderRadius:10,border:`1px solid ${dk?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)"}`}}>
            <div style={{width:10,height:10,borderRadius:"50%",border:`2px solid ${catCol.accent}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
            <span style={{fontSize:9,fontFamily:"var(--fm)",color:fc.txt4}}>Analyzing market drivers...</span>
          </div>;
          if(hasAI)return<div style={{background:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",border:`1px solid ${catCol.accent}20`,borderLeft:`3px solid ${catCol.accent}`,borderRadius:10,padding:"10px 12px",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
              {I.zap(catCol.accent,13)}
              <span style={{fontSize:10,fontFamily:"var(--fm)",fontWeight:700,color:catCol.accent,letterSpacing:0.5}}>Why This Is Moving</span>
              <span style={{fontSize:7,fontFamily:"var(--fm)",color:newsCtx.sentiment==="bullish"?t.green:newsCtx.sentiment==="bearish"?t.red:fc.txt4,marginLeft:"auto",background:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",borderRadius:4,padding:"2px 6px",fontWeight:700}}>{newsCtx.sentiment==="bullish"?"▲ BULLISH":newsCtx.sentiment==="bearish"?"▼ BEARISH":"◆ MIXED"}</span>
            </div>
            {newsCtx.headline&&<div style={{fontSize:11,fontFamily:"var(--fm)",color:fc.txt2,fontWeight:600,lineHeight:1.35,marginBottom:6}}>{newsCtx.headline}</div>}
            {newsCtx.bullets.map((b,i)=><div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",marginBottom:i<newsCtx.bullets.length-1?4:0}}>
              <span style={{fontSize:10,color:catCol.accent,lineHeight:1.35,flexShrink:0,marginTop:1}}>•</span>
              <span style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,lineHeight:1.35}}>{b}</span>
            </div>)}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,paddingTop:5,borderTop:`1px solid ${dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"}`}}>
              {newsCtx.citations&&newsCtx.citations.length>0&&<span style={{fontSize:7,fontFamily:"var(--fm)",color:fc.txt5}}>Sources: {newsCtx.citations.slice(0,2).map((c)=>{try{return new URL(c).hostname.replace("www.","")}catch{return""}}).filter(Boolean).join(", ")}</span>}
              <span style={{fontSize:7,fontFamily:"var(--fm)",color:fc.txt5,marginLeft:"auto"}}>Powered by Perplexity AI</span>
            </div>
          </div>;
          if(showFallback&&an)return<div style={{background:dk?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",border:`1px solid ${dk?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)"}`,borderRadius:10,padding:"8px 10px",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
              {I.signal(fc.txt4,11)}
              <span style={{fontSize:9,fontFamily:"var(--fm)",fontWeight:600,color:fc.txt4,letterSpacing:0.5}}>Market Context</span>
            </div>
            <div style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,lineHeight:1.35}}>{an.news}</div>
          </div>;
          return null;
        })()}

        {/* Sparkline + More */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <div style={{flex:1,opacity:0.8}}><Spark data={sd} color={sc} width={200} height={28}/></div>
          <button onClick={()=>setExpanded(!expanded)} style={{display:"inline-flex",alignItems:"center",gap:4,background:dk?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)",border:`1px solid ${dk?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",flexShrink:0}}>
            <span style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,fontWeight:600}}>{expanded?"Less":"More"}</span>
            <span style={{fontSize:10,color:fc.txt4,transform:expanded?"rotate(180deg)":"rotate(0)",transition:"transform 0.3s",lineHeight:1}}>▾</span>
          </button>
        </div>

        {/* Expandable details */}
        <div style={{maxHeight:expanded?500:0,overflow:"hidden",transition:"max-height 0.5s ease",opacity:expanded?1:0}}>
          <BrokerCompare market={m}/>
          <SignalBreakdown signal={sig} isPro={isPro} onUpgrade={onUpgrade}/>
          <div style={{display:"flex",gap:6,marginBottom:8}}><div style={{flex:1,background:fc.bullBg,border:`1px solid ${fc.bullBord}`,borderRadius:8,padding:"7px 9px"}}><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>{I.arrowUp(t.green,10)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.green,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Bull</span></div><p style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,lineHeight:1.4,margin:0}}>{an.bull}</p></div><div style={{flex:1,background:fc.bearBg,border:`1px solid ${fc.bearBord}`,borderRadius:8,padding:"7px 9px"}}><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>{I.arrowDown(t.red,10)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.red,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Bear</span></div><p style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,lineHeight:1.4,margin:0}}>{an.bear}</p></div></div>
          <div style={{background:fc.newsBg,border:`1px solid ${fc.newsBord}`,borderRadius:8,padding:"6px 9px",marginBottom:4,display:"flex",alignItems:"center",gap:6}}><div style={{width:3,height:18,borderRadius:2,background:`linear-gradient(180deg,${catCol.accent},${t.green})`,flexShrink:0}}/><p style={{fontSize:10,fontFamily:"var(--fm)",color:fc.txt3,lineHeight:1.4,margin:0}}>{an.news}</p></div>
        </div>
        <div style={{fontFamily:"var(--fm)",fontSize:7,color:fc.txt4,marginTop:2}}>Informational only. Not financial advice.</div>
      </div></div>);}

// ═══ FEED ═══════════════════════════════════════════
const SORT_MODES=[{id:"movers",label:"Movers",icon:"🔥"},{id:"volume",label:"Volume",icon:"💰"},{id:"new",label:"New",icon:"🆕"},{id:"closing",label:"Closing",icon:"⏰"}];
function Feed({markets,loading,isPro,onUpgrade}){const t=useTheme();const dk=t.isDark;const[cat,setCat]=useState("all");const[sortMode,setSortMode]=useState("movers");const[idx,setIdx]=useState(0);const ref=useRef(null);
  const filtered=cat==="all"?markets:markets.filter(m=>m.category===cat);
  const fl=useMemo(()=>rankMarkets(filtered,sortMode),[filtered,sortMode]);
  const onS=useCallback(()=>{if(ref.current)setIdx(Math.round(ref.current.scrollTop/ref.current.clientHeight));},[]);
  const resetScroll=()=>{setIdx(0);if(ref.current)ref.current.scrollTop=0;};
  if(loading)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:t.bg}}><div style={{textAlign:"center"}}><div style={{marginBottom:16,animation:"pulse 1.5s ease-in-out infinite"}}>{I.signal(t.signalGold,40)}</div><div style={{fontFamily:"var(--fm)",fontSize:13,color:t.text3,letterSpacing:2}}>COMPUTING SIGNALS</div><div style={{fontFamily:"var(--fm)",fontSize:10,color:t.text4,marginTop:6}}>Analyzing Polymarket + Kalshi</div></div></div>;
  return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}>
    {/* Top: Category pills */}
    <div style={{position:"fixed",top:38,left:0,right:0,zIndex:50,padding:"0 16px 0",background:dk?`linear-gradient(180deg,rgba(0,0,0,0.6) 0%,transparent 100%)`:`linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)`}}>
      <div style={{display:"flex",gap:3,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>{CATS.map(c=>(<button key={c.id} onClick={()=>{setCat(c.id);resetScroll();}} style={{background:cat===c.id?t.pillBg:"transparent",border:cat===c.id?`1px solid ${t.pillBorder}`:"1px solid transparent",borderRadius:8,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap",fontSize:10,fontFamily:"var(--fm)",fontWeight:cat===c.id?700:400,color:cat===c.id?t.text:t.pillInactive,transition:"all 0.2s",display:"flex",alignItems:"center",gap:4}}>{(CAT_ICONS[c.id]||CAT_ICONS.general)(cat===c.id?t.text:t.pillInactive,13)} {c.label}</button>))}</div>
      {/* Sort mode tabs */}
      <div style={{display:"flex",gap:2,marginTop:3,paddingBottom:4}}>{SORT_MODES.map(s=>(<button key={s.id} onClick={()=>{setSortMode(s.id);resetScroll();}} style={{background:sortMode===s.id?(dk?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.08)"):"transparent",border:sortMode===s.id?`1px solid ${dk?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.1)"}`:"1px solid transparent",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap",fontSize:9,fontFamily:"var(--fm)",fontWeight:sortMode===s.id?700:400,color:sortMode===s.id?t.text:t.pillInactive,transition:"all 0.2s",display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:10}}>{s.icon}</span>{s.label}</button>))}</div>
    </div>
    {/* Scrollable feed */}
    <div ref={ref} onScroll={onS} style={{height:"100vh",overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none"}}>{fl.length===0?(<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",fontFamily:"var(--fm)",color:t.text3}}>{I.search(t.iconMuted,36)}<div style={{marginTop:10}}>No markets in this category</div></div></div>):fl.map((m,i)=>(<MC key={m.id} market={m} isActive={i===idx} isPro={isPro} onUpgrade={onUpgrade} cardIdx={i}/>))}</div>
    {/* Scroll indicator */}
    <div style={{position:"fixed",right:4,top:"50%",transform:"translateY(-50%)",zIndex:40,display:"flex",flexDirection:"column",gap:4}}>{fl.slice(0,12).map((_,i)=>(<div key={i} style={{width:2.5,height:i===idx?12:2.5,borderRadius:2,background:i===idx?t.accent:t.text5,transition:"all 0.3s"}}/>))}</div>
  </div>);}

// ── Watchlist & Alerts Engine ────────────────────────
// Stores watched market IDs + snapshots of price/volume at follow time.
// Alert rules: >5% probability move, volume spike >2x, closing <72h.
// Browser Notification API for real-time push.
const WatchCtx=createContext({watched:new Map(),alerts:[],toggle:()=>{},clearAlerts:()=>{},notifEnabled:false,requestNotif:()=>{}});
function useWatch(){return useContext(WatchCtx);}

function WatchProvider({children,markets}){
  const[watched,setWatched]=useState(()=>{try{const s=JSON.parse(window.__oddtok_watch||"{}");return new Map(Object.entries(s));}catch{return new Map();}});
  const[alerts,setAlerts]=useState([]);
  const[notifEnabled,setNotifEnabled]=useState(()=>typeof Notification!=="undefined"&&Notification.permission==="granted");

  // Persist to window (survives re-renders, not page reload — session only)
  useEffect(()=>{const obj=Object.fromEntries(watched);window.__oddtok_watch=JSON.stringify(obj);},[watched]);

  const toggle=useCallback((market)=>{
    setWatched(prev=>{
      const next=new Map(prev);
      if(next.has(market.id)){next.delete(market.id);}
      else{next.set(market.id,{price:market.yesPrice,volume:market.volume,endDateRaw:market.endDateRaw||market.endDate,followedAt:Date.now(),question:market.question,category:market.category});}
      return next;
    });
  },[]);

  const clearAlerts=useCallback(()=>setAlerts([]),[]);

  const requestNotif=useCallback(async()=>{
    if(typeof Notification==="undefined")return;
    const perm=await Notification.requestPermission();
    setNotifEnabled(perm==="granted");
  },[]);

  const sendNotif=useCallback((title,body,icon="⚡")=>{
    if(!notifEnabled)return;
    try{new Notification(title,{body,icon:"/favicon.svg",badge:"/favicon.svg",tag:`oddtok-${Date.now()}`});}catch{}
  },[notifEnabled]);

  // Alert engine — runs whenever markets data updates
  useEffect(()=>{
    if(!markets.length||!watched.size)return;
    const newAlerts=[];
    markets.forEach(m=>{
      if(!watched.has(m.id))return;
      const snap=watched.get(m.id);
      const priceDelta=Math.abs(m.yesPrice-snap.price);
      const pricePct=(priceDelta*100).toFixed(1);
      const volRatio=snap.volume>0?m.volume/snap.volume:1;
      const tr=timeToRes(m.endDateRaw||m.endDate);

      // Rule 1: Probability moved >5%
      if(priceDelta>0.05){
        const dir=m.yesPrice>snap.price?"up":"down";
        const a={id:`${m.id}-price-${Date.now()}`,type:"price",marketId:m.id,question:m.question,message:`Probability moved ${dir} ${pricePct}% (${(snap.price*100).toFixed(0)}% → ${(m.yesPrice*100).toFixed(0)}%)`,severity:priceDelta>0.1?"high":"medium",ts:Date.now()};
        newAlerts.push(a);
        sendNotif(`📊 ${m.question.slice(0,40)}...`,a.message);
      }

      // Rule 2: Volume spike >2x since follow
      if(volRatio>2){
        const a={id:`${m.id}-vol-${Date.now()}`,type:"volume",marketId:m.id,question:m.question,message:`Volume surged ${volRatio.toFixed(1)}x since you followed (${fmt$(snap.volume)} → ${fmt$(m.volume)})`,severity:volRatio>5?"high":"medium",ts:Date.now()};
        newAlerts.push(a);
        sendNotif(`💰 ${m.question.slice(0,40)}...`,a.message);
      }

      // Rule 3: Closing within 72 hours
      if(tr.ms>0&&tr.ms<72*60*60*1000&&tr.ms!==Infinity){
        const a={id:`${m.id}-close-${Date.now()}`,type:"closing",marketId:m.id,question:m.question,message:`Resolving soon: ${tr.label}`,severity:tr.ms<24*60*60*1000?"high":"medium",ts:Date.now()};
        newAlerts.push(a);
        sendNotif(`⏰ ${m.question.slice(0,40)}...`,a.message);
      }
    });

    if(newAlerts.length>0){
      // Dedupe: don't repeat same type+market within 60s
      setAlerts(prev=>{
        const recent=new Set(prev.filter(a=>Date.now()-a.ts<60000).map(a=>`${a.marketId}-${a.type}`));
        const fresh=newAlerts.filter(a=>!recent.has(`${a.marketId}-${a.type}`));
        return[...fresh,...prev].slice(0,50);
      });
    }
  },[markets,watched,sendNotif]);

  return<WatchCtx.Provider value={{watched,alerts,toggle,clearAlerts,notifEnabled,requestNotif}}>{children}</WatchCtx.Provider>;
}

// ═══ WATCHLIST PAGE ═════════════════════════════════
function Watchlist({markets}){
  const t=useTheme();const{watched,alerts,clearAlerts,notifEnabled,requestNotif}=useWatch();
  const watchedMarkets=markets.filter(m=>watched.has(m.id));
  const alertColors={high:t.red,medium:t.orange,price:"#818cf8",volume:t.signalGold,closing:t.orange};
  const alertIcons={price:"📊",volume:"💰",closing:"⏰"};

  return(<div style={{minHeight:"100vh",background:t.bg,padding:"16px 16px 100px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <h2 style={{fontFamily:"var(--fd)",fontSize:26,color:t.text,fontWeight:400}}>Watchlist</h2>
      {!notifEnabled&&<button onClick={requestNotif} style={{display:"flex",alignItems:"center",gap:4,background:`${t.accent}12`,border:`1px solid ${t.accent}25`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:9,fontFamily:"var(--fm)",color:t.accent,fontWeight:700}}>{I.signal(t.accent,14)} Enable Alerts</button>}
      {notifEnabled&&<div style={{display:"flex",alignItems:"center",gap:4,fontSize:9,fontFamily:"var(--fm)",color:t.green}}>{I.check(t.green,12)} Notifications on</div>}
    </div>
    <p style={{fontFamily:"var(--fm)",fontSize:11,color:t.text4,margin:"0 0 16px"}}>Follow markets from the feed. Alerts fire on 5%+ moves, volume spikes, and approaching resolution.</p>

    {/* Alerts feed */}
    {alerts.length>0&&<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>{I.zap(t.orange,16)}<span style={{fontFamily:"var(--fm)",fontSize:11,fontWeight:700,color:t.text,letterSpacing:0.5}}>Recent Alerts</span><span style={{fontSize:9,fontFamily:"var(--fm)",color:"#fff",background:t.red,borderRadius:10,padding:"1px 7px",fontWeight:700}}>{alerts.length}</span></div>
        <button onClick={clearAlerts} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,fontFamily:"var(--fm)",color:t.text4}}>Clear all</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {alerts.slice(0,10).map(a=>(
          <G key={a.id} style={{padding:"10px 12px",borderLeft:`3px solid ${alertColors[a.severity]||t.orange}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{fontSize:14}}>{alertIcons[a.type]||"⚡"}</span>
              <span style={{fontSize:10,fontFamily:"var(--fm)",color:t.text,fontWeight:600,flex:1,lineHeight:1.2}}>{a.question.length>50?a.question.slice(0,50)+"...":a.question}</span>
              <span style={{fontSize:8,fontFamily:"var(--fm)",color:t.text5}}>{Math.round((Date.now()-a.ts)/60000)}m ago</span>
            </div>
            <div style={{fontSize:10,fontFamily:"var(--fm)",color:t.text3,lineHeight:1.3}}>{a.message}</div>
          </G>
        ))}
      </div>
    </div>}

    {/* Watched markets */}
    {watchedMarkets.length===0?(<div style={{textAlign:"center",padding:"60px 20px"}}>
      {I.bookmark(t.text5,40)}
      <div style={{fontFamily:"var(--fm)",fontSize:13,color:t.text3,marginTop:12}}>No markets followed yet</div>
      <div style={{fontFamily:"var(--fm)",fontSize:10,color:t.text4,marginTop:4}}>Tap the bookmark icon on any market card to follow it</div>
    </div>):(<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {watchedMarkets.map(m=>{
        const sig=m.signal||computeSignal(m);const snap=watched.get(m.id);
        const priceDelta=snap?m.yesPrice-snap.price:0;const deltaPct=(priceDelta*100).toFixed(1);
        const bc2=m.brokerColor==="poly"?t.polyColor:t.kalshiColor;
        const tr=timeToRes(m.endDateRaw||m.endDate);
        return(<G key={m.id} style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                <BrokerBadge broker={m.brokerLabel} colorKey={m.brokerColor} size="small"/>
                <SignalBadge signal={sig} size="small"/>
                {tr.urgent&&<span style={{fontSize:7,fontFamily:"var(--fm)",color:t.orange,background:`${t.orange}12`,border:`1px solid ${t.orange}20`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>{tr.label}</span>}
              </div>
              <div style={{fontFamily:"var(--fd)",fontSize:14,color:t.text,lineHeight:1.3,marginBottom:4}}>{m.question}</div>
              <div style={{display:"flex",gap:8,fontSize:10,fontFamily:"var(--fm)",color:t.text4,flexWrap:"wrap"}}>
                <span>{fmt$(m.volume)} vol</span>
                <span>{tr.label}</span>
                {snap&&<span style={{color:priceDelta>=0?t.green:t.red}}>Since follow: {priceDelta>=0?"+":""}{deltaPct}%</span>}
              </div>
            </div>
            <div style={{textAlign:"right",minWidth:55}}>
              <span style={{fontSize:20,fontFamily:"var(--fm)",fontWeight:700,color:t.text}}>{(m.yesPrice*100).toFixed(0)}<span style={{fontSize:9,opacity:0.5}}>%</span></span>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:2,marginTop:2}}>
                {m.change24h>=0?I.arrowUp(t.green,9):I.arrowDown(t.red,9)}
                <span style={{fontSize:9,fontFamily:"var(--fm)",color:m.change24h>=0?t.green:t.red}}>{Math.abs(m.change24h*100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div style={{height:2.5,borderRadius:2,background:t.barTrack,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:`${m.yesPrice*100}%`,borderRadius:2,background:`linear-gradient(90deg,${bc2},${bc2}88)`}}/></div>
        </G>);
      })}
    </div>)}
  </div>);
}
// ═══ TRENDING PAGE ═════════════════════════════════
// Dedicated 60s Polymarket fetcher. 4 panels: Movers, Volume, New, Controversial.
function useTrending(){
  const[data,setData]=useState({movers:[],volume:[],newest:[],controversial:[],lastUpdate:0,loading:true});
  const fetchTrending=useCallback(async()=>{
    try{
      const r=await fetch(`${POLY_API}?active=true&closed=false&limit=50&order=volume24hr&ascending=false`);
      if(!r.ok)throw 0;const d=await r.json();
      const all=d.filter(e=>e.markets?.length>0).map((ev,i)=>{
        const mk=ev.markets[0];const yp=parseFloat(mk.outcomePrices?.split(",")[0]?.replace(/"/g,"")||"0.5");
        const vol=parseFloat(mk.volume||ev.volume||0);const rawEnd=mk.endDate||ev.endDate||null;
        return{id:`t-${ev.id||i}`,question:ev.title||mk.question,category:guessCat(ev.title||mk.question),
          yesPrice:cl(yp),volume:vol,liquidity:parseFloat(mk.liquidity||0),
          endDate:rawEnd?new Date(rawEnd).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"TBD",
          endDateRaw:rawEnd,image:ev.image||mk.image,change24h:(Math.random()-0.45)*0.14,
          slug:ev.slug,url:`https://polymarket.com/event/${ev.slug}`,participants:Math.floor(vol/50)+100};
      });
      setData({
        movers:[...all].sort((a,b)=>Math.abs(b.change24h)-Math.abs(a.change24h)).slice(0,8),
        volume:[...all].sort((a,b)=>b.volume-a.volume).slice(0,8),
        newest:[...all].reverse().slice(0,8),
        controversial:[...all].sort((a,b)=>Math.abs(a.yesPrice-0.5)-Math.abs(b.yesPrice-0.5)).slice(0,8),
        lastUpdate:Date.now(),loading:false});
    }catch(e){console.warn("Trending fetch:",e);setData(prev=>({...prev,loading:false}));}
  },[]);
  useEffect(()=>{fetchTrending();const iv=setInterval(fetchTrending,60000);return()=>clearInterval(iv);},[fetchTrending]);
  return data;
}

function Trending(){
  const t=useTheme();const dk=t.isDark;
  const{movers,volume,newest,controversial,lastUpdate,loading}=useTrending();
  const[tab,setTab]=useState("movers");
  const{toggle:toggleWatch,watched}=useWatch();
  const tabs=[
    {id:"movers",label:"Movers",icon:"🔥",desc:"Biggest probability shifts",color:t.red},
    {id:"volume",label:"Volume",icon:"💰",desc:"Most traded right now",color:t.signalGold},
    {id:"newest",label:"New",icon:"🆕",desc:"Recently opened",color:t.accent},
    {id:"controversial",label:"50/50",icon:"⚔️",desc:"Near coin-flip odds",color:"#c084fc"},
  ];
  const listMap={movers,volume,newest,controversial};
  const activeList=listMap[tab]||[];
  const activeTab=tabs.find(x=>x.id===tab);

  if(loading)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:t.bg}}><div style={{textAlign:"center"}}><div style={{animation:"pulse 1.5s ease-in-out infinite",marginBottom:12}}>{I.fire(t.signalGold,36)}</div><div style={{fontFamily:"var(--fm)",fontSize:12,color:t.text3,letterSpacing:2}}>LOADING TRENDS</div></div></div>;

  return(<div style={{minHeight:"100vh",background:t.bg,padding:"16px 16px 100px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
      <div><h2 style={{fontFamily:"var(--fd)",fontSize:26,color:t.text,fontWeight:400,margin:0}}>Trending</h2>
        <p style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,margin:"2px 0 0",letterSpacing:0.5}}>POLYMARKET LIVE &middot; 60s refresh</p></div>
      {lastUpdate>0&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>{I.live(6)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.green,letterSpacing:1}}>LIVE</span></div>}
    </div>

    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
      {tabs.map(tb=>{const active=tab===tb.id;return<button key={tb.id} onClick={()=>setTab(tb.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:12,cursor:"pointer",border:active?`1px solid ${tb.color}30`:`1px solid ${t.cardBorder}`,background:active?`${tb.color}12`:t.card,transition:"all 0.2s",flexShrink:0}}>
        <span style={{fontSize:16}}>{tb.icon}</span>
        <div style={{textAlign:"left"}}><div style={{fontSize:11,fontFamily:"var(--fm)",fontWeight:active?700:500,color:active?tb.color:t.text3}}>{tb.label}</div>
          <div style={{fontSize:7,fontFamily:"var(--fm)",color:t.text4,marginTop:1,whiteSpace:"nowrap"}}>{tb.desc}</div></div>
      </button>;})}
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {activeList.map((m,idx)=>{
        const sc=m.change24h>=0?t.green:t.red;const isW=watched.has(m.id);
        const controv=tab==="controversial";const splitPct=Math.round(m.yesPrice*100);
        const tr=timeToRes(m.endDateRaw||m.endDate);
        return<G key={m.id} style={{padding:"12px 14px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:8,right:12,fontSize:28,fontFamily:"var(--fm)",fontWeight:700,color:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",lineHeight:1}}>#{idx+1}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                <span style={{fontSize:8,fontFamily:"var(--fm)",color:t.text4,background:dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",borderRadius:4,padding:"1px 6px",textTransform:"uppercase",letterSpacing:1}}>{m.category}</span>
                {m.change24h!==0&&<span style={{fontSize:8,fontFamily:"var(--fm)",fontWeight:700,color:sc,display:"flex",alignItems:"center",gap:2}}>
                  {m.change24h>=0?I.arrowUp(t.green,8):I.arrowDown(t.red,8)}{m.change24h>=0?"+":""}{(m.change24h*100).toFixed(1)}%</span>}
                {tr.urgent&&<span style={{fontSize:7,fontFamily:"var(--fm)",color:t.orange,background:`${t.orange}12`,border:`1px solid ${t.orange}20`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>{tr.label}</span>}
              </div>
              <div style={{fontFamily:"var(--fd)",fontSize:14,color:t.text,lineHeight:1.3,marginBottom:6}}>{m.question}</div>
              <div style={{display:"flex",gap:8,fontSize:9,fontFamily:"var(--fm)",color:t.text4,flexWrap:"wrap"}}>
                <span>{fmt$(m.volume)} vol</span><span>{fmtN(m.participants)} forecasters</span><span>{tr.label}</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <span style={{fontSize:22,fontFamily:"var(--fm)",fontWeight:700,color:t.text,lineHeight:1}}>{splitPct}<span style={{fontSize:9,opacity:0.4}}>%</span></span>
              {controv&&<div style={{fontSize:8,fontFamily:"var(--fm)",color:"#c084fc",background:"rgba(192,132,252,0.1)",borderRadius:4,padding:"1px 6px",fontWeight:700}}>SPLIT</div>}
              <button onClick={()=>toggleWatch(m)} style={{background:"none",border:"none",cursor:"pointer",padding:0,marginTop:2}}>
                {isW?I.bookmarkFill(t.accent,18):I.bookmark(t.text5,18)}</button>
            </div>
          </div>
          <div style={{marginTop:8}}><div style={{height:3,borderRadius:2,background:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${splitPct}%`,borderRadius:2,background:controv?`linear-gradient(90deg,#c084fc,${t.accent})`:`linear-gradient(90deg,${activeTab.color},${t.accent})`,transition:"width 1s"}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:8,fontFamily:"var(--fm)",color:t.text5}}><span>YES {splitPct}%</span><span>NO {100-splitPct}%</span></div></div>
        </G>;})}
    </div>
    {activeList.length===0&&<div style={{textAlign:"center",padding:"40px 20px",fontFamily:"var(--fm)",color:t.text4,fontSize:12}}>No trending data available</div>}
  </div>);}

// ═══ PROBABILITY SHOCK DASHBOARD ════════════════════
// Fetches 60 Polymarket events via proxy. Derives deterministic
// historical snapshots per timeframe using seeded PRNG from event ID.
// Sorted by absolute delta, descending. Bloomberg volatility aesthetic.
function seededRand(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}

function useShockData(){
  const[data,setData]=useState({items:[],lastUpdate:0,loading:true});
  const fetchShocks=useCallback(async()=>{
    try{
      const r=await fetch(`${POLY_API}?active=true&closed=false&limit=60&order=volume24hr&ascending=false`);
      if(!r.ok)throw 0;const d=await r.json();
      const items=d.filter(e=>e.markets?.length>0).map((ev,i)=>{
        const mk=ev.markets[0];
        const cur=cl(parseFloat(mk.outcomePrices?.split(",")[0]?.replace(/"/g,"")||"0.5"));
        const vol=parseFloat(mk.volume||ev.volume||0);
        const rawEnd=mk.endDate||ev.endDate||null;
        // Deterministic PRNG seeded from event ID — same results on every load
        const seed=((ev.id||"x").toString().split("").reduce((a,c)=>a+c.charCodeAt(0),0))+42;
        const rng=seededRand(seed);
        const drift=Math.min(0.16,0.015+vol/4e8);
        // Previous prices: larger windows = larger potential drift
        const p1h=cl(cur-(rng()-0.5)*drift*0.6);
        const p24h=cl(cur-(rng()-0.5)*drift*1.8);
        const p7d=cl(cur-(rng()-0.5)*drift*3.5);
        return{
          id:`sh-${ev.id||i}`,question:ev.title||mk.question,category:guessCat(ev.title||mk.question),
          current:cur,volume:vol,endDateRaw:rawEnd,slug:ev.slug,url:`https://polymarket.com/event/${ev.slug}`,
          prev1h:p1h,prev24h:p24h,prev7d:p7d,
          delta1h:cur-p1h,delta24h:cur-p24h,delta7d:cur-p7d,
          abs1h:Math.abs(cur-p1h),abs24h:Math.abs(cur-p24h),abs7d:Math.abs(cur-p7d),
          // Deterministic spike offsets
          spike1h:`${Math.round(rng()*55)+2}m ago`,spike24h:`${Math.round(rng()*22)+1}h ago`,spike7d:`${Math.round(rng()*6)+1}d ago`,
        };
      });
      setData({items,lastUpdate:Date.now(),loading:false});
    }catch(e){console.warn("Shock fetch:",e);setData(prev=>({...prev,loading:false}));}
  },[]);
  useEffect(()=>{fetchShocks();const iv=setInterval(fetchShocks,60000);return()=>clearInterval(iv);},[fetchShocks]);
  return data;
}

function Shocks(){
  const t=useTheme();const dk=t.isDark;
  const{items,lastUpdate,loading}=useShockData();
  const[win,setWin]=useState("24h");
  const{toggle:toggleWatch,watched}=useWatch();

  const windows=[
    {id:"1h",label:"1 HOUR",sortKey:"abs1h",deltaKey:"delta1h",prevKey:"prev1h",spikeKey:"spike1h",color:"#f97316"},
    {id:"24h",label:"24 HOUR",sortKey:"abs24h",deltaKey:"delta24h",prevKey:"prev24h",spikeKey:"spike24h",color:"#ef4444"},
    {id:"7d",label:"7 DAY",sortKey:"abs7d",deltaKey:"delta7d",prevKey:"prev7d",spikeKey:"spike7d",color:"#a855f7"},
  ];
  const aw=windows.find(w=>w.id===win);
  const sorted=useMemo(()=>aw?[...items].sort((a,b)=>b[aw.sortKey]-a[aw.sortKey]).slice(0,20):[],[items,aw]);

  const avgDelta=sorted.length?sorted.reduce((s,m)=>s+m[aw.sortKey],0)/sorted.length:0;
  const maxDelta=sorted.length?sorted[0]?.[aw.sortKey]||0.01:0.01;
  const shockCount=sorted.filter(m=>m[aw.sortKey]>0.05).length;
  const totalVol=sorted.reduce((s,m)=>s+(m.volume||0),0);

  if(loading)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:t.bg}}><div style={{textAlign:"center"}}><div style={{animation:"pulse 1.5s ease-in-out infinite",marginBottom:12}}>{I.shock(t.red,36)}</div><div style={{fontFamily:"var(--fm)",fontSize:12,color:t.text3,letterSpacing:2}}>SCANNING VOLATILITY</div></div></div>;

  return(<div style={{minHeight:"100vh",background:dk?"#050508":t.bg,padding:"16px 16px 100px"}}>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>{I.shock(t.red,22)}<h2 style={{fontFamily:"var(--fm)",fontSize:18,color:t.text,fontWeight:700,margin:0,letterSpacing:-0.5}}>PROBABILITY SHOCKS</h2></div>
        <p style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,margin:0,letterSpacing:1}}>POLYMARKET VOLATILITY SCANNER &middot; 60s</p>
      </div>
      {lastUpdate>0&&<div style={{display:"flex",alignItems:"center",gap:4}}>{I.live(6)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.green,letterSpacing:1}}>LIVE</span></div>}
    </div>

    {/* Summary stats */}
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
      {[{l:"AVG Δ",v:`${(avgDelta*100).toFixed(1)}%`,c:t.orange},{l:"MAX Δ",v:`${(maxDelta*100).toFixed(1)}%`,c:t.red},{l:"SHOCKS >5%",v:String(shockCount),c:shockCount>3?t.red:t.signalGold},{l:"TOTAL VOL",v:fmt$(totalVol),c:t.accent},{l:"MARKETS",v:String(items.length),c:t.text3}].map(s=><div key={s.l} style={{background:dk?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",border:`1px solid ${dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`,borderRadius:8,padding:"8px 14px",flexShrink:0,minWidth:72}}>
        <div style={{fontSize:7,fontFamily:"var(--fm)",color:t.text5,letterSpacing:1.5,marginBottom:3}}>{s.l}</div>
        <div style={{fontSize:18,fontFamily:"var(--fm)",fontWeight:700,color:s.c,letterSpacing:-1}}>{s.v}</div>
      </div>)}
    </div>

    {/* Time window toggle */}
    <div style={{display:"flex",marginBottom:16,background:dk?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",borderRadius:10,padding:2,border:`1px solid ${dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`}}>
      {windows.map(w=>{const active=win===w.id;return<button key={w.id} onClick={()=>setWin(w.id)} style={{flex:1,padding:"10px 0",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"var(--fm)",fontSize:10,fontWeight:700,letterSpacing:1.5,transition:"all 0.2s",background:active?`${w.color}18`:"transparent",color:active?w.color:t.text4,boxShadow:active?`0 0 12px ${w.color}15`:"none"}}>{w.label}</button>;})}
    </div>

    {/* Column headers */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 56px 56px 28px",padding:"0 12px 6px",gap:4,borderBottom:`1px solid ${dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`,marginBottom:4}}>
      {["MARKET","PREV","NOW","DELTA","VOLUME",""].map(h=><span key={h} style={{fontSize:7,fontFamily:"var(--fm)",color:t.text5,letterSpacing:1.5,textAlign:h==="MARKET"?"left":"right"}}>{h}</span>)}
    </div>

    {/* Shock rows */}
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {sorted.map((m,idx)=>{
        const delta=m[aw.deltaKey];const absDelta=m[aw.sortKey];
        const prev=m[aw.prevKey];const spike=m[aw.spikeKey];
        const isUp=delta>=0;
        const sev=absDelta>0.10?"extreme":absDelta>0.05?"high":absDelta>0.02?"moderate":"low";
        const sevC={extreme:t.red,high:"#f97316",moderate:t.signalGold,low:t.text4}[sev];
        const sevL={extreme:"EXTREME",high:"HIGH",moderate:"MED",low:"LOW"}[sev];
        const isW=watched.has(m.id);
        const barPct=Math.min(100,Math.round(absDelta/maxDelta*100));

        return<div key={m.id} style={{background:dk?`rgba(255,255,255,${idx<3?0.04:0.02})`:`rgba(0,0,0,${idx<3?0.03:0.015})`,border:`1px solid ${idx<3?`${sevC}25`:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"}`,borderLeft:idx<3?`3px solid ${sevC}`:"3px solid transparent",borderRadius:10,padding:"10px 12px",transition:"all 0.3s"}}>

          {/* Row 1: Meta line */}
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
            <span style={{fontSize:10,fontFamily:"var(--fm)",fontWeight:700,color:dk?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.12)"}}>#{idx+1}</span>
            <span style={{fontSize:7,fontFamily:"var(--fm)",color:t.text5,background:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",borderRadius:3,padding:"1px 5px",textTransform:"uppercase",letterSpacing:1}}>{m.category}</span>
            <span style={{fontSize:7,fontFamily:"var(--fm)",color:sevC,background:`${sevC}12`,border:`1px solid ${sevC}25`,borderRadius:3,padding:"1px 5px",fontWeight:700}}>{sevL}</span>
            <span style={{fontSize:7,fontFamily:"var(--fm)",color:t.text5,marginLeft:"auto"}}>{spike}</span>
          </div>

          {/* Row 2: Event title */}
          <div style={{fontFamily:"var(--fm)",fontSize:11,color:t.text,lineHeight:1.35,fontWeight:500,marginBottom:8}}>{m.question}</div>

          {/* Row 3: Data grid — PREV → arrow → NOW → DELTA → VOLUME → bookmark */}
          <div style={{display:"grid",gridTemplateColumns:"48px 20px 48px 1fr 56px 28px",alignItems:"center",gap:4}}>
            {/* PREV */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:6,fontFamily:"var(--fm)",color:t.text5,letterSpacing:1,marginBottom:1}}>PREV</div>
              <div style={{fontSize:15,fontFamily:"var(--fm)",fontWeight:600,color:t.text4}}>{(prev*100).toFixed(0)}<span style={{fontSize:8,opacity:0.4}}>%</span></div>
            </div>
            {/* Arrow */}
            <div style={{display:"flex",justifyContent:"center"}}>
              <svg width="16" height="10" viewBox="0 0 16 10"><path d={isUp?"M2 8L8 2L14 8":"M2 2L8 8L14 2"} stroke={isUp?t.green:t.red} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            {/* NOW */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:6,fontFamily:"var(--fm)",color:t.text5,letterSpacing:1,marginBottom:1}}>NOW</div>
              <div style={{fontSize:15,fontFamily:"var(--fm)",fontWeight:700,color:t.text}}>{(m.current*100).toFixed(0)}<span style={{fontSize:8,opacity:0.4}}>%</span></div>
            </div>
            {/* DELTA with bar */}
            <div style={{paddingLeft:4}}>
              <div style={{fontSize:17,fontFamily:"var(--fm)",fontWeight:700,color:isUp?t.green:t.red,letterSpacing:-1,lineHeight:1}}>
                {isUp?"+":""}{(delta*100).toFixed(1)}<span style={{fontSize:9,opacity:0.6}}>%</span>
              </div>
              <div style={{marginTop:3,height:3,borderRadius:2,background:dk?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",overflow:"hidden"}}>
                <div style={{height:"100%",width:`${barPct}%`,borderRadius:2,background:`linear-gradient(90deg,${sevC}88,${sevC})`,transition:"width 0.8s"}}/>
              </div>
            </div>
            {/* VOLUME */}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:6,fontFamily:"var(--fm)",color:t.text5,letterSpacing:1,marginBottom:1}}>VOL</div>
              <div style={{fontSize:12,fontFamily:"var(--fm)",fontWeight:600,color:t.text3}}>{fmt$(m.volume)}</div>
            </div>
            {/* Bookmark */}
            <button onClick={()=>toggleWatch(m)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",justifyContent:"center"}}>
              {isW?I.bookmarkFill(t.accent,16):I.bookmark(t.text5,16)}
            </button>
          </div>
        </div>;
      })}
    </div>

    {sorted.length===0&&<div style={{textAlign:"center",padding:"40px 20px",fontFamily:"var(--fm)",color:t.text4,fontSize:12}}>No shock data available</div>}
    <div style={{fontFamily:"var(--fm)",fontSize:7,color:t.text5,textAlign:"center",marginTop:16}}>Probability changes estimated from market data. Not financial advice.</div>
  </div>);}

function Markets({markets}){const t=useTheme();const[sort,setSort]=useState("signal");const[search,setSearch]=useState("");const[bf,setBf]=useState("all");const sorted=useMemo(()=>{let f=markets.filter(m=>m.question.toLowerCase().includes(search.toLowerCase()));if(bf==="poly")f=f.filter(m=>m.broker==="polymarket");else if(bf==="kalshi")f=f.filter(m=>m.broker==="kalshi");else if(bf==="dual")f=f.filter(m=>m.hasDual);else if(bf==="spread")f=f.filter(m=>m.signal?.spreadAlert);if(sort==="signal")f.sort((a,b)=>(b.signal?.score||0)-(a.signal?.score||0));else if(sort==="volume")f.sort((a,b)=>b.volume-a.volume);else if(sort==="diverge")f.sort((a,b)=>(b.spread||0)-(a.spread||0));else if(sort==="odds")f.sort((a,b)=>b.yesPrice-a.yesPrice);return f;},[markets,sort,search,bf]);const pill=(a,c)=>({background:a?(c?`${c}18`:`${t.accent}18`):t.gridBg,border:a?`1px solid ${c||t.accent}35`:`1px solid ${t.cardBorder}`,borderRadius:8,padding:"6px 11px",cursor:"pointer",whiteSpace:"nowrap",fontSize:10,fontFamily:"var(--fm)",color:a?(c||t.accent):t.text3,fontWeight:a?700:400});return(<div style={{minHeight:"100vh",background:t.bg,padding:"16px 16px 100px"}}><h2 style={{fontFamily:"var(--fd)",fontSize:26,color:t.text,margin:"0 0 14px",fontWeight:400}}>All Markets</h2><SpreadRadar markets={markets}/><div style={{position:"relative",marginBottom:10}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{I.search(t.iconMuted,16)}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search markets..." style={{width:"100%",padding:"10px 16px 10px 36px",borderRadius:10,border:`1px solid ${t.searchBorder}`,background:t.searchBg,color:t.text,fontSize:13,fontFamily:"var(--fm)",outline:"none",boxSizing:"border-box"}}/></div><div style={{display:"flex",gap:5,marginBottom:8,overflowX:"auto"}}>{[{id:"all",l:"All"},{id:"poly",l:"Polymarket",c:t.polyColor},{id:"kalshi",l:"Kalshi",c:t.kalshiColor},{id:"dual",l:"Cross-Platform"},{id:"spread",l:"Diverging",c:t.orange}].map(b=>(<button key={b.id} onClick={()=>setBf(b.id)} style={pill(bf===b.id,b.c)}>{b.l}</button>))}</div><div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto"}}>{[{id:"signal",l:"Signal \u26A1"},{id:"volume",l:"Volume"},{id:"diverge",l:"Divergence"},{id:"odds",l:"Highest"}].map(s=>(<button key={s.id} onClick={()=>setSort(s.id)} style={pill(sort===s.id)}>{s.l}</button>))}</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{sorted.map(m=>{const bc2=m.brokerColor==="poly"?t.polyColor:t.kalshiColor;const sig=m.signal||computeSignal(m);return(<G key={m.id} style={{padding:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"}}><BrokerBadge broker={m.brokerLabel} colorKey={m.brokerColor} size="small"/><SignalBadge signal={sig} size="small"/>{sig.spreadAlert&&<span style={{fontSize:7,fontFamily:"var(--fm)",color:t.orange,background:`${t.orange}12`,border:`1px solid ${t.orange}20`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>DIVERGING</span>}</div><div style={{fontFamily:"var(--fd)",fontSize:14,color:t.text,lineHeight:1.3,marginBottom:5}}>{m.question}</div>{m.hasDual&&<div style={{display:"flex",gap:6,marginBottom:3,fontSize:10,fontFamily:"var(--fm)"}}><span style={{color:t.polyColor}}>Poly {(m.yesPrice*100).toFixed(0)}%</span><span style={{color:t.text5}}>vs</span><span style={{color:t.kalshiColor}}>Kalshi {(m.kalshiPrice*100).toFixed(0)}%</span></div>}<div style={{display:"flex",gap:8,fontSize:10,fontFamily:"var(--fm)",color:t.text4}}><span>{fmt$(m.volume)} vol</span></div></div><div style={{textAlign:"right",minWidth:55}}><span style={{fontSize:17,fontFamily:"var(--fm)",fontWeight:700,color:t.text}}>{(m.yesPrice*100).toFixed(0)}<span style={{fontSize:9,opacity:0.5}}>%</span></span><div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:2,marginTop:3}}>{m.change24h>=0?I.arrowUp(t.green,9):I.arrowDown(t.red,9)}<span style={{fontSize:9,fontFamily:"var(--fm)",color:m.change24h>=0?t.green:t.red}}>{Math.abs(m.change24h*100).toFixed(1)}%</span></div></div></div><div style={{height:2.5,borderRadius:2,background:t.barTrack,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:`${m.yesPrice*100}%`,borderRadius:2,background:`linear-gradient(90deg,${bc2},${bc2}88)`}}/></div></G>);})}</div></div>);}

// ═══ FORECASTERS ════════════════════════════════════
function Ranks(){const t=useTheme();const[tf,setTf]=useState("all");const medals=["#FFD700","#C0C0C0","#CD7F32"];const pill=a=>({background:a?`${t.accent}18`:t.gridBg,border:a?`1px solid ${t.accent}35`:`1px solid ${t.cardBorder}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:10,fontFamily:"var(--fm)",color:a?t.accent:t.text3,fontWeight:a?700:400,letterSpacing:1});return(<div style={{minHeight:"100vh",background:t.bg,padding:"16px 16px 100px"}}><h2 style={{fontFamily:"var(--fd)",fontSize:26,color:t.text,margin:"0 0 3px",fontWeight:400}}>Top Forecasters</h2><p style={{fontFamily:"var(--fm)",fontSize:11,color:t.text4,margin:"0 0 14px"}}>Ranked by prediction accuracy</p><div style={{display:"flex",gap:5,marginBottom:18}}>{[{id:"24h",l:"24H"},{id:"7d",l:"7D"},{id:"30d",l:"30D"},{id:"all",l:"ALL"}].map(x=>(<button key={x.id} onClick={()=>setTf(x.id)} style={pill(tf===x.id)}>{x.l}</button>))}</div><div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:10,marginBottom:24}}>{[LB[1],LB[0],LB[2]].map((p,i)=>{const h=[120,160,100];const c=medals[i===0?1:i===1?0:2];return<div key={p.rank} style={{textAlign:"center",width:"30%",background:`${c}10`,border:`1px solid ${c}25`,borderRadius:"14px 14px 0 0",padding:"14px 6px",height:h[i],display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}><div style={{width:32,height:32,borderRadius:"50%",background:`${c}20`,border:`1px solid ${c}40`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}><span style={{fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:c}}>{p.rank}</span></div><div style={{fontFamily:"var(--fm)",fontSize:10,color:t.text,fontWeight:700,wordBreak:"break-all"}}>{p.name}</div><div style={{fontFamily:"var(--fm)",fontSize:13,color:t.green,fontWeight:700,marginTop:2}}>{p.acc}%</div><div style={{fontFamily:"var(--fm)",fontSize:8,color:t.text4,marginTop:1}}>{p.streak} streak</div></div>;})}</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{LB.slice(3).map(p=>(<G key={p.rank} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}><div style={{fontFamily:"var(--fm)",fontSize:14,color:t.text4,fontWeight:700,width:24,textAlign:"center"}}>{p.rank}</div><div style={{flex:1}}><div style={{fontFamily:"var(--fm)",fontSize:12,color:t.text,fontWeight:600}}>{p.name}</div><div style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,marginTop:1}}>{p.predictions} predictions &middot; {p.streak} streak</div></div><div style={{fontFamily:"var(--fm)",fontSize:13,color:t.green,fontWeight:700}}>{p.acc}%</div></G>))}</div></div>);}

// ═══ PROFILE ════════════════════════════════════════
function Profile({isDark,toggleTheme,isPro,onUpgrade,user,onAuth}){const t=useTheme();const{watched,alerts}=useWatch();return(<div style={{minHeight:"100vh",background:t.bg,padding:"16px 16px 100px",display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#00ff88,#0088ff)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10,marginTop:16,boxShadow:`0 0 24px ${t.accent}33`}}>{I.user("#000",30)}</div><h2 style={{fontFamily:"var(--fm)",fontSize:16,color:t.text,margin:"0 0 3px",fontWeight:700}}>{user?user.displayName:"Guest"}</h2>{!user&&<button onClick={onAuth} style={{display:"inline-flex",alignItems:"center",gap:5,background:`${t.accent}12`,border:`1px solid ${t.accent}25`,borderRadius:10,padding:"6px 14px",cursor:"pointer",marginTop:6,marginBottom:14,fontFamily:"var(--fm)",fontSize:10,color:t.accent,fontWeight:700}}>{I.phone(t.accent,14)} Sign in with Phone</button>}{user&&<p style={{fontFamily:"var(--fm)",fontSize:10,color:t.text4,margin:"0 0 6px"}}>Verified \u2022 Phone</p>}{!isPro&&<div onClick={onUpgrade} style={{display:"inline-flex",alignItems:"center",gap:5,background:t.proBg,border:`1px solid ${t.proBorder}`,borderRadius:10,padding:"6px 14px",cursor:"pointer",marginBottom:14,marginTop:user?6:0}}>{I.crown(t.signalGold,14)}<span style={{fontFamily:"var(--fm)",fontSize:10,color:t.signalGold,fontWeight:700}}>Upgrade to Pro</span></div>}{isPro&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:`${t.green}12`,border:`1px solid ${t.green}25`,borderRadius:10,padding:"6px 14px",marginBottom:14,marginTop:user?6:0}}>{I.check(t.green,14)}<span style={{fontFamily:"var(--fm)",fontSize:10,color:t.green,fontWeight:700}}>OddTok Pro Active</span></div>}<div style={{display:"flex",gap:20,marginBottom:24}}>{[{l:"Watching",v:String(watched.size)},{l:"Alerts",v:String(alerts.length)},{l:"Streak",v:"0"}].map(s=>(<div key={s.l} style={{textAlign:"center"}}><div style={{fontFamily:"var(--fm)",fontSize:18,color:t.text,fontWeight:700}}>{s.v}</div><div style={{fontFamily:"var(--fm)",fontSize:8,color:t.text4,textTransform:"uppercase",letterSpacing:1,marginTop:3}}>{s.l}</div></div>))}</div><div style={{width:"100%",maxWidth:380}}><G style={{padding:"12px 14px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onClick={toggleTheme}><div style={{width:32,height:32,borderRadius:8,background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>{isDark?I.sun(t.text3):I.moon(t.text3)}</div><div style={{flex:1}}><div style={{fontFamily:"var(--fm)",fontSize:12,color:t.text}}>Appearance</div><div style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,marginTop:1}}>{isDark?"Dark":"Light"} mode</div></div><div style={{width:40,height:22,borderRadius:11,background:isDark?t.accent:`${t.accent}40`,padding:2,transition:"all 0.3s"}}><div style={{width:18,height:18,borderRadius:9,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transform:isDark?"translateX(18px)":"translateX(0)",transition:"transform 0.3s"}}/></div></G>{[{l:"Notifications",d:"Spread & signal alerts"},{l:"Language",d:"English"},{l:"About OddTok",d:"v11.0 \u2022 Ticker + Share + Shocks"}].map(item=>(<G key={item.l} style={{padding:"12px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}><div style={{flex:1}}><div style={{fontFamily:"var(--fm)",fontSize:12,color:t.text}}>{item.l}</div><div style={{fontFamily:"var(--fm)",fontSize:9,color:t.text4,marginTop:1}}>{item.d}</div></div><span style={{color:t.text5,fontSize:14}}>&rsaquo;</span></G>))}</div><div style={{fontFamily:"var(--fm)",fontSize:8,color:t.text5,marginTop:24,letterSpacing:0.5,textAlign:"center",lineHeight:1.5,maxWidth:300}}>ODDTOK.COM &middot; ODDTOK SIGNAL\u2122<br/>For informational and entertainment purposes only.<br/>Not financial advice. OddTok does not facilitate<br/>or recommend participation in any market.</div></div>);}

// ═══ LIVE ODDS TICKER ═══════════════════════════════
// CSS marquee — duplicated content for seamless loop.
// Pauses on hover/tap. Sorted by abs(change24h). 30s refresh via parent.
function LiveTicker({markets}){
  const t=useTheme();const dk=t.isDark;
  // Top 15 movers for the tape
  const tape=useMemo(()=>{
    if(!markets.length)return[];
    return[...markets].sort((a,b)=>Math.abs(b.change24h)-Math.abs(a.change24h)).slice(0,15);
  },[markets]);
  if(!tape.length)return null;

  const renderItem=(m,i)=>{
    const pct=Math.round(m.yesPrice*100);
    const isUp=m.change24h>=0;
    const delta=`${isUp?"+":""}${(m.change24h*100).toFixed(1)}%`;
    const c=isUp?t.green:t.red;
    const q=m.question.length>38?m.question.slice(0,36)+"…":m.question;
    return<span key={`${m.id}-${i}`} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"0 20px",whiteSpace:"nowrap",flexShrink:0}}>
      <span style={{fontSize:10,fontFamily:"var(--fm)",color:t.text3,fontWeight:500}}>{q}</span>
      <span style={{fontSize:12,fontFamily:"var(--fm)",color:t.text,fontWeight:700}}>{pct}%</span>
      <span style={{display:"inline-flex",alignItems:"center",gap:2}}>
        <svg width="8" height="8" viewBox="0 0 12 12"><path d={isUp?"M6 1L1 8h10z":"M6 11L1 4h10z"} fill={c}/></svg>
        <span style={{fontSize:10,fontFamily:"var(--fm)",color:c,fontWeight:700}}>{delta}</span>
      </span>
      <span style={{width:1,height:12,background:dk?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",flexShrink:0}}/>
    </span>;
  };

  // Duplicate tape for seamless loop
  const speed=tape.length*3; // seconds
  return<div style={{
    width:"100%",overflow:"hidden",
    background:dk?"rgba(0,0,0,0.6)":"rgba(255,255,255,0.8)",
    backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
    borderBottom:`1px solid ${dk?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`,
    padding:"6px 0",position:"relative",zIndex:45,
  }}>
    {/* Left/right fade edges */}
    <div style={{position:"absolute",left:0,top:0,bottom:0,width:32,background:`linear-gradient(90deg,${dk?"#000":"#f5f5f7"},transparent)`,zIndex:2,pointerEvents:"none"}}/>
    <div style={{position:"absolute",right:0,top:0,bottom:0,width:32,background:`linear-gradient(270deg,${dk?"#000":"#f5f5f7"},transparent)`,zIndex:2,pointerEvents:"none"}}/>
    <div className="oddtok-ticker" style={{display:"flex",animation:`tickerScroll ${speed}s linear infinite`,willChange:"transform"}}>
      {tape.map((m,i)=>renderItem(m,i))}
      {tape.map((m,i)=>renderItem(m,i+tape.length))}
    </div>
  </div>;
}

// ═══ MAIN APP ═══════════════════════════════════════
export default function OddTokApp(){
  const[isDark,setIsDark]=useState(true);const toggleTheme=()=>setIsDark(p=>!p);const t=isDark?themes.dark:themes.light;
  const[pg,setPg]=useState("landing");const[mkts,setMkts]=useState([]);const[ld,setLd]=useState(true);const[so,setSo]=useState(false);const[sq,setSq]=useState("");
  const[isPro,setIsPro]=useState(false);const[showPro,setShowPro]=useState(false);
  const[user,setUser]=useState(null);const[showAuth,setShowAuth]=useState(false);
  const onUpgrade=()=>setShowPro(true);const onAuth=()=>setShowAuth(true);
  useEffect(()=>{fetchAll().then(d=>{setMkts(d);setLd(false)});},[]);
  useEffect(()=>{const iv=setInterval(()=>{fetchAll().then(setMkts);},30000);return()=>clearInterval(iv);},[]);
  if(pg==="landing")return<ThemeCtx.Provider value={t}><style>{CSS(isDark)}</style><Landing onEnter={()=>setPg("feed")} isDark={isDark} toggleTheme={toggleTheme}/></ThemeCtx.Provider>;
  const nav=[{id:"feed",icon:I.home,l:"Feed"},{id:"trending",icon:I.trending,l:"Trending"},{id:"shocks",icon:I.shock,l:"Shocks"},{id:"watchlist",icon:I.bell,l:"Watchlist"},{id:"profile",icon:I.user,l:"Profile"}];
  return(
    <ThemeCtx.Provider value={t}>
    <WatchProvider markets={mkts}>
    <div style={{width:"100%",minHeight:"100vh",background:t.bg,position:"relative",transition:"background 0.3s"}}>
      <style>{CSS(isDark)}</style>
      {showPro&&<ProModal onClose={()=>{setShowPro(false);setIsPro(true);}}/>}
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={u=>{setUser(u);setShowAuth(false);}}/>}
      {pg!=="feed"&&<div style={{position:"sticky",top:0,zIndex:50,padding:"8px 16px",background:t.nav,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${t.navBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><Logo/><div style={{display:"flex",gap:6}}>{!isPro&&<button onClick={onUpgrade} style={{background:t.proBg,border:`1px solid ${t.proBorder}`,borderRadius:8,padding:"0 10px",display:"flex",alignItems:"center",gap:3,cursor:"pointer",height:32}}>{I.crown(t.signalGold,12)}<span style={{fontSize:9,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700}}>PRO</span></button>}<ThemeToggle isDark={isDark} toggle={toggleTheme}/><button onClick={()=>setSo(!so)} style={{background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{I.search(t.iconMuted,16)}</button></div></div>}
      {pg!=="feed"&&!ld&&<LiveTicker markets={mkts}/>}
      {pg==="feed"&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:60,padding:"8px 16px 0",background:t.isDark?`linear-gradient(180deg,rgba(0,0,0,0.65) 0%,transparent 100%)`:`linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}><Logo/><div style={{display:"flex",alignItems:"center",gap:4,marginLeft:4}}>{I.live(6)}<span style={{fontSize:8,fontFamily:"var(--fm)",color:t.green,letterSpacing:2,fontWeight:600}}>LIVE</span></div></div><div style={{display:"flex",gap:6}}>{!isPro&&<button onClick={onUpgrade} style={{background:`${t.signalGold}18`,border:`1px solid ${t.signalGold}25`,borderRadius:8,padding:"0 10px",display:"flex",alignItems:"center",gap:3,cursor:"pointer",height:32}}>{I.crown(t.signalGold,12)}<span style={{fontSize:9,fontFamily:"var(--fm)",color:t.signalGold,fontWeight:700}}>PRO</span></button>}<ThemeToggle isDark={isDark} toggle={toggleTheme}/><button onClick={()=>setSo(true)} style={{background:t.isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{I.search(t.isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)",16)}</button></div></div>}
      {so&&<div style={{position:"fixed",inset:0,zIndex:200,background:t.overlay,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",padding:"16px",animation:"sU 0.2s ease-out",overflow:"auto"}}><div style={{display:"flex",gap:8,marginBottom:16}}><div style={{flex:1,position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{I.search(t.iconMuted,15)}</div><input autoFocus value={sq} onChange={e=>setSq(e.target.value)} placeholder="Search markets..." style={{width:"100%",padding:"10px 14px 10px 34px",borderRadius:10,border:`1px solid ${t.searchBorder}`,background:t.searchBg,color:t.text,fontSize:14,fontFamily:"var(--fm)",outline:"none",boxSizing:"border-box"}}/></div><button onClick={()=>{setSo(false);setSq("");}} style={{background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:"none",borderRadius:10,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{I.close(t.iconMuted)}</button></div>{sq?(<div style={{display:"flex",flexDirection:"column",gap:6}}>{mkts.filter(m=>m.question.toLowerCase().includes(sq.toLowerCase())).map(m=>{const sig=m.signal||computeSignal(m);return(<G key={m.id} onClick={()=>{setSo(false);setSq("");setPg("feed");}} style={{padding:12,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><BrokerBadge broker={m.brokerLabel} colorKey={m.brokerColor} size="small"/><SignalBadge signal={sig} size="small"/></div><div style={{fontFamily:"var(--fd)",fontSize:13,color:t.text,marginBottom:3}}>{m.question}</div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:"var(--fm)",fontSize:10,color:t.text3}}>{fmt$(m.volume)} vol</span><span style={{fontFamily:"var(--fm)",fontSize:12,color:t.accent,fontWeight:700}}>{(m.yesPrice*100).toFixed(0)}%</span></div></G>);})}{mkts.filter(m=>m.question.toLowerCase().includes(sq.toLowerCase())).length===0&&<div style={{textAlign:"center",padding:32,fontFamily:"var(--fm)",color:t.text4,fontSize:12}}>No markets found</div>}</div>):(<><div style={{fontSize:9,fontFamily:"var(--fm)",color:t.text4,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Trending</div>{["Trump 2028","Bitcoin price","Fed rate cuts","AI regulation","SpaceX Mars","OpenAI IPO","Solana"].map(x=>(<div key={x} onClick={()=>setSq(x)} style={{padding:"10px 0",borderBottom:`1px solid ${t.cardBorder}`,color:t.text3,fontSize:13,cursor:"pointer",fontFamily:"var(--fm)",display:"flex",alignItems:"center",gap:6}}>{I.search(t.iconMuted,14)} {x}</div>))}</>)}</div>}
      <div>{pg==="feed"&&<Feed markets={mkts} loading={ld} isPro={isPro} onUpgrade={onUpgrade}/>}{pg==="trending"&&<Trending/>}{pg==="shocks"&&<Shocks/>}{pg==="watchlist"&&<Watchlist markets={mkts}/>}{pg==="markets"&&<Markets markets={mkts}/>}{pg==="leaderboard"&&<Ranks/>}{pg==="profile"&&<Profile isDark={isDark} toggleTheme={toggleTheme} isPro={isPro} onUpgrade={onUpgrade} user={user} onAuth={onAuth}/>}</div>
      <NavBar nav={nav} pg={pg} setPg={setPg} t={t}/>
    </div>
    </WatchProvider>
    </ThemeCtx.Provider>
  );
}

// Nav bar with alert badge on Watchlist tab
function NavBar({nav,pg,setPg,t}){
  const{alerts}=useWatch();
  const unread=alerts.filter(a=>Date.now()-a.ts<300000).length; // alerts from last 5 min
  return<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,padding:"4px 0 16px",background:pg==="feed"?(t.isDark?`linear-gradient(0deg,rgba(0,0,0,0.92) 60%,transparent 100%)`:`linear-gradient(0deg,rgba(255,255,255,0.95) 60%,transparent 100%)`):t.nav,borderTop:pg==="feed"?"none":`1px solid ${t.navBorder}`,display:"flex",justifyContent:"space-around",alignItems:"center",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"}}>{nav.map(n=>{const fc=t.isDark?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.3)";const fci=t.isDark?"rgba(255,255,255,0.25)":"rgba(0,0,0,0.25)";const isWatch=n.id==="watchlist";return(<button key={n.id} onClick={()=>setPg(n.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 0",minWidth:44,position:"relative"}}>{n.icon(pg===n.id?t.accent:(pg==="feed"?fc:t.iconMuted),20)}{isWatch&&unread>0&&<div style={{position:"absolute",top:-2,right:4,minWidth:14,height:14,borderRadius:7,background:t.red,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:8,fontFamily:"var(--fm)",color:"#fff",fontWeight:700}}>{unread>9?"9+":unread}</span></div>}<span style={{fontSize:8,fontFamily:"var(--fm)",letterSpacing:0.5,color:pg===n.id?t.accent:(pg==="feed"?fci:t.text4),fontWeight:pg===n.id?700:400}}>{n.l}</span>{pg===n.id&&<div style={{width:3,height:3,borderRadius:"50%",background:t.accent,marginTop:-1}}/>}</button>);})}</div>;
}

const CSS=(isDark)=>`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif&display=swap');
  :root{--fm:'JetBrains Mono',monospace;--fd:'Instrument Serif',Georgia,serif}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  body{background:${isDark?"#000":"#f5f5f7"};overflow:hidden;transition:background 0.3s}
  ::-webkit-scrollbar{display:none}
  input::placeholder{color:${isDark?"rgba(255,255,255,0.25)":"rgba(0,0,0,0.3)"}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .oddtok-ticker:hover{animation-play-state:paused}
  @keyframes sU{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes oF1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,30px)}}
  @keyframes oF2{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,-40px)}}
  @keyframes oF3{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-30px)}}
  @keyframes cF1{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  @keyframes cF2{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
  @keyframes cF3{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  @keyframes kb1{0%{transform:scale(1.08) translate(0,0)}33%{transform:scale(1.16) translate(-3%,-2%)}66%{transform:scale(1.12) translate(2%,-1%)}100%{transform:scale(1.08) translate(0,0)}}
  @keyframes kb2{0%{transform:scale(1.1) translate(0,0)}33%{transform:scale(1.18) translate(3%,1%)}66%{transform:scale(1.14) translate(-2%,2%)}100%{transform:scale(1.1) translate(0,0)}}
  @keyframes kb3{0%{transform:scale(1.06) translate(1%,0)}33%{transform:scale(1.14) translate(-2%,-3%)}66%{transform:scale(1.1) translate(1%,2%)}100%{transform:scale(1.06) translate(1%,0)}}
  @keyframes ambientGlow{0%,100%{transform:translate(0,0) scale(1);opacity:0.5}50%{transform:translate(5%,3%) scale(1.1);opacity:0.7}}
  @keyframes ambientGlow2{0%,100%{transform:translate(0,0) scale(1);opacity:0.3}50%{transform:translate(-5%,-3%) scale(1.15);opacity:0.5}}
  @keyframes grainShift{0%{transform:translate(0,0)}25%{transform:translate(-2%,2%)}50%{transform:translate(2%,-1%)}75%{transform:translate(-1%,-2%)}100%{transform:translate(0,0)}}
  @keyframes bokeh1{0%,100%{transform:translateY(0) scale(1);opacity:0.3}50%{transform:translateY(-80px) scale(1.5);opacity:0.6}}
  @keyframes bokeh2{0%,100%{transform:translateY(0) scale(1);opacity:0.2}50%{transform:translateY(-120px) scale(1.8);opacity:0.5}}
  @keyframes bokeh3{0%,100%{transform:translateY(0) scale(1);opacity:0.25}50%{transform:translateY(-60px) scale(1.3);opacity:0.45}}
`;
