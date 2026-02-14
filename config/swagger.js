// swagger.js - API Documentation Configuration
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const envConfig = require('./envConfig');

const description = envConfig.NODE_ENV === 'production' ? 'Production server' : 'Development server';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MyDeepTech API',
      version: '1.0.0',
      description: 'Comprehensive API for MyDeepTech annotation platform',
      contact: {
        name: 'MyDeepTech Support',
        email: 'support@mydeeptech.ng',
        url: 'https://mydeeptech.ng'
      },
    },
    servers: [
      {
        url: envConfig.SWAGGER_URL,
        description: envConfig.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
      // Add additional server options for different environments
      {
        url: envConfig.NODE_ENV === 'production' ? 'https://mydeeptech-be.onrender.com' : 'http://localhost:4000',
        description: envConfig.NODE_ENV === 'production' ? 'Primary Production Server' : 'Local Development Server',
      },
      // Add a relative server for reverse proxy setups
      {
        url: "/",
        description: "Relative server (for reverse proxy setups)"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['fullName', 'email', 'phone'],
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
            annotatorStatus: {
              type: 'string',
              enum: ['pending', 'submitted', 'verified', 'approved', 'rejected'],
              description: 'Current annotator status',
            },
            attachments: {
              type: 'object',
              properties: {
                resume_url: {
                  type: 'string',
                  description: 'Resume file URL',
                },
                id_document_url: {
                  type: 'string',
                  description: 'ID document file URL',
                },
              },
            },
          },
        },
        Project: {
          type: 'object',
          required: ['projectName', 'projectDescription', 'projectGuidelineLink'],
          properties: {
            _id: {
              type: 'string',
              description: 'Project ID',
            },
            projectName: {
              type: 'string',
              description: 'Project name',
            },
            projectDescription: {
              type: 'string',
              description: 'Project description',
            },
            projectCategory: {
              type: 'string',
              description: 'Project category',
            },
            payRate: {
              type: 'number',
              description: 'Pay rate',
            },
            payRateCurrency: {
              type: 'string',
              default: 'USD',
              description: 'Currency for pay rate',
            },
            projectGuidelineLink: {
              type: 'string',
              format: 'uri',
              description: 'Required guidelines document URL',
            },
            projectGuidelineVideo: {
              type: 'string',
              format: 'uri',
              description: 'Optional guidelines video URL',
            },
            projectCommunityLink: {
              type: 'string',
              format: 'uri',
              description: 'Optional community chat URL',
            },
            projectTrackerLink: {
              type: 'string',
              format: 'uri',
              description: 'Optional project tracker URL',
            },
          },
        },
        Application: {
          type: 'object',
          required: ['projectId', 'applicantId', 'resumeUrl'],
          properties: {
            _id: {
              type: 'string',
              description: 'Application ID',
            },
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            applicantId: {
              type: 'string',
              description: 'Applicant user ID',
            },
            coverLetter: {
              type: 'string',
              description: 'Application cover letter',
            },
            resumeUrl: {
              type: 'string',
              format: 'uri',
              description: 'Applicant resume URL (required)',
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'withdrawn'],
              description: 'Application status',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code',
                },
                reason: {
                  type: 'string',
                  description: 'Detailed error reason',
                },
                action: {
                  type: 'string',
                  description: 'Suggested action to resolve error',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};