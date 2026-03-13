/**
 * @swagger
 * info:
 *   title: MyDeepTech API
 *   version: '1.0.0'
 *   description: |
 *     Comprehensive API documentation for MyDeepTech annotation platform.
 *     
 *     ## API Organization
 *     This API is organized into the following main sections:
 *     
 *     - **Authentication**: User registration, login, and token management
 *     - **Admin**: Administrative functions and user management
 *     - **Domains**: Category, subcategory, and domain management
 *     - **Assessments**: Project and assessment management
 *     - **Media**: File upload and media management
 *     - **Chat**: Real-time messaging and support
 *     
 *     ## Authentication
 *     Most endpoints require Bearer token authentication. Include your JWT token in the Authorization header:
 *     ```
 *     Authorization: Bearer <your-jwt-token>
 *     ```
 *     
 *     ## Error Handling
 *     All endpoints return consistent error responses with the following structure:
 *     ```json
 *     {
 *       "success": false,
 *       "message": "Error description",
 *       "error": {
 *         "code": "ERROR_CODE",
 *         "reason": "Detailed error reason",
 *         "action": "Suggested action to resolve"
 *       }
 *     }
 *     ```
 *   contact:
 *     name: MyDeepTech Support
 *     email: support@mydeeptech.ng
 *     url: https://mydeeptech.ng
 */