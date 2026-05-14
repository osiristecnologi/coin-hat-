// ═══════════════════════════════════════════════
//  COINHAT-FEEDS — server.js
//  API Base: https://coinhat.onrender.com
//  Jupiter v6 swap com platformFeeBps + feeAccount
// ═══════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARES ──────────────────────────────────
app.use(cors());
app.use(express.json());

// ── CONSTANTES JUPITER v6 ───────────────────────
const INPUT_MINT  = 'So11111111111111111111111111111111111111112'; // SOL (wrapped)
const INPUT_LABEL = 'SOL';
const FEE_WALLET  = '9GXNpv77WRacQfPaEdBog91uYFnJwdzJfiwuDWiAxgCs';
const FEE_BPS     = 100;   // 100 bps = 1%

// Jupiter v6 Quote API (para validar o outputMint antes de gerar URL)
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
// Jupiter referral program (para receber a taxa on-chain)
const JUPITER_REFERRAL  = FEE_WALLET;

// ── RATE LIMIT SIMPLES ───────────────────────────
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000; // 1 minuto
  const maxReqs  = 30;

  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  rateMap.set(ip, entry);

  if (entry.count > maxReqs) {
    return res.status(429).json({
      error: 'Muitos acessos. Tente novamente em 1 minuto.',
    });
  }
  next();
}

app.use(rateLimit);

// ── HEALTH ──────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'coinhat-feeds' });
});

// ── GET /api/coins ───────────────────────────────
// Retorna lista de memecoins Solana via DexScreener
app.get('/api/coins', async (_req, res) => {
  try {
    // Top boosted tokens na Solana
    const boostRes  = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const boosts    = await boostRes.json();

    const solBoosts = boosts
      .filter(t => t.chainId === 'solana')
      .slice(0, 20)
      .map(t => t.tokenAddress)
      .join(',');

    if (!solBoosts) {
      return res.json([]);
    }

    const pairsRes  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${solBoosts}`);
    const pairsData = await pairsRes.json();

    // Deduplica por endereço e pega o par com maior liquidez
    const seen = new Map();
    for (const pair of (pairsData.pairs || [])) {
      if (pair.chainId !== 'solana') continue;
      const key = pair.baseToken?.address;
      if (!key) continue;
      const liq     = parseFloat(pair.liquidity?.usd || 0);
      const current = seen.get(key);
      if (!current || liq > parseFloat(current.liquidity?.usd || 0)) {
        seen.set(key, pair);
      }
    }

    const coins = [...seen.values()].slice(0, 24).map(pair => ({
      name      : pair.baseToken?.name    || '—',
      symbol    : pair.baseToken?.symbol  || '—',
      address   : pair.baseToken?.address || '',
      price     : parseFloat(pair.priceUsd || 0),
      change24h : parseFloat(pair.priceChange?.h24 || 0),
      volume24h : parseFloat(pair.volume?.h24 || 0),
      marketCap : parseFloat(pair.marketCap || 0),
      liquidity : parseFloat(pair.liquidity?.usd || 0),
      logo      : pair.info?.imageUrl || '',
      pairAddress: pair.pairAddress || '',
    }));

    res.json(coins);
  } catch (err) {
    console.error('Erro /api/coins:', err.message);
    res.status(500).json({ error: 'Erro ao buscar tokens' });
  }
});

// ── POST /api/swap ───────────────────────────────
//
//  Body  : { outputMint: string, amount?: number }
//  Retorno: { url: string }
//
//  Jupiter v6:
//    • platformFeeBps  → bps de taxa (100 = 1%)
//    • feeAccount      → carteira que recebe a taxa on-chain
//    • REMOVIDO feeBps → descontinuado na v6
//
app.post('/api/swap', async (req, res) => {
  try {
    const { outputMint, amount = 0.1 } = req.body;

    // ── Validação ──
    if (!outputMint || typeof outputMint !== 'string') {
      return res.status(400).json({
        error: 'outputMint é obrigatório e deve ser uma string',
      });
    }

    // Aceita endereço Solana (base58, 32-44 chars) ou símbolo curto
    const isMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(outputMint.trim());
    if (!isMint) {
      return res.status(400).json({
        error: 'outputMint inválido — deve ser um endereço Solana base58',
      });
    }

    // ── Monta URL Jupiter v6 ──
    //
    //  Parâmetros relevantes:
    //    inputMint        → SOL nativo (endereço wrapped)
    //    outputMint       → token destino
    //    inAmount         → quantidade de entrada (em SOL, exibição)
    //    platformFeeBps   → taxa da plataforma em basis points (100 = 1%)
    //    feeAccount       → conta que recebe a taxa (referral wallet)
    //
    //  NOTA: platformFeeBps e feeAccount são os parâmetros corretos do
    //  Jupiter v6. O parâmetro "feeBps" foi descontinuado na v5/v6.
    //
    const params = new URLSearchParams({
      inputMint     : INPUT_MINT,
      outputMint    : outputMint.trim(),
      inAmount      : amount,
      platformFeeBps: FEE_BPS,      // 100 bps = 1%
      feeAccount    : FEE_WALLET,   // recebe taxa on-chain
    });

    const url = `https://jup.ag/swap/${INPUT_LABEL}-${outputMint.trim()}?${params.toString()}`;

    // Log para monitorar
    console.log(`[swap] outputMint=${outputMint} amount=${amount} url=${url}`);

    return res.json({ url });

  } catch (error) {
    console.error('Erro /api/swap:', error);
    return res.status(500).json({ error: 'Erro ao gerar link de swap' });
  }
});

// ── 404 ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── START ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Coinhat-Feeds rodando na porta ${PORT}`);
  console.log(`   FEE_WALLET : ${FEE_WALLET}`);
  console.log(`   FEE_BPS    : ${FEE_BPS} (${FEE_BPS / 100}%)`);
  console.log(`   INPUT_MINT : ${INPUT_MINT} (SOL)`);
});
