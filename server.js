const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(express.json());

// CORS LIBERADO GERAL - depois tu restringe se quiser
app.use(cors());

// Rate limit pra 2000 pessoas não derrubar
const limiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: { error: 'Calma aí, muitas requisições. Espera 1min' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// HEALTHCHECK - pro Render saber que tá vivo
app.get('/health', (req, res) => {
  res.json({ status: 'Coinhat API online', time: new Date() });
});

// ROTA DOS TOKENS
app.get('/api/coins', async (req, res) => {
  try {
    // MOCK - aqui tu troca pela tua lógica real do Jupiter/Birdeye
    const tokens = [
      { 
        name: 'Bonk', 
        symbol: 'BONK', 
        price: 0.000023, 
        change24h: 5.2, 
        address: 'DezXAZ8z7PnrnRJjz3wXBoR',
        logo: 'https://arweave.net/bonk-logo.png' 
      },
      { 
        name: 'dogwifhat', 
        symbol: 'WIF', 
        price: 2.34, 
        change24h: -1.8, 
        address: 'EKpQGSJtjMFqKZ5KQzi',
        logo: 'https://bafkreibk3covs5l3t5sukw7h4odkdoe3f3d4z5j4y5m5s5t5s5t.ipfs.w3s.link' 
      }
    ];
    
    res.json({ tokens });
  } catch (error) {
    console.error('Erro /api/coins:', error);
    res.status(500).json({ error: 'Erro ao buscar tokens' });
  }
});

// ROTA DO SWAP
app.post('/api/swap', async (req, res) => {
  try {
    const { outputMint, amount = 0.1 } = req.body;
    
    if (!outputMint) {
      return res.status(400).json({ error: 'outputMint é obrigatório' });
    }

    // URL do Jupiter com taxa de 1% = 100 bps
    const url = `https://jup.ag/swap/SOL-${outputMint}?inAmount=${amount}&feeBps=100`;
    
    res.json({ url });
  } catch (error) {
    console.error('Erro /api/swap:', error);
    res.status(500).json({ error: 'Erro ao gerar link de swap' });
  }
});

// 404 pra rota que não existe
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada, parça' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Coinhat API rodando na porta ${PORT}`));
