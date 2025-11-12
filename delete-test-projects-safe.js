#!/usr/bin/env node

/**
 * MongoDB Cleanup Script - Delete All Test Projects (SAFE VERSION)
 * 
 * This script safely deletes ALL projects and related data from your database.
 * It includes confirmation prompts and detailed logging.
 * 
 * ⚠️ WARNING: This will delete ALL projects, not just test ones!
 * 
 * What gets deleted:
 * - All AnnotationProjects
 * - All old Projects 
 * - All ProjectApplications
 * 
 * Usage: node delete-test-projects-safe.js
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

// Function to safely delete all projects
const deleteAllProjectsSafe = async () => {
  try {
    console.log('\n🔍 Analyzing all projects for deletion...');
    
    // Get counts of what will be deleted
    const annotationProjectCount = await AnnotationProject.countDocuments({});
    const oldProjectCount = await Projects.countDocuments({});
    const applicationCount = await ProjectApplication.countDocuments({});
    
    // Get some sample data to show what will be deleted
    const sampleAnnotationProjects = await AnnotationProject.find({})
      .limit(5)
      .select('projectName status createdBy createdAt')
      .populate('createdBy', 'fullName email');
    
    const sampleOldProjects = await Projects.find({})
      .limit(5)
      .select('projectName company dueDate');

    const totalCount = annotationProjectCount + oldProjectCount + applicationCount;

    if (totalCount === 0) {
      console.log('✅ No projects found to delete!');
      console.log('📊 Your database is already clean.');
      return 0;
    }

    console.log(`\n📊 DELETION PREVIEW:`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📁 AnnotationProjects to delete: ${annotationProjectCount}`);
    console.log(`📁 Old Projects to delete: ${oldProjectCount}`);
    console.log(`📝 Project Applications to delete: ${applicationCount}`);
    console.log(`🗑️  Total items to delete: ${totalCount}`);

    // Show sample projects that will be deleted
    if (sampleAnnotationProjects.length > 0) {
      console.log('\n🎯 Sample AnnotationProjects to be deleted:');
      console.log('┌────┬─────────────────────────────┬────────────────┬─────────────┐');
      console.log('│ #  │ Project Name                │ Creator        │ Status      │');
      console.log('├────┼─────────────────────────────┼────────────────┼─────────────┤');
      
      sampleAnnotationProjects.forEach((project, index) => {
        const projectName = project.projectName.slice(0, 27);
        const creatorName = project.createdBy?.fullName || 'Unknown';
        const creator = creatorName.slice(0, 14);
        const status = project.status.slice(0, 11);
        
        console.log(`│ ${(index + 1).toString().padStart(2)} │ ${projectName.padEnd(27)} │ ${creator.padEnd(14)} │ ${status.padEnd(11)} │`);
      });
      
      console.log('└────┴─────────────────────────────┴────────────────┴─────────────┘');
      
      if (annotationProjectCount > 5) {
        console.log(`   ... and ${annotationProjectCount - 5} more AnnotationProjects`);
      }
    }

    if (sampleOldProjects.length > 0) {
      console.log('\n🗂️ Sample Old Projects to be deleted:');
      sampleOldProjects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.projectName} (${project.company})`);
      });
      
      if (oldProjectCount > 5) {
        console.log(`   ... and ${oldProjectCount - 5} more Old Projects`);
      }
    }

    // MASSIVE WARNING
    console.log('\n🚨 CRITICAL WARNING:');
    console.log('  ⚠️  THIS WILL DELETE ALL PROJECTS IN YOUR DATABASE!');
    console.log('  ⚠️  THIS ACTION CANNOT BE UNDONE!');
    console.log('  ⚠️  ALL PROJECT DATA WILL BE PERMANENTLY LOST!');
    console.log('  ⚠️  ALL USER APPLICATIONS WILL BE DELETED!');
    console.log('');
    console.log('📋 What will be deleted:');
    console.log(`  • ${annotationProjectCount} AnnotationProjects (main projects)`);
    console.log(`  • ${oldProjectCount} old Projects (legacy)`);
    console.log(`  • ${applicationCount} ProjectApplications (user applications)`);
    console.log('');
    console.log('💡 Recommended: Backup your database before proceeding!');

    // Multiple confirmation levels
    console.log('\n❓ CONFIRMATION REQUIRED:');
    
    // First confirmation
    const confirm1 = await askQuestion('Do you want to proceed with deleting ALL projects? (yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user.');
      return 0;
    }

    // Second confirmation with count
    const confirm2 = await askQuestion(`\nAre you absolutely sure you want to delete ${totalCount} project-related items? (yes/no): `);
    if (confirm2.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user.');
      return 0;
    }

    // Final confirmation - must type exact phrase
    const confirm3 = await askQuestion('\nType "DELETE ALL PROJECTS" to confirm (case sensitive): ');
    if (confirm3 !== 'DELETE ALL PROJECTS') {
      console.log('❌ Operation cancelled. Required confirmation not provided.');
      return 0;
    }

    // Final countdown
    console.log('\n⏳ Starting deletion in:');
    for (let i = 5; i > 0; i--) {
      console.log(`   ${i}... (Press Ctrl+C to cancel)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Perform the deletions in order
    console.log('\n🗑️  Executing deletion operations...');
    const startTime = Date.now();
    
    let deletionResults = {
      projectApplications: 0,
      annotationProjects: 0,
      oldProjects: 0
    };

    // Delete ProjectApplications first (they reference projects)
    if (applicationCount > 0) {
      console.log('🗑️  Deleting Project Applications...');
      const appResult = await ProjectApplication.deleteMany({});
      deletionResults.projectApplications = appResult.deletedCount;
      console.log(`   ✅ Deleted ${appResult.deletedCount} project applications`);
    }

    // Delete AnnotationProjects
    if (annotationProjectCount > 0) {
      console.log('🗑️  Deleting AnnotationProjects...');
      const annResult = await AnnotationProject.deleteMany({});
      deletionResults.annotationProjects = annResult.deletedCount;
      console.log(`   ✅ Deleted ${annResult.deletedCount} annotation projects`);
    }

    // Delete old Projects
    if (oldProjectCount > 0) {
      console.log('🗑️  Deleting old Projects...');
      const oldResult = await Projects.deleteMany({});
      deletionResults.oldProjects = oldResult.deletedCount;
      console.log(`   ✅ Deleted ${oldResult.deletedCount} old projects`);
    }

    const endTime = Date.now();
    const totalDeleted = deletionResults.projectApplications + 
                        deletionResults.annotationProjects + 
                        deletionResults.oldProjects;

    console.log(`\n✅ Successfully deleted all projects!`);
    
    // Show detailed summary
    console.log('\n📊 DELETION SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🗑️  Project Applications: ${deletionResults.projectApplications} deleted`);
    console.log(`   🗑️  AnnotationProjects: ${deletionResults.annotationProjects} deleted`);
    console.log(`   🗑️  Old Projects: ${deletionResults.oldProjects} deleted`);
    console.log(`   📊 Total deleted: ${totalDeleted} items`);
    console.log(`   ⏱️  Duration: ${endTime - startTime}ms`);
    console.log(`   📅 Date: ${new Date().toISOString()}`);

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const remainingAnn = await AnnotationProject.countDocuments({});
    const remainingOld = await Projects.countDocuments({});
    const remainingApps = await ProjectApplication.countDocuments({});
    
    console.log(`   📁 Remaining AnnotationProjects: ${remainingAnn}`);
    console.log(`   📁 Remaining old Projects: ${remainingOld}`);
    console.log(`   📝 Remaining Project Applications: ${remainingApps}`);

    if (remainingAnn === 0 && remainingOld === 0 && remainingApps === 0) {
      console.log('\n🎉 Database successfully cleaned! All projects removed.');
    } else {
      console.log('\n⚠️  Some items may not have been deleted. Check for errors above.');
    }

    return totalDeleted;

  } catch (error) {
    console.error('\n❌ Error during deletion operation:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🧹 MongoDB Cleanup: Delete All Test Projects');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚨 WARNING: This will delete ALL projects in your database!');
    
    await connectToMongoDB();
    const deletedCount = await deleteAllProjectsSafe();
    
    if (deletedCount > 0) {
      console.log('\n🎉 Cleanup completed successfully!');
      console.log(`📊 ${deletedCount} project-related items were removed.`);
      console.log('💡 Your database is now clean and ready for production data.');
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

module.exports = { deleteAllProjectsSafe };