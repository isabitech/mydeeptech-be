/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and registration
 *   - name: Projects
 *     description: Project management and applications
 *   - name: File Upload
 *     description: File upload operations
 *   - name: User Profile
 *     description: User profile management
 */

/**
 * @swagger
 * /auth/dtUserRegister:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account for the annotation platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - consent
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               consent:
 *                 type: boolean
 *                 example: true
 *               domains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["technology", "healthcare"]
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User registered successfully"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /auth/dtUserLogin:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user and return JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "securePassword123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /auth/projects/{projectId}/apply:
 *   post:
 *     tags: [Projects]
 *     summary: Apply to a project
 *     description: Submit an application to an annotation project (requires uploaded resume)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID to apply to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coverLetter:
 *                 type: string
 *                 example: "I am interested in this annotation project..."
 *               proposedRate:
 *                 type: number
 *                 example: 15
 *               availability:
 *                 type: string
 *                 enum: [full_time, part_time, weekends, flexible]
 *                 example: "part_time"
 *               estimatedCompletionTime:
 *                 type: string
 *                 example: "2 weeks"
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Application submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     application:
 *                       $ref: '#/components/schemas/Application'
 *                     projectName:
 *                       type: string
 *                       example: "Medical Text Annotation"
 *       400:
 *         description: Resume required or other validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Please upload your resume in your profile section"
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "RESUME_REQUIRED"
 *                     reason:
 *                       type: string
 *                       example: "A resume is required to apply to projects"
 *                     action:
 *                       type: string
 *                       example: "Upload your resume in the profile section before applying"
 *       403:
 *         description: Access denied - user not approved
 *       404:
 *         description: Project not found
 */

/**
 * @swagger
 * /auth/upload-resume:
 *   post:
 *     tags: [File Upload]
 *     summary: Upload resume document
 *     description: Upload resume file (PDF, DOC, DOCX) to user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume file (PDF, DOC, DOCX)
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name for resume
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name for resume
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name for resume
 *     responses:
 *       200:
 *         description: Resume uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Resume uploaded and stored successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     resume_url:
 *                       type: string
 *                       format: uri
 *                       example: "https://res.cloudinary.com/.../raw/upload/.../resume.pdf"
 *                     cloudinaryData:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                         publicId:
 *                           type: string
 *                         originalName:
 *                           type: string
 *                         fileSize:
 *                           type: number
 *       400:
 *         description: File validation error
 *       500:
 *         description: Server error during upload
 */

/**
 * @swagger
 * /auth/upload-id-document:
 *   post:
 *     tags: [File Upload]
 *     summary: Upload ID document
 *     description: Upload identification document (PDF, JPG, PNG) to user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               idDocument:
 *                 type: string
 *                 format: binary
 *                 description: ID document file (PDF, JPG, PNG)
 *               id_document:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name
 *     responses:
 *       200:
 *         description: ID document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ID document uploaded and stored successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_document_url:
 *                       type: string
 *                       format: uri
 *                       example: "https://res.cloudinary.com/.../raw/upload/.../id_document.pdf"
 */

/**
 * @swagger
 * /auth/projects/available:
 *   get:
 *     tags: [Projects]
 *     summary: Get available projects
 *     description: Retrieve list of active projects available for applications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of projects per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by project category
 *     responses:
 *       200:
 *         description: Available projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Available projects retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalProjects:
 *                           type: integer
 */

/**
 * @swagger
 * /auth/projects/{projectId}/guidelines:
 *   get:
 *     tags: [Projects]
 *     summary: Get project guidelines
 *     description: Access project guidelines and resources (only for approved applicants)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project guidelines retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Project guidelines retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     projectInfo:
 *                       $ref: '#/components/schemas/Project'
 *                     guidelines:
 *                       type: object
 *                       properties:
 *                         documentLink:
 *                           type: string
 *                           format: uri
 *                           example: "https://docs.google.com/document/d/guidelines"
 *                         videoLink:
 *                           type: string
 *                           format: uri
 *                           example: "https://youtube.com/watch?v=tutorial"
 *                         communityLink:
 *                           type: string
 *                           format: uri
 *                           example: "https://discord.gg/community"
 *                         trackerLink:
 *                           type: string
 *                           format: uri
 *                           example: "https://trello.com/b/project-tracker"
 *       403:
 *         description: Access denied - user not approved for this project
 */