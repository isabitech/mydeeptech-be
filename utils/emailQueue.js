import { sendVerificationEmail } from './mailer.js';

// Simple in-memory queue for emails (in production, use Redis or a proper queue)
class EmailQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  // Add email to queue
  addEmail(email, name) {
    this.queue.push({ email, name, attempts: 0, maxAttempts: 3, timestamp: Date.now() });
    console.log(`📬 Email queued for ${email}`);
    this.processQueue();
  }

  // Process emails in the queue
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    console.log(`🔄 Processing ${this.queue.length} emails in queue...`);

    while (this.queue.length > 0) {
      const emailTask = this.queue.shift();

      try {
        const startTime = Date.now();
        const result = await sendVerificationEmail(emailTask.email, emailTask.name);
        const endTime = Date.now();

        console.log(`✅ Email sent successfully to ${emailTask.email} via ${result.provider} (${endTime - startTime}ms)`);
      } catch (error) {
        emailTask.attempts++;
        console.error(`❌ Email failed for ${emailTask.email} (attempt ${emailTask.attempts}):`, error.message);

        // Retry if under max attempts
        if (emailTask.attempts < emailTask.maxAttempts) {
          console.log(`🔄 Retrying email for ${emailTask.email}...`);
          // Add delay before retry (exponential backoff)
          const delay = Math.pow(2, emailTask.attempts) * 1000; // 2s, 4s, 8s...
          setTimeout(() => {
            this.queue.push(emailTask);
            this.processQueue();
          }, delay);
        } else {
          console.error(`💀 Max attempts reached for ${emailTask.email}. Email abandoned.`);
        }
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.processing = false;
    console.log('✅ Email queue processing completed');
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      queuedEmails: this.queue.map(task => ({
        email: task.email,
        attempts: task.attempts,
        queuedAt: new Date(task.timestamp).toISOString()
      }))
    };
  }
}

const emailQueue = new EmailQueue();

export { emailQueue };
