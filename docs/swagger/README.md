# API Documentation Structure

This folder contains the organized Swagger/OpenAPI documentation for the MyDeepTech API, separated from the actual route files for better maintainability.

## Folder Structure

```
docs/
├── swagger/
│   ├── README.md              # This file - documentation guide
│   ├── index.docs.js          # Main API info and general documentation
│   ├── auth.docs.js           # Authentication endpoints
│   ├── admin.docs.js          # Admin operations
│   ├── domains.docs.js        # Domain/Category/Subcategory management
│   ├── assessment.docs.js     # Assessment and project management
│   └── [module].docs.js       # Additional module documentation
└── api-documentation.js       # Legacy documentation (being migrated)
```

## How to Add New API Documentation

### 1. Create a New Documentation File

Create a new file following the naming pattern: `[module-name].docs.js`

```javascript
/**
 * @swagger
 * tags:
 *   - name: YourModule
 *     description: Description of what this module does
 */

/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Brief description
 *     tags: [YourModule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *                 example: "example value"
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

### 2. Organization Guidelines

- **One file per major feature/module** (auth, admin, domains, etc.)
- **Use consistent tags** for grouping related endpoints
- **Include security requirements** for protected endpoints
- **Provide clear examples** in request/response schemas
- **Reference shared schemas** where possible (`$ref: '#/components/schemas/Error'`)

### 3. Best Practices

#### Tags

```javascript
/**
 * @swagger
 * tags:
 *   - name: ModuleName
 *     description: Clear description of what this module handles
 */
```

#### Security

For protected endpoints, always include:

```javascript
security:
  - bearerAuth: []
```

#### Error Responses

Use the shared Error schema for consistent error responses:

```javascript
400:
  description: Bad request
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/Error'
```

#### Path Structure

Always include the full API path:

```javascript
/api/module/endpoint
```

### 4. Configuration

The Swagger configuration in `config/swagger.js` automatically includes all files matching:

- `./docs/swagger/*.docs.js` - New organized documentation
- `./docs/api-documentation.js` - Legacy documentation file

## Migration from Route Files

If you have Swagger documentation mixed in with your route files:

1. **Copy the documentation** from the route file
2. **Create a new `.docs.js` file** in this folder
3. **Update path references** to include `/api` prefix
4. **Add proper security and error handling**
5. **Remove documentation from the route file**

## Testing Your Documentation

After adding new documentation:

1. Restart your development server
2. Visit `http://localhost:4000/api-docs`
3. Check that your new endpoints appear correctly
4. Test the "Try it out" functionality

## Shared Schemas

The main schemas (User, Error, etc.) are defined in `config/swagger.js`. Reference them using:

```javascript
$ref: "#/components/schemas/SchemaName";
```

Available shared schemas:

- `User` - Standard user object
- `Project` - Project/assessment object
- `Application` - User application object
- `Error` - Standard error response

---

This organization keeps your route files clean while maintaining comprehensive API documentation. Each documentation file is focused on a specific domain, making it easier to maintain and update.
