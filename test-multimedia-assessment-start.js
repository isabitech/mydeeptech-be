/**
 * Test multimedia assessment start functionality
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function testMultimediaAssessmentStart() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Import the function
    const { startAssessmentById } = require('./controller/assessment.controller');

    // Create mock request with a real assessment ID
    const mockReq = {
      user: { 
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com'
      },
      params: {
        assessmentId: '6948230ef4dc31933e10d053' // Use the real multimedia assessment ID
      },
      body: {}, // This should be empty for the unified endpoint
      ip: '127.0.0.1'
    };

    const mockRes = {
      status: function(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json: function(data) {
        console.log('\n=== RESPONSE ===');
        console.log('Status Code:', this.statusCode);
        console.log('Response Data:', JSON.stringify(data, null, 2));
        return data;
      }
    };

    console.log('\n🎬 Testing multimedia assessment start...');
    console.log('Assessment ID:', mockReq.params.assessmentId);
    
    await startAssessmentById(mockReq, mockRes);

  } catch (error) {
    console.error('Error testing multimedia assessment start:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

testMultimediaAssessmentStart();