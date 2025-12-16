const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function exportApprovedAnnotators() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const AnnotationProject = require('./models/annotationProject.model.js');
    const ProjectApplication = require('./models/projectApplication.model.js');
    const DTUser = require('./models/dtUser.model.js');
    
    // Find the Multimedia Annotation project
    const project = await AnnotationProject.findOne({
      projectName: { $regex: 'multimedia', $options: 'i' }
    });
    
    if (!project) {
      console.log('❌ Multimedia Annotation project not found');
      return;
    }
    
    console.log(`📋 Found project: ${project.projectName}`);
    console.log(`🆔 Project ID: ${project._id}`);
    
    // Get all approved applications for this project
    const approvedApplications = await ProjectApplication.find({
      projectId: project._id,
      status: 'approved'
    })
    .populate({
      path: 'applicantId',
      select: 'fullName email phone annotatorStatus microTaskerStatus personal_info professional_background payment_info attachments createdAt'
    })
    .populate('reviewedBy', 'fullName email')
    .sort({ approvedAt: -1 });
    
    console.log(`✅ Found ${approvedApplications.length} approved applications`);
    
    if (approvedApplications.length === 0) {
      console.log('ℹ️ No approved applications found for this project');
      return;
    }
    
    // Prepare CSV data
    const csvHeaders = [
      'Full Name',
      'Country', 
      'Email'
    ];
    
    const csvRows = [];
    csvRows.push(csvHeaders.join(','));
    
    // Process each approved application
    approvedApplications.forEach(app => {
      const applicant = app.applicantId;
      const personalInfo = applicant.personal_info || {};
      const professionalBg = applicant.professional_background || {};
      const paymentInfo = applicant.payment_info || {};
      const attachments = applicant.attachments || {};
      
      const row = [
        `"${applicant.fullName || 'N/A'}"`,
        `"${personalInfo.country || 'N/A'}"`,
        `"${applicant.email || 'N/A'}"`
      ];
      
      csvRows.push(row.join(','));
    });
    
    // Generate CSV content
    const csvContent = csvRows.join('\n');
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `multimedia_annotation_approved_annotators_${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    // Write CSV file
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    console.log(`\n📄 CSV file created successfully!`);
    console.log(`📁 File path: ${filepath}`);
    console.log(`📊 Total approved annotators exported: ${approvedApplications.length}`);
    
    // Show summary statistics
    const stats = {
      countries: new Set(),
      educationFields: new Set(),
      totalHours: 0,
      withResume: 0,
      withPaymentInfo: 0
    };
    
    approvedApplications.forEach(app => {
      const applicant = app.applicantId;
      const personalInfo = applicant.personal_info || {};
      const professionalBg = applicant.professional_background || {};
      const paymentInfo = applicant.payment_info || {};
      const attachments = applicant.attachments || {};
      
      if (personalInfo.country) stats.countries.add(personalInfo.country);
      if (professionalBg.educationField) stats.educationFields.add(professionalBg.educationField);
      if (personalInfo.availableHours) stats.totalHours += parseInt(personalInfo.availableHours) || 0;
      if (attachments.resume_url) stats.withResume++;
      if (paymentInfo.accountName) stats.withPaymentInfo++;
    });
    
    console.log(`\n📈 Export Summary:`);
    console.log(`🌍 Countries represented: ${stats.countries.size} (${Array.from(stats.countries).join(', ')})`);
    console.log(`🎓 Education fields: ${stats.educationFields.size} (${Array.from(stats.educationFields).join(', ')})`);
    console.log(`⏰ Total available hours/week: ${stats.totalHours}`);
    console.log(`📄 Annotators with resume: ${stats.withResume}/${approvedApplications.length}`);
    console.log(`💳 Annotators with payment info: ${stats.withPaymentInfo}/${approvedApplications.length}`);
    
  } catch (error) {
    console.error('❌ Error exporting data:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

exportApprovedAnnotators();