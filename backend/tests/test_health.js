import { testConnection } from '../src/db/connection.js';

async function runTest() {
  console.log('Testing MySQL Connection...');
  try {
    const isConnected = await testConnection();
    console.log('Database connected successfully:', isConnected);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

runTest();
