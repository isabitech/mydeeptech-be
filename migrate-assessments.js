require('dotenv').config();
const mongoose = require('mongoose');

async function migrateAssessments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔄 Connected to MongoDB');

    const Assessment = require('./models/assessment.model');
    
    // Get all assessments without language field
    const assessments = await Assessment.find({
      assessmentType: 'annotator_qualification',
      $or: [
        { language: { $exists: false } },
        { language: null }
      ]
    });
    
    console.log(`Found ${assessments.length} assessments to migrate`);
    
    for (let assessment of assessments) {
      let detectedLanguage = null;
      
      // Detect language based on sections in questions
      if (assessment.questions && assessment.questions.length > 0) {
        const sections = assessment.questions.map(q => q.section);
        const hasAkanSections = sections.some(s => ['Translation', 'Reading'].includes(s));
        const hasEnglishSections = sections.some(s => s === 'Comprehension');
        
        if (hasAkanSections || assessment.totalQuestions >= 25) {
          detectedLanguage = 'akan';
        } else if (hasEnglishSections || assessment.totalQuestions <= 20) {
          detectedLanguage = 'en';
        }
      } else {
        // Fallback: use totalQuestions as indicator
        detectedLanguage = assessment.totalQuestions >= 25 ? 'akan' : 'en';
      }
      
      if (detectedLanguage) {
        await Assessment.findByIdAndUpdate(assessment._id, { language: detectedLanguage });
        console.log(`✅ Updated assessment ${assessment._id.toString().slice(-6)} as ${detectedLanguage} (${assessment.totalQuestions} questions, Score: ${assessment.scorePercentage}%)`);
      }
    }
    
    console.log('🎉 Migration completed');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateAssessments();