# Export Approved Annotators CSV - API Documentation

## Endpoint Overview
**Purpose:** Export approved annotators for a specific project as a downloadable CSV file  
**Method:** `GET`  
**URL:** `/api/admin/projects/:projectId/export-approved-csv`  
**Authentication:** Admin JWT token required

---

## Request Details

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The MongoDB ObjectId of the project |

### Headers
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

### Example Request
```javascript
GET /api/admin/projects/693a8f6f99988f6cda380131/export-approved-csv
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Response Details

### Success Response (200 OK)
**Content-Type:** `text/csv`  
**Headers:**
- `Content-Disposition: attachment; filename="project_name_approved_annotators_2025-12-16.csv"`
- `Access-Control-Expose-Headers: Content-Disposition`

**CSV Structure:**
```csv
Full Name,Country,Email
"John Doe","Nigeria","john.doe@email.com"
"Jane Smith","Kenya","jane.smith@email.com"
```

### Error Responses

#### 404 - Project Not Found
```json
{
  "success": false,
  "message": "Project not found"
}
```

#### 404 - No Approved Annotators
```json
{
  "success": false,
  "message": "No approved annotators found for this project"
}
```

#### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Admin authentication required."
}
```

#### 500 - Server Error
```json
{
  "success": false,
  "message": "Server error exporting annotators",
  "error": "Error details..."
}
```

---

## Frontend Implementation Examples

### 1. Vanilla JavaScript/Fetch API
```javascript
async function downloadApprovedAnnotators(projectId) {
  try {
    const token = localStorage.getItem('adminToken'); // or however you store the token
    
    const response = await fetch(`/api/admin/projects/${projectId}/export-approved-csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to export CSV');
    }
    
    // Get filename from response headers
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'approved_annotators.csv';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1];
      }
    }
    
    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ CSV downloaded successfully');
  } catch (error) {
    console.error('❌ Error downloading CSV:', error);
    alert('Failed to download CSV: ' + error.message);
  }
}

// Usage
downloadApprovedAnnotators('693a8f6f99988f6cda380131');
```

### 2. React/Axios Implementation
```javascript
import axios from 'axios';

const downloadApprovedAnnotators = async (projectId) => {
  try {
    const token = localStorage.getItem('adminToken');
    
    const response = await axios({
      method: 'GET',
      url: `/api/admin/projects/${projectId}/export-approved-csv`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'blob', // Important for file downloads
    });
    
    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'approved_annotators.csv';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1];
      }
    }
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error downloading CSV:', error);
    if (error.response?.data) {
      // If the error response is JSON, parse it
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const errorData = JSON.parse(reader.result);
          alert(`Error: ${errorData.message}`);
        } catch {
          alert('Failed to download CSV');
        }
      };
      reader.readAsText(error.response.data);
    } else {
      alert('Failed to download CSV');
    }
  }
};
```

### 3. React Component Example
```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ExportButton = ({ projectId, projectName }) => {
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const token = localStorage.getItem('adminToken');
      
      const response = await axios({
        method: 'GET',
        url: `/api/admin/projects/${projectId}/export-approved-csv`,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob',
      });
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${projectName}_approved_annotators.csv`;
      if (contentDisposition) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches?.[1]) filename = matches[1];
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export annotators');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <button 
      onClick={handleExport}
      disabled={isExporting}
      className="export-btn"
    >
      {isExporting ? 'Exporting...' : 'Export Approved Annotators'}
    </button>
  );
};
```

---

## Additional Notes

### CSV File Details
- **Encoding:** UTF-8
- **Format:** Standard CSV with comma separators
- **Headers:** Always included as first row
- **Data handling:** Missing values shown as "N/A"
- **Filename format:** `{project_name}_approved_annotators_{YYYY-MM-DD}.csv`

### Error Handling Tips
1. Always check response status before processing
2. Handle blob responses for error cases (they might contain JSON error messages)
3. Provide user feedback for long-running exports
4. Consider adding retry logic for network failures

### Security Considerations
- Admin token must be valid and not expired
- Only admins can access this endpoint
- Project access is not restricted beyond admin authentication