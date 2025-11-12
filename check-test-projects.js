#!/usr/bin/env node

/**
 * MongoDB Query Script - Check Test Projects
 * 
 * This script only QUERIES (doesn't delete) to show you which test projects
 * would be deleted. Use this to verify before running the deletion script.
 * 
 * Usage: node check-test-projects.js
 */

const mongoose = require('mongoose');
const AnnotationProject = require('./models/annotationProject.model');
const Projects = require('./models/projects.model');
const ProjectApplication = require('./models/projectApplication.model');
const DTUser = require('./models/dtUser.model');
require('dotenv').config();

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

// Function to check test projects (READ ONLY)
const checkTestProjects = async () => {
  try {
    console.log('\n🔍 Analyzing projects in your database...');
    
    // Check AnnotationProjects (main project collection)
    const annotationProjects = await AnnotationProject.find({})
      .select('projectName projectDescription createdBy status createdAt')
      .populate('createdBy', 'fullName email');

    // Check old Projects collection
    const oldProjects = await Projects.find({})
      .select('projectName company dueDate createdAt');

    // Check Project Applications
    const projectApplications = await ProjectApplication.find({})
      .select('projectId applicantId status appliedAt')
      .populate('projectId', 'projectName')
      .populate('applicantId', 'fullName email');

    console.log('\n📊 Projects Database Analysis:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📁 AnnotationProjects: ${annotationProjects.length}`);
    console.log(`📁 Old Projects: ${oldProjects.length}`);
    console.log(`📁 Project Applications: ${projectApplications.length}`);

    // Show AnnotationProjects
    if (annotationProjects.length > 0) {
      console.log('\n🎯 ANNOTATION PROJECTS:');
      console.log('┌────┬─────────────────────────────┬─────────────────────────┬──────────────┬─────────────┐');
      console.log('│ #  │ Project Name                │ Creator                 │ Status       │ Created     │');
      console.log('├────┼─────────────────────────────┼─────────────────────────┼──────────────┼─────────────┤');
      
      annotationProjects.forEach((project, index) => {
        const createdDate = new Date(project.createdAt).toLocaleDateString();
        const projectName = project.projectName.slice(0, 27);
        const creatorInfo = project.createdBy 
          ? `${project.createdBy.fullName} (${project.createdBy.email})`.slice(0, 23)
          : 'Unknown Creator';
        const status = project.status.slice(0, 12);
        
        console.log(`│ ${(index + 1).toString().padStart(2)} │ ${projectName.padEnd(27)} │ ${creatorInfo.padEnd(23)} │ ${status.padEnd(12)} │ ${createdDate.padEnd(11)} │`);
      });
      
      console.log('└────┴─────────────────────────────┴─────────────────────────┴──────────────┴─────────────┘');

      // Show breakdown by status
      const statusBreakdown = annotationProjects.reduce((acc, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📊 Status Breakdown:');
      Object.entries(statusBreakdown).forEach(([status, count]) => {
        console.log(`   • ${status}: ${count} project(s)`);
      });
    }

    // Show Old Projects
    if (oldProjects.length > 0) {
      console.log('\n🗂️ OLD PROJECTS (Legacy):');
      console.log('┌────┬─────────────────────────────┬─────────────────────────┬─────────────┐');
      console.log('│ #  │ Project Name                │ Company                 │ Due Date    │');
      console.log('├────┼─────────────────────────────┼─────────────────────────┼─────────────┤');
      
      oldProjects.forEach((project, index) => {
        const dueDate = new Date(project.dueDate).toLocaleDateString();
        const projectName = project.projectName.slice(0, 27);
        const company = project.company.slice(0, 23);
        
        console.log(`│ ${(index + 1).toString().padStart(2)} │ ${projectName.padEnd(27)} │ ${company.padEnd(23)} │ ${dueDate.padEnd(11)} │`);
      });
      
      console.log('└────┴─────────────────────────────┴─────────────────────────┴─────────────┘');
    }

    // Show Project Applications summary
    if (projectApplications.length > 0) {
      console.log('\n📝 PROJECT APPLICATIONS:');
      
      const appStatusBreakdown = projectApplications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Applications by Status:');
      Object.entries(appStatusBreakdown).forEach(([status, count]) => {
        console.log(`   • ${status}: ${count} application(s)`);
      });

      console.log('\n📋 Sample Applications:');
      projectApplications.slice(0, 5).forEach((app, index) => {
        const projectName = app.projectId?.projectName || 'Deleted Project';
        const applicantInfo = app.applicantId 
          ? `${app.applicantId.fullName} (${app.applicantId.email})`
          : 'Unknown Applicant';
        const appliedDate = new Date(app.appliedAt).toLocaleDateString();
        
        console.log(`   ${index + 1}. ${projectName} - ${applicantInfo} (${app.status}) - ${appliedDate}`);
      });
      
      if (projectApplications.length > 5) {
        console.log(`   ... and ${projectApplications.length - 5} more applications`);
      }
    }

    console.log('\n🎯 Summary:');
    const totalProjects = annotationProjects.length + oldProjects.length;
    if (totalProjects === 0) {
      console.log('✅ No projects found - database is clean!');
    } else {
      console.log(`📊 Total Projects: ${totalProjects}`);
      console.log(`📝 Total Applications: ${projectApplications.length}`);
      console.log('💡 Use deletion scripts to clean up test/unwanted projects');
    }

    // Show potential test project indicators
    const potentialTestProjects = annotationProjects.filter(project => {
      const name = project.projectName.toLowerCase();
      return name.includes('test') || 
             name.includes('demo') || 
             name.includes('sample') || 
             name.includes('example') ||
             name.includes('temp') ||
             name.includes('debug');
    });

    if (potentialTestProjects.length > 0) {
      console.log(`\n🧪 Potential Test Projects Found: ${potentialTestProjects.length}`);
      potentialTestProjects.forEach((project, index) => {
        console.log(`   ${index + 1}. "${project.projectName}" (${project.status})`);
      });
    }

    // Show the exact MongoDB queries that would be used for deletion
    console.log('\n🔍 MongoDB Collections & Queries:');
    console.log('Collections:');
    console.log('  • AnnotationProjects (main projects)');
    console.log('  • Projects (legacy projects)'); 
    console.log('  • ProjectApplications (user applications)');
    console.log('');
    console.log('Deletion queries would target:');
    console.log('  • All documents in AnnotationProjects collection');
    console.log('  • All documents in Projects collection');
    console.log('  • All documents in ProjectApplications collection');

  } catch (error) {
    console.error('\n❌ Error checking projects:', error.message);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🔍 MongoDB Analysis: Check Test Projects');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📋 This script only READS data - no changes will be made');
    
    await connectToMongoDB();
    await checkTestProjects();
    
    console.log('\n✨ Analysis completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   • Review the projects listed above');
    console.log('   • Run "node delete-test-projects-safe.js" to delete them');
    console.log('   • Or run "node delete-specific-projects.js" for selective deletion');
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB connection closed.');
    }
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkTestProjects };