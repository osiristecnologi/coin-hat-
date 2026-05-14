const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(express.json());

// CORS - libera teu GitHub Pages
app.use(cors({
  origin: ['http://localhost:3000', 'https://SEUUSER.github.io'] 
  // Troca SEUUSER pelo teu user do GitHub
}));

// Rate limit pra 2000 pessoas não derrubar
app.use('/api/', rateLimit({ 
  windowMs: 60000, 
  max: 100,
  message: 'Calma aí, muitas requisições'
}));

// ROTA DOS TOKENS - exemplo fake
app.get('/api/coins', async (req, res) => {
  // Aqui tu bota tua lógica real pra pegar os tokens
  const tokens = [
    { name: 'Bonk', symbol: 'BONK', price: 0.000023, change24h: 5.2, address: 'DezXAZ8z7PnrnRJjz3wXBoR', logo: 'https://arweave.net/bonk.png' },
    { name: 'Wif', symbol: 'WIF', price: 2.34, change24h: -1.8, address: 'EKpQGSJtjMFqKZ5KQzi' }
  ];
  res.json({ tokens });
});

// ROTA DO SWAP - exemplo fake
app.post('/api/swap', async (req, res) => {
  const { outputMint, amount = 0.1 } = req.body;
  // Aqui tu gera a URL do Jupiter com tua taxa
  const url = `https://jup.ag/swap/SOL-${outputMint}?feeBps=100`;
  res.json({ url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Coinhat API rodando na ' + PORT));
