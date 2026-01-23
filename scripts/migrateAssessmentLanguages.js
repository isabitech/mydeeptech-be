const mongoose = require('mongoose');
require('dotenv').config();

const Assessment = require('../models/assessment.model');

async function migrateAssessmentLanguages() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mydeeptech');
    console.log('Connected to MongoDB');

    // Find all assessments without language field
    const assessmentsToMigrate = await Assessment.find({
      $or: [
        { language: { $exists: false } },
        { language: null }
      ]
    });

    console.log(`Found ${assessmentsToMigrate.length} assessments to migrate`);

    let englishCount = 0;
    let akanCount = 0;

    for (const assessment of assessmentsToMigrate) {
      let detectedLanguage = null;
      
      if (assessment.questions && assessment.questions.length > 0) {
        // Check sections to determine language
        const sections = assessment.questions.map(q => q.section);
        const hasAkanSections = sections.some(s => ['Grammar', 'Vocabulary', 'Translation', 'Writing', 'Reading'].includes(s));
        const hasEnglishSections = sections.some(s => ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'].includes(s));
        const hasTranslationOrReading = sections.some(s => ['Translation', 'Reading'].includes(s));
        
        if (hasAkanSections && hasTranslationOrReading) {
          // Has Akan-specific sections (Translation/Reading)
          detectedLanguage = 'akan';
          akanCount++;
        } else if (hasEnglishSections && !hasTranslationOrReading) {
          // Has English sections but no Akan-specific sections
          detectedLanguage = 'en';
          englishCount++;
        } else if (assessment.totalQuestions >= 40) {
          // Fallback: High question count suggests Akan
          detectedLanguage = 'akan';
          akanCount++;
        } else {
          // Fallback: Lower question count suggests English
          detectedLanguage = 'en';
          englishCount++;
        }
      } else {
        // No questions available, use question count as fallback
        if (assessment.totalQuestions >= 40) {
          detectedLanguage = 'akan';
          akanCount++;
        } else {
          detectedLanguage = 'en';
          englishCount++;
        }
      }

      // Update the assessment with detected language
      await Assessment.updateOne(
        { _id: assessment._id },
        { $set: { language: detectedLanguage } }
      );

      console.log(`Updated assessment ${assessment._id}: ${detectedLanguage} (${assessment.totalQuestions} questions, score: ${assessment.scorePercentage}%)`);
    }

    console.log(`\nMigration complete:`);
    console.log(`- English assessments: ${englishCount}`);
    console.log(`- Akan assessments: ${akanCount}`);
    console.log(`- Total migrated: ${englishCount + akanCount}`);

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateAssessmentLanguages();