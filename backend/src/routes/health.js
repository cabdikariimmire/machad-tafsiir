import { Router } from 'express';
import { testConnection } from '../db/connection.js';

const router = Router();

router.get('/health', async (req, res, next) => {
  try {
    const dbHealthy = await testConnection();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      institution: 'معهد التفسير للعلوم الشرعية والعربية',
      system: 'Internal Management System',
      services: {
        server: 'online',
        database: dbHealthy ? 'connected' : 'disconnected'
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        server: 'online',
        database: 'error: ' + error.message
      }
    });
  }
});

export default router;
