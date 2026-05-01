const cron = require('node-cron');
const ApplicationExpiryService = require('./applicationExpiry.service');
const envConfig = require('../config/envConfig');

class SchedulerService {
    static isSchedulerRunning = false;
    static cronJob = null;

    /**
     * Start the application expiry scheduler
     * Runs daily at midnight (00:00) in production, every 5 minutes in development
     */
    static startApplicationExpiryScheduler() {
        if (this.isSchedulerRunning) {
            console.log('📅 Application expiry scheduler is already running');
            return;
        }

        // Different schedules for different environments
        const isDevelopment = envConfig.NODE_ENV === 'development';
        const cronSchedule = isDevelopment ? '*/5 * * * *' : '0 0 * * *'; // Every 5 min in dev, midnight in prod
        const scheduleDescription = isDevelopment ? 'every 5 minutes (development)' : 'daily at midnight UTC (production)';

        // Schedule to run based on environment
        this.cronJob = cron.schedule(cronSchedule, async () => {
            console.log(`🕛 [${new Date().toISOString()}] Starting scheduled application expiry processing...`);

            try {
                const expiryService = new ApplicationExpiryService();
                const result = await expiryService.processExpiredApplications();
            } catch (error) {
                console.error(`❌ [${new Date().toISOString()}] Scheduled expiry processing failed:`, error.message);
            }
        }, {
            scheduled: true,
            timezone: "UTC" // Use UTC to avoid timezone issues
        });

        this.isSchedulerRunning = true;
        console.log(`✅ Application expiry scheduler started - will run ${scheduleDescription}`);
        console.log('📋 Next scheduled run:', this.cronJob.getStatus());
    }

    /**
     * Stop the application expiry scheduler
     */
    static stopApplicationExpiryScheduler() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isSchedulerRunning = false;
            console.log('🛑 Application expiry scheduler stopped');
        }
    }

    /**
     * Get scheduler status
     */
    static getSchedulerStatus() {
        return {
            isRunning: this.isSchedulerRunning,
            nextRun: this.cronJob ? this.cronJob.getStatus() : null
        };
    }

    /**
     * Manually trigger expiry processing (for testing)
     */
    static async manuallyProcessExpiredApplications() {
        console.log('🔧 Manually triggering application expiry processing...');
        
        try {
            const expiryService = new ApplicationExpiryService();
            const result = await expiryService.processExpiredApplications();
            console.log('✅ Manual expiry processing completed:', result);
            return result;
        } catch (error) {
            console.error('❌ Manual expiry processing failed:', error.message);
            throw error;
        }
    }

    /**
     * Initialize all schedulers
     */
    static initializeSchedulers() {
        console.log('🚀 Initializing application schedulers...');
        // Always start schedulers but with environment-appropriate frequency
        this.startApplicationExpiryScheduler();
    }
}

module.exports = SchedulerService;