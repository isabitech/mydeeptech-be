const mongoose = require('mongoose');
const Assessment = require('../models/assessment.model');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

// Sample assessment data that matches real usage patterns
const sampleAssessments = [
  {
    assessmentType: 'annotator_qualification',
    totalQuestions: 20,
    correctAnswers: 17,
    scorePercentage: 85,
    passed: true,
    passingScore: 60,
    timeSpent: 1650,
    formattedTimeSpent: '27 minutes 30 seconds',
    attemptNumber: 1,
    categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
    questions: [
      // Comprehension questions
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'B' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'C' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'D' },
      // Vocabulary questions
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'B' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'C' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      // Grammar questions
      { section: 'Grammar', isCorrect: true, userAnswer: 'C' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'B' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'D' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      // Writing questions
      { section: 'Writing', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'B' },
      { section: 'Writing', isCorrect: true, userAnswer: 'C' },
      { section: 'Writing', isCorrect: true, userAnswer: 'D' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' }
    ]
  },
  {
    assessmentType: 'annotator_qualification',
    totalQuestions: 20,
    correctAnswers: 14,
    scorePercentage: 70,
    passed: true,
    passingScore: 60,
    timeSpent: 1920,
    formattedTimeSpent: '32 minutes',
    attemptNumber: 1,
    categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
    questions: [
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'B' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'C' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'B' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Vocabulary', isCorrect: false, userAnswer: 'C' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'C' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'B' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'D' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'B' },
      { section: 'Writing', isCorrect: true, userAnswer: 'C' },
      { section: 'Writing', isCorrect: false, userAnswer: 'D' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' }
    ]
  },
  {
    assessmentType: 'annotator_qualification',
    totalQuestions: 20,
    correctAnswers: 11,
    scorePercentage: 55,
    passed: false,
    passingScore: 60,
    timeSpent: 2160,
    formattedTimeSpent: '36 minutes',
    attemptNumber: 1,
    categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
    questions: [
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'B' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'C' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'B' },
      { section: 'Vocabulary', isCorrect: false, userAnswer: 'A' },
      { section: 'Vocabulary', isCorrect: false, userAnswer: 'C' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'C' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'B' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'D' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'B' },
      { section: 'Writing', isCorrect: true, userAnswer: 'C' },
      { section: 'Writing', isCorrect: false, userAnswer: 'D' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' }
    ]
  },
  {
    assessmentType: 'annotator_qualification',
    totalQuestions: 20,
    correctAnswers: 18,
    scorePercentage: 90,
    passed: true,
    passingScore: 60,
    timeSpent: 1440,
    formattedTimeSpent: '24 minutes',
    attemptNumber: 1,
    categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
    questions: [
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'B' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'C' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'B' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'C' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'C' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'B' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'D' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'B' },
      { section: 'Writing', isCorrect: true, userAnswer: 'C' },
      { section: 'Writing', isCorrect: false, userAnswer: 'D' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' }
    ]
  },
  {
    assessmentType: 'annotator_qualification',
    totalQuestions: 20,
    correctAnswers: 16,
    scorePercentage: 80,
    passed: true,
    passingScore: 60,
    timeSpent: 1800,
    formattedTimeSpent: '30 minutes',
    attemptNumber: 2, // This is a retake
    categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
    questions: [
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'B' },
      { section: 'Comprehension', isCorrect: false, userAnswer: 'C' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'A' },
      { section: 'Comprehension', isCorrect: true, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'B' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'C' },
      { section: 'Vocabulary', isCorrect: false, userAnswer: 'D' },
      { section: 'Vocabulary', isCorrect: true, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'C' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'A' },
      { section: 'Grammar', isCorrect: false, userAnswer: 'B' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'D' },
      { section: 'Grammar', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' },
      { section: 'Writing', isCorrect: true, userAnswer: 'B' },
      { section: 'Writing', isCorrect: true, userAnswer: 'C' },
      { section: 'Writing', isCorrect: false, userAnswer: 'D' },
      { section: 'Writing', isCorrect: true, userAnswer: 'A' }
    ]
  }
];

// Sample user data to create realistic submissions
const sampleUserData = [
  {
    fullName: 'John Smith',
    email: 'john.smith@example.com',
    annotatorStatus: 'approved',
    microTaskerStatus: 'approved',
    qaStatus: 'approved'
  },
  {
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    annotatorStatus: 'approved',
    microTaskerStatus: 'pending',
    qaStatus: 'approved'
  },
  {
    fullName: 'Michael Brown',
    email: 'michael.brown@example.com',
    annotatorStatus: 'pending',
    microTaskerStatus: 'pending',
    qaStatus: 'rejected'
  },
  {
    fullName: 'Emily Davis',
    email: 'emily.davis@example.com',
    annotatorStatus: 'approved',
    microTaskerStatus: 'approved',
    qaStatus: 'approved'
  },
  {
    fullName: 'David Wilson',
    email: 'david.wilson@example.com',
    annotatorStatus: 'approved',
    microTaskerStatus: 'approved',
    qaStatus: 'approved'
  }
];

async function populateAssessmentSubmissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing assessments (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing assessment submissions...');
    await Assessment.deleteMany({ assessmentType: 'annotator_qualification' });

    // Create or update sample users
    console.log('👥 Creating sample users...');
    const users = [];
    for (const userData of sampleUserData) {
      let user = await DTUser.findOne({ email: userData.email });
      if (!user) {
        user = new DTUser({
          ...userData,
          password: 'hashedpassword123', // This would be properly hashed in real scenario
          isEmailVerified: true,
          phone: '+1234567890',
          domains: ['Computer Vision', 'Natural Language Processing'],
          personal_info: {
            country: 'United States',
            time_zone: 'EST',
            available_hours_per_week: 40
          },
          professional_background: {
            education_level: 'Bachelor\'s degree',
            field_of_study: 'Computer Science',
            years_of_experience: 3,
            current_occupation: 'Data Annotator'
          }
        });
        await user.save();
        console.log(`✅ Created user: ${userData.fullName}`);
      } else {
        console.log(`📋 User already exists: ${userData.fullName}`);
      }
      users.push(user);
    }

    // Create assessment submissions
    console.log('📊 Creating assessment submissions...');
    const submissions = [];
    
    for (let i = 0; i < sampleAssessments.length; i++) {
      const assessmentData = sampleAssessments[i];
      const user = users[i];
      
      // Create submission date (spread over last 30 days)
      const daysAgo = Math.floor(Math.random() * 30);
      const submissionDate = new Date();
      submissionDate.setDate(submissionDate.getDate() - daysAgo);
      submissionDate.setHours(Math.floor(Math.random() * 24));
      submissionDate.setMinutes(Math.floor(Math.random() * 60));

      const assessment = new Assessment({
        userId: user._id,
        ...assessmentData,
        createdAt: submissionDate,
        updatedAt: submissionDate,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      await assessment.save();
      submissions.push(assessment);
      console.log(`✅ Created assessment for ${user.fullName}: ${assessmentData.scorePercentage}% (${assessmentData.passed ? 'PASSED' : 'FAILED'})`);
    }

    // Create additional submissions for variety
    console.log('📈 Creating additional submissions for data variety...');
    
    const additionalSubmissions = [
      { userIndex: 0, score: 75, passed: true, attempt: 1 },
      { userIndex: 1, score: 92, passed: true, attempt: 1 },
      { userIndex: 2, score: 68, passed: true, attempt: 2 }, // Retake that passed
      { userIndex: 3, score: 45, passed: false, attempt: 1 },
      { userIndex: 4, score: 88, passed: true, attempt: 1 },
      { userIndex: 0, score: 82, passed: true, attempt: 2 }, // Another retake
    ];

    for (const additional of additionalSubmissions) {
      const user = users[additional.userIndex];
      const correctAnswers = Math.round((additional.score / 100) * 20);
      
      const daysAgo = Math.floor(Math.random() * 20) + 1;
      const submissionDate = new Date();
      submissionDate.setDate(submissionDate.getDate() - daysAgo);

      // Generate realistic question distribution
      const questions = [];
      let correctCount = 0;
      
      for (let section of ['Comprehension', 'Vocabulary', 'Grammar', 'Writing']) {
        for (let q = 0; q < 5; q++) {
          const shouldBeCorrect = correctCount < correctAnswers && Math.random() > 0.3;
          questions.push({
            section: section,
            isCorrect: shouldBeCorrect,
            userAnswer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
          });
          if (shouldBeCorrect) correctCount++;
        }
      }

      // Adjust to get exact score
      while (correctCount > correctAnswers) {
        const randomIndex = Math.floor(Math.random() * questions.length);
        if (questions[randomIndex].isCorrect) {
          questions[randomIndex].isCorrect = false;
          correctCount--;
        }
      }
      while (correctCount < correctAnswers) {
        const randomIndex = Math.floor(Math.random() * questions.length);
        if (!questions[randomIndex].isCorrect) {
          questions[randomIndex].isCorrect = true;
          correctCount++;
        }
      }

      const assessment = new Assessment({
        userId: user._id,
        assessmentType: 'annotator_qualification',
        totalQuestions: 20,
        correctAnswers: correctAnswers,
        scorePercentage: additional.score,
        passed: additional.passed,
        passingScore: 60,
        timeSpent: 1500 + Math.floor(Math.random() * 900), // 25-40 minutes
        formattedTimeSpent: `${Math.floor((1500 + Math.floor(Math.random() * 900)) / 60)} minutes`,
        attemptNumber: additional.attempt,
        categories: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
        questions: questions,
        createdAt: submissionDate,
        updatedAt: submissionDate,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      await assessment.save();
      console.log(`✅ Additional submission for ${user.fullName}: ${additional.score}% (Attempt ${additional.attempt})`);
    }

    console.log('\n🎉 Assessment submissions populated successfully!');
    console.log(`📊 Created ${submissions.length + additionalSubmissions.length} assessment submissions`);
    console.log(`👥 Using ${users.length} sample users`);
    console.log('\n📋 Summary:');
    
    // Get statistics
    const totalAssessments = await Assessment.countDocuments({ assessmentType: 'annotator_qualification' });
    const passedAssessments = await Assessment.countDocuments({ assessmentType: 'annotator_qualification', passed: true });
    const failedAssessments = totalAssessments - passedAssessments;
    
    const avgScoreResult = await Assessment.aggregate([
      { $match: { assessmentType: 'annotator_qualification' } },
      { $group: { _id: null, avgScore: { $avg: '$scorePercentage' } } }
    ]);
    const avgScore = avgScoreResult[0]?.avgScore || 0;

    console.log(`   Total Submissions: ${totalAssessments}`);
    console.log(`   Passed: ${passedAssessments} (${((passedAssessments / totalAssessments) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${failedAssessments} (${((failedAssessments / totalAssessments) * 100).toFixed(1)}%)`);
    console.log(`   Average Score: ${avgScore.toFixed(1)}%`);
    
    console.log('\n🔗 Test your endpoint now:');
    console.log('GET /api/assessments/english-proficiency/submissions?page=1&limit=10');

  } catch (error) {
    console.error('❌ Error populating assessment submissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  populateAssessmentSubmissions();
}

module.exports = { populateAssessmentSubmissions };