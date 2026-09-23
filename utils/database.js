import pkg from 'pg';

const { Pool } = pkg;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      port: Number(process.env.PGPORT) || 5432,
      ssl: { rejectUnauthorized: false },
    };

export const pool = new Pool(poolConfig);

export async function initActivityTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS user_activity (
  user_id VARCHAR(32) PRIMARY KEY,
  username VARCHAR(255),
  last_active_date DATE,
  activity_streak INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  voice_seconds INTEGER DEFAULT 0,
  last_monthly_reward TIMESTAMP
);
  `;
  try {
    await pool.query(query);
    console.log('✅ Table "user_activity" prête.');
  } catch (error) {
    console.error('❌ Erreur initialisation table user_activity :', error);
  }
}
