// generate-api-docs.js - Generate API documentation in various formats
const fs = require('fs');
const path = require('path');

const apiEndpoints = {
  authentication: [
    {
      path: '/auth/dtUserRegister',
      method: 'POST',
      summary: 'Register a new user',
      description: 'Create a new user account for the annotation platform',
      requiresAuth: false,
      requestBody: {
        required: true,
        schema: {
          type: 'object',
          required: ['fullName', 'email', 'phone', 'consent'],
          properties: {
            fullName: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+1234567890' },
            consent: { type: 'boolean', example: true },
            domains: { type: 'array', items: { type: 'string' }, example: ['technology', 'healthcare'] }
          }
        }
      },
      responses: {
        201: { description: 'User registered successfully' },
        400: { description: 'Validation error' }
      }
    },
    {
      path: '/auth/dtUserLogin',
      method: 'POST',
      summary: 'User login',
      description: 'Authenticate user and return JWT token',
      requiresAuth: false,
      requestBody: {
        required: true,
        schema: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', example: 'securePassword123' }
          }
        }
      },
      responses: {
        200: { description: 'Login successful, returns JWT token' },
        401: { description: 'Invalid credentials' }
      }
    }
  ],
  
  fileUpload: [
    {
      path: '/auth/upload-resume',
      method: 'POST',
      summary: 'Upload resume document',
      description: 'Upload resume file (PDF, DOC, DOCX) to user profile - REQUIRED for project applications',
      requiresAuth: true,
      requestBody: {
        required: true,
        contentType: 'multipart/form-data',
        schema: {
          type: 'object',
          properties: {
            resume: { type: 'string', format: 'binary', description: 'Resume file (PDF, DOC, DOCX)' }
          }
        }
      },
      responses: {
        200: { description: 'Resume uploaded successfully with accessible URL' },
        400: { description: 'File validation error or missing file' },
        401: { description: 'Authentication required' }
      },
      notes: [
        'Files are stored with resource_type: raw for proper accessibility',
        'Supported formats: PDF, DOC, DOCX',
        'Maximum file size: 10MB',
        'Resume is required before applying to any project'
      ]
    },
    {
      path: '/auth/upload-id-document',
      method: 'POST',
      summary: 'Upload ID document',
      description: 'Upload identification document (PDF, JPG, PNG) to user profile',
      requiresAuth: true,
      requestBody: {
        required: true,
        contentType: 'multipart/form-data',
        schema: {
          type: 'object',
          properties: {
            idDocument: { type: 'string', format: 'binary', description: 'ID document file (PDF, JPG, PNG)' }
          }
        }
      },
      responses: {
        200: { description: 'ID document uploaded successfully' },
        400: { description: 'File validation error' }
      }
    }
  ],
  
  projects: [
    {
      path: '/auth/projects/available',
      method: 'GET',
      summary: 'Get available projects',
      description: 'Retrieve list of active projects available for applications',
      requiresAuth: true,
      parameters: [
        { name: 'page', in: 'query', type: 'integer', default: 1, description: 'Page number' },
        { name: 'limit', in: 'query', type: 'integer', default: 10, description: 'Items per page' },
        { name: 'category', in: 'query', type: 'string', description: 'Filter by category' }
      ],
      responses: {
        200: { description: 'Available projects retrieved successfully' },
        403: { description: 'Access denied - user not approved' }
      }
    },
    {
      path: '/auth/projects/{projectId}/apply',
      method: 'POST',
      summary: 'Apply to a project',
      description: 'Submit an application to an annotation project (requires uploaded resume)',
      requiresAuth: true,
      parameters: [
        { name: 'projectId', in: 'path', type: 'string', required: true, description: 'Project ID' }
      ],
      requestBody: {
        required: true,
        schema: {
          type: 'object',
          properties: {
            coverLetter: { type: 'string', example: 'I am interested in this project...' },
            proposedRate: { type: 'number', example: 15 },
            availability: { type: 'string', enum: ['full_time', 'part_time', 'weekends', 'flexible'] },
            estimatedCompletionTime: { type: 'string', example: '2 weeks' }
          }
        }
      },
      responses: {
        201: { description: 'Application submitted successfully' },
        400: { 
          description: 'Resume required or validation error',
          examples: {
            resumeRequired: {
              success: false,
              message: 'Please upload your resume in your profile section',
              error: {
                code: 'RESUME_REQUIRED',
                reason: 'A resume is required to apply to projects',
                action: 'Upload your resume in the profile section before applying'
              }
            }
          }
        },
        403: { description: 'Access denied - user not approved annotator' },
        404: { description: 'Project not found' }
      },
      notes: [
        'Resume must be uploaded to user profile before applying',
        'User must have approved annotator status',
        'Application deadline must not have passed',
        'Project must be active and accepting applications'
      ]
    },
    {
      path: '/auth/projects/{projectId}/guidelines',
      method: 'GET',
      summary: 'Get project guidelines',
      description: 'Access project guidelines and resources (only for approved applicants)',
      requiresAuth: true,
      parameters: [
        { name: 'projectId', in: 'path', type: 'string', required: true, description: 'Project ID' }
      ],
      responses: {
        200: { 
          description: 'Project guidelines retrieved successfully',
          schema: {
            type: 'object',
            properties: {
              projectInfo: { description: 'Project details' },
              guidelines: {
                type: 'object',
                properties: {
                  documentLink: { type: 'string', format: 'uri', description: 'Required guidelines document' },
                  videoLink: { type: 'string', format: 'uri', description: 'Optional tutorial video' },
                  communityLink: { type: 'string', format: 'uri', description: 'Optional community chat' },
                  trackerLink: { type: 'string', format: 'uri', description: 'Optional progress tracker' }
                }
              }
            }
          }
        },
        403: { description: 'Access denied - user not approved for this project' }
      }
    }
  ]
};

