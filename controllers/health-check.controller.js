const mongoose = require('mongoose');
const { redisHealthCheck } = require('./../config/redis');

const healthCheck = async (_req, res) => {
try {
        const redisStatus = await redisHealthCheck();
        
        // Test MongoDB connectivity with actual database operation
        let mongoStatus = 'disconnected';
        let mongoDetails = { status: 'disconnected' };
        
        if (mongoose.connection.readyState === 1) {
            try {
                // Perform actual database ping
                await mongoose.connection.db.admin().ping();
                const collections = await mongoose.connection.db.listCollections().toArray();
                
                mongoStatus = 'connected';
                mongoDetails = {
                    status: 'connected',
                    host: mongoose.connection.host,
                    database: mongoose.connection.name,
                    collections: collections.length,
                    readyState: mongoose.connection.readyState
                };
            } catch (dbError) {
                mongoStatus = 'error';
                mongoDetails = {
                    status: 'error',
                    error: dbError.message,
                    readyState: mongoose.connection.readyState
                };
            }
        }
        
        const isHealthy = mongoStatus === 'connected' && redisStatus.status === 'connected';
        
        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                mongodb: mongoDetails,
                redis: redisStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};  


module.exports = {
  healthCheck,
};