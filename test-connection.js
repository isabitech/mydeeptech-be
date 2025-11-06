require('dotenv').config(); // This must come first!

const mysql = require('mysql2/promise');

(async () => {
  const host = process.env.MYSQL_HOST;
  console.log('HOST:', host); // debugging

  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });

    console.log('✅ MySQL connection successful!');
    await conn.end();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
  }
})();
