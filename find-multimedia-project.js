const mongoose = require('mongoose');
require('dotenv').config();

async function findMultimediaProject() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const AnnotationProject = require('./models/annotationProject.model.js');
    
    // Search for projects with 'multimedia' in the name (case insensitive)
    const projects = await AnnotationProject.find({
      projectName: { $regex: 'multimedia', $options: 'i' }
    }).select('_id projectName projectCategory status createdAt');
    
    console.log('🔍 Found Multimedia projects:');
    projects.forEach(project => {
      console.log(`- ID: ${project._id}`);
      console.log(`  Name: ${project.projectName}`);
      console.log(`  Category: ${project.projectCategory}`);
      console.log(`  Status: ${project.status}`);
      console.log(`  Created: ${project.createdAt}`);
      console.log('');
    });
    
    if (projects.length === 0) {
      console.log('❌ No projects found with "multimedia" in the name');
      
      // Let's see all available projects
      console.log('\n📂 Available projects:');
      const allProjects = await AnnotationProject.find({})
        .select('_id projectName projectCategory status')
        .limit(10);
      
      allProjects.forEach(project => {
        console.log(`- ${project.projectName} (${project.projectCategory}) - ${project.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

findMultimediaProject();