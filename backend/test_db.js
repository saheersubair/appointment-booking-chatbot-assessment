const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'chatbot_db',
  password: 'Zaheer123', // Replace with your password
  port: 5432,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully!');
    
    const result = await client.query('SELECT version();');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    client.release();
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

testConnection();