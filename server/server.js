require('dotenv').config();
// Força IPv4 em todas resoluções DNS — necessário no Render free tier
// que não roteia IPv6 para o Supabase
require('dns').setDefaultResultOrder('ipv4first');
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`MenuQR server running on port ${PORT} — v${new Date().toISOString().slice(0,10)}`);
});
