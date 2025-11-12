#!/usr/bin/env node

/**
 * MongoDB Cleanup Script - Delete Specific Projects by Criteria
 * 
 * This script allows you to selectively delete projects based on specific criteria
 * like project name patterns, creator, status, or date ranges.
 * 
 * Much safer than deleting ALL projects - you can target only test/unwanted ones.
 * 
 * Usage: node delete-specific-projects.js
 */

const mongoose = require('mongoose');
const AnnotationProject = require('./models/annotationProject.model');
const Projects = require('./models/projects.model');
const ProjectApplication = require('./models/projectApplication.model');
const DTUser = require('./models/dtUser.model');
const readline = require('readline');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// MongoDB connection
const connectToMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set!');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Function to build deletion criteria based on user input
const buildDeletionCriteria = async () => {
  console.log('\n🎯 SELECT DELETION CRITERIA:');
  console.log('Choose how to identify projects to delete:');
  console.log('');
  console.log('1. Delete by name pattern (contains specific words)');
  console.log('2. Delete by status (draft, active, paused, completed, cancelled)');
  console.log('3. Delete by creator email pattern');
  console.log('4. Delete by date range (created before/after specific date)');
  console.log('5. Delete projects with specific words in name');
  console.log('6. Custom MongoDB query (advanced users)');
  console.log('');

  const choice = await askQuestion('Enter your choice (1-6): ');
  
  let criteria = {};
  let description = '';

  switch (choice) {
    case '1':
      console.log('\n🔍 DELETE BY NAME PATTERN:');
      console.log('Examples: "test", "demo", "sample", "temp", "debug"');
      const pattern = await askQuestion('Enter word/pattern to match in project names: ');
      criteria = { projectName: { $regex: pattern, $options: 'i' } };
      description = `projects with names containing "${pattern}"`;
      break;

    case '2':
      console.log('\n📊 DELETE BY STATUS:');
      console.log('Available statuses: draft, active, paused, completed, cancelled');
      const status = await askQuestion('Enter status to delete: ');
      criteria = { status: status };
      description = `projects with status "${status}"`;
      break;

    case '3':
      console.log('\n👤 DELETE BY CREATOR EMAIL:');
      console.log('Examples: "@mydeeptech.ng", "test@", "demo@"');
      const emailPattern = await askQuestion('Enter email pattern: ');
      
      // Find all DTUsers matching the email pattern
      const matchingUsers = await DTUser.find({ 
        email: { $regex: emailPattern, $options: 'i' } 
      }).select('_id email fullName');
      
      if (matchingUsers.length === 0) {
        console.log('❌ No users found matching that email pattern!');
        return null;
      }
      
      console.log('\n📋 Found matching creators:');
      matchingUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.fullName} (${user.email})`);
      });
      
      const userIds = matchingUsers.map(user => user._id);
      criteria = { createdBy: { $in: userIds } };
      description = `projects created by users with email containing "${emailPattern}"`;
      break;

    case '4':
      console.log('\n📅 DELETE BY DATE RANGE:');
      console.log('Enter date in format: YYYY-MM-DD (e.g., 2025-01-01)');
      const beforeAfter = await askQuestion('Delete projects created (b)efore or (a)fter this date? (b/a): ');
      const dateStr = await askQuestion('Enter date: ');
      const date = new Date(dateStr);
      
      if (beforeAfter.toLowerCase() === 'b') {
        criteria = { createdAt: { $lt: date } };
        description = `projects created before ${dateStr}`;
      } else {
        criteria = { createdAt: { $gt: date } };
        description = `projects created after ${dateStr}`;
      }
      break;

    case '5':
      console.log('\n🏷️ DELETE PROJECTS WITH SPECIFIC WORDS:');
      console.log('Common test words: test, demo, sample, example, temp, debug, prototype');
      const words = await askQuestion('Enter words separated by commas: ');
      const wordArray = words.split(',').map(w => w.trim());
      const regexPattern = wordArray.join('|');
      criteria = { projectName: { $regex: regexPattern, $options: 'i' } };
      description = `projects with names containing: ${wordArray.join(', ')}`;
      break;

    case '6':
      console.log('\n⚡ CUSTOM MONGODB QUERY:');
      console.log('Enter valid MongoDB query object (JSON format)');
      console.log('Example: {"status": "draft", "createdAt": {"$lt": "2025-01-01"}}');
      const queryStr = await askQuestion('Enter MongoDB query: ');
      try {
        criteria = JSON.parse(queryStr);
        description = `projects matching custom query: ${queryStr}`;
      } catch (error) {
        console.log('❌ Invalid JSON query format!');
        return null;
      }
      break;

    default:
      console.log('❌ Invalid choice!');
      return null;
  }

  return { criteria, description };
};

// Function to safely delete specific projects
const deleteSpecificProjects = async () => {
  try {
    const deletionConfig = await buildDeletionCriteria();
    
    if (!deletionConfig) {
      console.log('❌ No valid deletion criteria provided.');
      return 0;
    }

    const { criteria, description } = deletionConfig;

    console.log(`\n🔍 Searching for ${description}...`);

    // Find matching projects
    const matchingProjects = await AnnotationProject.find(criteria)
      .select('projectName projectDescription status createdBy createdAt')
      .populate('createdBy', 'fullName email');

    if (matchingProjects.length === 0) {
      console.log('✅ No projects found matching your criteria!');
      return 0;
    }

    console.log(`\n⚠️  Found ${matchingProjects.length} project(s) matching your criteria:`);
    console.log('┌────┬─────────────────────────────┬─────────────────────┬──────────────┬─────────────┐');
    console.log('│ #  │ Project Name                │ Creator             │ Status       │ Created     │');
    console.log('├────┼─────────────────────────────┼─────────────────────┼──────────────┼─────────────┤');
    
    matchingProjects.forEach((project, index) => {
      const createdDate = new Date(project.createdAt).toLocaleDateString();
      const projectName = project.projectName.slice(0, 27);
      const creatorInfo = project.createdBy 
        ? `${project.createdBy.fullName}`.slice(0, 19)
        : 'Unknown';
      const status = project.status.slice(0, 12);
      
      console.log(`│ ${(index + 1).toString().padStart(2)} │ ${projectName.padEnd(27)} │ ${creatorInfo.padEnd(19)} │ ${status.padEnd(12)} │ ${createdDate.padEnd(11)} │`);
    });
    
    console.log('└────┴─────────────────────────────┴─────────────────────┴──────────────┴─────────────┘');

    // Find related applications
    const projectIds = matchingProjects.map(project => project._id);
    const relatedApplications = await ProjectApplication.countDocuments({
      projectId: { $in: projectIds }
    });

    console.log(`\n📊 Related data that will also be deleted:`);
    console.log(`   • ${relatedApplications} project applications`);

    // Safety warnings
    console.log('\n🚨 DELETION PREVIEW:');
    console.log(`   📁 Projects to delete: ${matchingProjects.length}`);
    console.log(`   📝 Applications to delete: ${relatedApplications}`);
    console.log(`   🎯 Criteria: ${description}`);
    console.log('');
    console.log('⚠️  This action cannot be undone!');

    // Confirmations
    const confirm1 = await askQuestion(`\nProceed with deleting ${matchingProjects.length} project(s)? (yes/no): `);
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user.');
      return 0;
    }

    const confirm2 = await askQuestion('\nType "DELETE SELECTED" to confirm: ');
    if (confirm2 !== 'DELETE SELECTED') {
      console.log('❌ Operation cancelled. Required confirmation not provided.');
      return 0;
    }

    // Execute deletion
    console.log('\n🗑️  Deleting selected projects...');
    const startTime = Date.now();

    // Delete related applications first
    let deletedApplications = 0;
    if (relatedApplications > 0) {
      const appResult = await ProjectApplication.deleteMany({
        projectId: { $in: projectIds }
      });
      deletedApplications = appResult.deletedCount;
      console.log(`   ✅ Deleted ${deletedApplications} related applications`);
    }

    // Delete the projects
    const projectResult = await AnnotationProject.deleteMany(criteria);
    const deletedProjects = projectResult.deletedCount;

    const endTime = Date.now();

    console.log(`\n✅ Successfully deleted selected projects!`);
    
    // Show detailed summary
    console.log('\n📊 DELETION SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🎯 Criteria: ${description}`);
    console.log(`   🗑️  Projects deleted: ${deletedProjects}`);
    console.log(`   🗑️  Applications deleted: ${deletedApplications}`);
    console.log(`   📊 Total deleted: ${deletedProjects + deletedApplications}`);
    console.log(`   ⏱️  Duration: ${endTime - startTime}ms`);
    console.log(`   📅 Date: ${new Date().toISOString()}`);

    // Verify remaining projects
    const remaining = await AnnotationProject.countDocuments({});
    console.log(`\n📁 Remaining projects in database: ${remaining}`);

    return deletedProjects + deletedApplications;

  } catch (error) {
    console.error('\n❌ Error during deletion operation:', error.message);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🎯 MongoDB Cleanup: Delete Specific Projects');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🛡️  Safe selective deletion based on your criteria');
    
    await connectToMongoDB();
    const deletedCount = await deleteSpecificProjects();
    
    if (deletedCount > 0) {
      console.log('\n🎉 Selective cleanup completed successfully!');
      console.log(`📊 ${deletedCount} items were removed based on your criteria.`);
    } else {
      console.log('\n✨ No cleanup needed or operation cancelled!');
    }
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    // Close readline and MongoDB connection
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB connection closed.');
    }
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n❌ Operation cancelled by user (Ctrl+C)');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { deleteSpecificProjects };