const { Pool } = require('pg'); // import Pool from pg
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to DB');
  release();
});
 
pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
  // server keeps running
});
module.exports = pool;