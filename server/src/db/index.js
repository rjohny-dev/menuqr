const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? {
        // rejectUnauthorized: true é o ideal — requer cert CA do Supabase no env
        // Se SUPABASE_SSL_CERT não estiver configurado, cai no modo menos seguro
        // Ver tutorial manual: HIGH-05
        rejectUnauthorized: process.env.SUPABASE_SSL_CERT ? true : false,
        ca: process.env.SUPABASE_SSL_CERT || undefined,
      }
    : false,
  max: 10,                     // máximo de conexões simultâneas
  idleTimeoutMillis: 30000,    // fechar conexões ociosas após 30s
  connectionTimeoutMillis: 5000, // timeout ao tentar nova conexão
});

module.exports = pool;