// Generate Markdown documentation
function generateMarkdownDocs() {
  let markdown = `# MyDeepTech API Documentation

## Overview
Complete API documentation for MyDeepTech annotation platform with resume requirements and project resource management.

## Base URL
- Development: \`http://localhost:5000/api\`
- Production: \`https://api.mydeeptech.ng/api\`

## Authentication
Most endpoints require JWT token authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer your_jwt_token_here
\`\`\`

## Key Features
- 📄 **Resume Requirement**: Users must upload resume before applying to projects
- 🔗 **Project Resources**: Guidelines, videos, community links, and progress trackers
- 📁 **File Upload**: Cloudinary integration with raw resource type for PDFs
- ✉️ **Email Integration**: Enhanced notifications with resource links

---

`;

  // Add each section
  Object.entries(apiEndpoints).forEach(([section, endpoints]) => {
    markdown += `## ${section.charAt(0).toUpperCase() + section.slice(1)}\n\n`;
    
    endpoints.forEach(endpoint => {
      markdown += `### ${endpoint.method} ${endpoint.path}\n`;
      markdown += `${endpoint.description}\n\n`;
      
      if (endpoint.requiresAuth) {
        markdown += `🔐 **Requires Authentication**\n\n`;
      }
      
      if (endpoint.parameters) {
        markdown += `#### Parameters\n`;
        endpoint.parameters.forEach(param => {
          markdown += `- **${param.name}** (${param.in}): ${param.type} - ${param.description}\n`;
        });
        markdown += `\n`;
      }
      
      if (endpoint.requestBody) {
        markdown += `#### Request Body\n`;
        markdown += `\`\`\`json\n${JSON.stringify(endpoint.requestBody.schema, null, 2)}\n\`\`\`\n\n`;
      }
      
      markdown += `#### Responses\n`;
      Object.entries(endpoint.responses).forEach(([code, response]) => {
        markdown += `- **${code}**: ${response.description}\n`;
      });
      markdown += `\n`;
      
      if (endpoint.notes) {
        markdown += `#### Important Notes\n`;
        endpoint.notes.forEach(note => {
          markdown += `- ${note}\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
  });
  
  return markdown;
}

// Generate OpenAPI 3.0 spec
function generateOpenAPISpec() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'MyDeepTech API',
      version: '1.0.0',
      description: 'Comprehensive API for MyDeepTech annotation platform',
      contact: {
        name: 'MyDeepTech Support',
        email: 'support@mydeeptech.ng'
      }
    },
    servers: [
      { url: 'http://localhost:5000/api', description: 'Development' },
      { url: 'https://api.mydeeptech.ng/api', description: 'Production' }
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };
  
  // Convert endpoints to OpenAPI format
  Object.values(apiEndpoints).flat().forEach(endpoint => {
    spec.paths[endpoint.path] = {
      [endpoint.method.toLowerCase()]: {
        summary: endpoint.summary,
        description: endpoint.description,
        ...(endpoint.requiresAuth && { security: [{ bearerAuth: [] }] }),
        ...(endpoint.parameters && { parameters: endpoint.parameters }),
        ...(endpoint.requestBody && { requestBody: endpoint.requestBody }),
        responses: endpoint.responses
      }
    };
  });
  
  return spec;
}

// Write documentation files
try {
  // Create docs directory
  const docsDir = path.join(__dirname, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Generate and write Markdown docs
  const markdownDocs = generateMarkdownDocs();
  fs.writeFileSync(path.join(docsDir, 'API_DOCUMENTATION.md'), markdownDocs);
  console.log('✅ Markdown documentation generated: docs/API_DOCUMENTATION.md');
  
  // Generate and write OpenAPI spec
  const openApiSpec = generateOpenAPISpec();
  fs.writeFileSync(path.join(docsDir, 'openapi-spec.json'), JSON.stringify(openApiSpec, null, 2));
  console.log('✅ OpenAPI specification generated: docs/openapi-spec.json');
  
  console.log('\n📚 API Documentation Generated Successfully!');
  console.log('📖 Markdown docs: docs/API_DOCUMENTATION.md');
  console.log('🔧 OpenAPI spec: docs/openapi-spec.json');
  console.log('📮 Postman collection: postman/MyDeepTech-API-Collection.json');
  console.log('🌐 Swagger UI: http://localhost:5000/api-docs (when server is running)');
  
} catch (error) {
  console.error('❌ Error generating documentation:', error);
}

module.exports = {
  generateMarkdownDocs,
  generateOpenAPISpec,
  apiEndpoints
};