#!/usr/bin/env node
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const AssessmentQuestion = require('../models/assessmentQuestion.model');
    
    const akanCount = await AssessmentQuestion.countDocuments({ language: 'akan' });
    const englishCount = await AssessmentQuestion.countDocuments({ language: 'en' });
    const totalCount = await AssessmentQuestion.countDocuments({});
    
    console.log('📊 Database Assessment Questions:');
    console.log(`   Akan questions: ${akanCount}`);
    console.log(`   English questions: ${englishCount}`);
    console.log(`   Total questions: ${totalCount}`);
    
    if (akanCount === 0) {
      console.log('\n❌ No Akan questions found in database!');
      console.log('   Need to seed akan-assessment.json');
    } else {
      console.log('\n✅ Akan questions are present in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabase();