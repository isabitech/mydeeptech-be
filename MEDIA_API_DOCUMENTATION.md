# Media Upload API Documentation

**Version**: 1.0.0  
**Base URL**: `/api/media`  
**Authentication**: Bearer Token Required  
**Content Type**: `multipart/form-data` for uploads

---

## Table of Contents
1. [Authentication](#authentication)
2. [Image Upload Endpoints](#image-upload-endpoints)
3. [Document Upload Endpoints](#document-upload-endpoints)
4. [Video Upload Endpoints](#video-upload-endpoints)
5. [Audio Upload Endpoints](#audio-upload-endpoints)
6. [General File Upload](#general-file-upload)
7. [File Management](#file-management)
8. [Service Information](#service-information)
9. [Error Handling](#error-handling)
10. [File Type Support](#file-type-support)

---

## Authentication

All media endpoints require authentication. Include the Bearer token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

---

## Image Upload Endpoints

### 1. Upload Single Image
**Endpoint**: `POST /api/media/upload/image`  
**Description**: Upload a single image file  
**Max File Size**: 10MB  
**Supported Formats**: JPG, JPEG, PNG, GIF, WEBP, BMP, TIFF  

**Request**:
```javascript
// Form Data
const formData = new FormData();
formData.append('image', imageFile);

// Fetch Example
fetch('/api/media/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "file": {
      "publicId": "mydeeptech/images/user123/abc123def456",
      "url": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/mydeeptech/images/user123/abc123def456.jpg",
      "originalName": "profile-photo.jpg",
      "size": 2048576,
      "format": "jpg",
      "resourceType": "image",
      "thumbnail": "https://res.cloudinary.com/your-cloud/image/upload/c_thumb,w_300,h_300/v1234567890/mydeeptech/images/user123/abc123def456.jpg",
      "optimizedUrl": "https://res.cloudinary.com/your-cloud/image/upload/w_800,h_600,q_auto,f_auto/v1234567890/mydeeptech/images/user123/abc123def456.jpg"
    },
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123"
  }
}
```

### 2. Upload Multiple Images
**Endpoint**: `POST /api/media/upload/images`  
**Description**: Upload multiple images (max 10)  
**Max Files**: 10 images  
**Max File Size**: 10MB per image  

**Request**:
```javascript
const formData = new FormData();
imageFiles.forEach((file, index) => {
  formData.append('images', file);
});

fetch('/api/media/upload/images', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "3 images uploaded successfully",
  "data": {
    "files": [
      {
        "publicId": "mydeeptech/images/user123/img1_abc123",
        "url": "https://res.cloudinary.com/...",
        "originalName": "image1.jpg",
        "size": 1024576,
        "format": "jpg",
        "resourceType": "image",
        "thumbnail": "https://res.cloudinary.com/...",
        "optimizedUrl": "https://res.cloudinary.com/..."
      }
    ],
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123",
    "totalFiles": 3
  }
}
```

### 3. Update Profile Picture
**Endpoint**: `POST /api/media/upload/profile-picture`  
**Description**: Upload and set user profile picture (replaces existing)  
**Max File Size**: 5MB  
**Auto-optimization**: 300x300 thumbnail generated  

**Request**:
```javascript
const formData = new FormData();
formData.append('profilePicture', imageFile);

fetch('/api/media/upload/profile-picture', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "data": {
    "profilePicture": {
      "publicId": "mydeeptech/profile-pictures/user123/profile_abc123",
      "url": "https://res.cloudinary.com/...",
      "thumbnail": "https://res.cloudinary.com/...",
      "optimizedUrl": "https://res.cloudinary.com/..."
    },
    "updatedAt": "2024-01-20T10:30:00.000Z"
  }
}
```

---

## Document Upload Endpoints

### Upload Document
**Endpoint**: `POST /api/media/upload/document`  
**Description**: Upload document files  
**Max File Size**: 50MB  
**Supported Formats**: PDF, DOC, DOCX, TXT, RTF  

**Request**:
```javascript
const formData = new FormData();
formData.append('document', documentFile);

fetch('/api/media/upload/document', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "file": {
      "publicId": "mydeeptech/documents/user123/doc_abc123",
      "url": "https://res.cloudinary.com/your-cloud/raw/upload/v1234567890/mydeeptech/documents/user123/doc_abc123.pdf",
      "originalName": "contract.pdf",
      "size": 5242880,
      "format": "pdf",
      "resourceType": "raw",
      "pages": 10
    },
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123"
  }
}
```

---

## Video Upload Endpoints

### Upload Video
**Endpoint**: `POST /api/media/upload/video`  
**Description**: Upload video files with automatic optimization  
**Max File Size**: 100MB  
**Supported Formats**: MP4, AVI, MOV, WMV, FLV, WEBM  

**Request**:
```javascript
const formData = new FormData();
formData.append('video', videoFile);

fetch('/api/media/upload/video', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Video uploaded successfully",
  "data": {
    "file": {
      "publicId": "mydeeptech/videos/user123/video_abc123",
      "url": "https://res.cloudinary.com/your-cloud/video/upload/v1234567890/mydeeptech/videos/user123/video_abc123.mp4",
      "originalName": "presentation.mp4",
      "size": 52428800,
      "format": "mp4",
      "resourceType": "video",
      "duration": 120.5,
      "thumbnail": "https://res.cloudinary.com/your-cloud/video/upload/so_auto/v1234567890/mydeeptech/videos/user123/video_abc123.jpg",
      "streamingUrl": "https://res.cloudinary.com/your-cloud/video/upload/q_auto/v1234567890/mydeeptech/videos/user123/video_abc123.mp4"
    },
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123"
  }
}
```

---

## Audio Upload Endpoints

### Upload Audio
**Endpoint**: `POST /api/media/upload/audio`  
**Description**: Upload audio files with streaming optimization  
**Max File Size**: 50MB  
**Supported Formats**: MP3, WAV, AAC, FLAC, OGG  

**Request**:
```javascript
const formData = new FormData();
formData.append('audio', audioFile);

fetch('/api/media/upload/audio', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Audio uploaded successfully",
  "data": {
    "file": {
      "publicId": "mydeeptech/audio/user123/audio_abc123",
      "url": "https://res.cloudinary.com/your-cloud/video/upload/v1234567890/mydeeptech/audio/user123/audio_abc123.mp3",
      "originalName": "podcast.mp3",
      "size": 10485760,
      "format": "mp3",
      "resourceType": "video",
      "duration": 300.2,
      "streamingUrl": "https://res.cloudinary.com/your-cloud/video/upload/q_auto/v1234567890/mydeeptech/audio/user123/audio_abc123.mp3"
    },
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123"
  }
}
```

---

## General File Upload

### Upload Any File
**Endpoint**: `POST /api/media/upload/file`  
**Description**: Upload any file type  
**Max File Size**: 100MB  

**Request**:
```javascript
const formData = new FormData();
formData.append('file', anyFile);

fetch('/api/media/upload/file', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file": {
      "publicId": "mydeeptech/files/user123/file_abc123",
      "url": "https://res.cloudinary.com/...",
      "originalName": "data.json",
      "size": 1024,
      "format": "json",
      "resourceType": "raw",
      "mimeType": "application/json"
    },
    "uploadedAt": "2024-01-20T10:30:00.000Z",
    "uploadedBy": "user123"
  }
}
```

---

## File Management

### 1. Get File Information
**Endpoint**: `GET /api/media/file/:publicId`  
**Description**: Retrieve file metadata from Cloudinary  

**Request**:
```javascript
fetch('/api/media/file/mydeeptech%2Fimages%2Fuser123%2Fabc123def456', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

**Response**:
```json
{
  "success": true,
  "message": "File information retrieved successfully",
  "data": {
    "publicId": "mydeeptech/images/user123/abc123def456",
    "url": "https://res.cloudinary.com/...",
    "format": "jpg",
    "resourceType": "image",
    "size": 2048576,
    "width": 1920,
    "height": 1080,
    "createdAt": "2024-01-20T10:30:00.000Z",
    "version": 1234567890,
    "etag": "abc123def456789"
  }
}
```

### 2. Delete File
**Endpoint**: `DELETE /api/media/file/:publicId`  
**Description**: Delete file from Cloudinary storage  

**Request**:
```javascript
fetch('/api/media/file/mydeeptech%2Fimages%2Fuser123%2Fabc123def456', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

**Response**:
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "publicId": "mydeeptech/images/user123/abc123def456",
    "deletedAt": "2024-01-20T10:35:00.000Z",
    "deletedBy": "user123"
  }
}
```

---

## Service Information

### 1. Health Check
**Endpoint**: `GET /api/media/health`  
**Description**: Check media service status  

**Response**:
```json
{
  "success": true,
  "message": "Media service is running",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "cloudinaryConfigured": true,
  "supportedTypes": {
    "images": ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"],
    "documents": ["pdf", "doc", "docx", "txt", "rtf"],
    "videos": ["mp4", "avi", "mov", "wmv", "flv", "webm"],
    "audio": ["mp3", "wav", "aac", "flac", "ogg"]
  },
  "maxFileSizes": {
    "images": "10MB",
    "documents": "50MB",
    "videos": "100MB",
    "audio": "50MB",
    "general": "100MB"
  }
}
```

### 2. Service Information
**Endpoint**: `GET /api/media/info`  
**Description**: Get detailed media service information  

**Response**:
```json
{
  "success": true,
  "message": "Media upload information",
  "data": {
    "endpoints": {
      "singleImage": "POST /api/media/upload/image",
      "multipleImages": "POST /api/media/upload/images",
      "profilePicture": "POST /api/media/upload/profile-picture",
      "document": "POST /api/media/upload/document",
      "video": "POST /api/media/upload/video",
      "audio": "POST /api/media/upload/audio",
      "generalFile": "POST /api/media/upload/file"
    },
    "fileTypes": {
      "images": {
        "allowed": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"],
        "maxSize": "10MB",
        "maxFiles": 10,
        "optimizations": ["thumbnail generation", "automatic compression", "format conversion"]
      },
      "documents": {
        "allowed": [".pdf", ".doc", ".docx", ".txt", ".rtf"],
        "maxSize": "50MB",
        "features": ["page count detection", "text extraction ready"]
      },
      "videos": {
        "allowed": [".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"],
        "maxSize": "100MB",
        "features": ["thumbnail generation", "streaming optimization", "format conversion"]
      },
      "audio": {
        "allowed": [".mp3", ".wav", ".aac", ".flac", ".ogg"],
        "maxSize": "50MB",
        "features": ["streaming optimization", "format conversion"]
      }
    },
    "security": {
      "authentication": "Bearer token required",
      "virusScanning": "Enabled",
      "contentFiltering": "Enabled"
    },
    "storage": {
      "provider": "Cloudinary",
      "cdn": "Global CDN distribution",
      "backup": "Automatic backup and versioning"
    }
  }
}
```

---

## Error Handling

### Common Error Responses

#### Authentication Error
```json
{
  "success": false,
  "message": "Access denied. No token provided.",
  "error": "UNAUTHORIZED"
}
```

#### File Size Exceeded
```json
{
  "success": false,
  "message": "File size exceeds maximum limit",
  "error": "FILE_TOO_LARGE",
  "maxSize": "10MB"
}
```

#### Unsupported File Type
```json
{
  "success": false,
  "message": "Unsupported file type",
  "error": "INVALID_FILE_TYPE",
  "supportedTypes": ["jpg", "jpeg", "png"]
}
```

#### File Not Found
```json
{
  "success": false,
  "message": "File not found",
  "error": "FILE_NOT_FOUND"
}
```

#### Server Error
```json
{
  "success": false,
  "message": "Server error uploading file",
  "error": "INTERNAL_SERVER_ERROR"
}
```

---

## File Type Support

### Images
- **Extensions**: .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff
- **Max Size**: 10MB per file
- **Features**: Automatic compression, thumbnail generation, format conversion
- **Optimizations**: CDN delivery, responsive sizing

### Documents
- **Extensions**: .pdf, .doc, .docx, .txt, .rtf
- **Max Size**: 50MB per file
- **Features**: Page count detection, text extraction ready
- **Security**: Virus scanning enabled

### Videos
- **Extensions**: .mp4, .avi, .mov, .wmv, .flv, .webm
- **Max Size**: 100MB per file
- **Features**: Automatic thumbnail generation, streaming optimization
- **Formats**: Auto-conversion to web-friendly formats

### Audio
- **Extensions**: .mp3, .wav, .aac, .flac, .ogg
- **Max Size**: 50MB per file
- **Features**: Streaming optimization, format conversion
- **Quality**: Auto-optimization for web playback

---

## Frontend Integration Examples

### React Upload Component
```jsx
import React, { useState } from 'react';

const MediaUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/media/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit" disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload Image'}
      </button>
      
      {result && result.success && (
        <div>
          <p>Upload successful!</p>
          <img src={result.data.file.thumbnail} alt="Thumbnail" />
        </div>
      )}
    </form>
  );
};
```

### JavaScript Fetch Example
```javascript
// Upload single image
const uploadImage = async (imageFile, token) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch('/api/media/upload/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data.file;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Usage
const token = localStorage.getItem('authToken');
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

uploadImage(file, token)
  .then(fileData => {
    console.log('File uploaded:', fileData);
    // Display image
    const img = document.createElement('img');
    img.src = fileData.optimizedUrl;
    document.body.appendChild(img);
  })
  .catch(error => {
    console.error('Upload failed:', error);
  });
```

---

This documentation provides comprehensive information for integrating the media upload system into your frontend application. All endpoints return consistent JSON responses and include proper error handling for a smooth user experience.