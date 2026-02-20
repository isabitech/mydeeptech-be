# 📊 Admin Assessment Overview API

## 🎯 Perfect Match for Your Frontend!

This endpoint provides assessment statistics in the **exact same format** as your `mockAssessments` structure.

## 📍 Endpoints Available

### 1. Assessment Overview (Main Endpoint)
```
GET /api/assessments/admin/overview
GET /api/admin/assessments/overview
```
Both URLs work the same - use whichever fits your routing structure better.

## 🔐 Authentication
- **Required**: Admin JWT token
- **Headers**: `Authorization: Bearer YOUR_ADMIN_TOKEN`

## 📊 Response Structure (Matches Your Frontend Exactly!)

```typescript
interface Assessment {
  id: string;                    // 'english_proficiency' or ObjectId
  title: string;                 // "English Proficiency Assessment"
  description: string;           // Assessment description
  type: 'english_proficiency' | 'multimedia' | 'general';
  totalSubmissions: number;      // Total submissions count
  pendingReview: number;         // Pending review count
  approvedSubmissions: number;   // Approved/passed submissions
  rejectedSubmissions: number;   // Rejected/failed submissions
  averageScore: number;          // Average score (1 decimal)
  passingScore: number;          // Passing score threshold
  completionRate: number;        // Completion rate percentage
  averageCompletionTime: number; // Time in milliseconds
  createdAt: string;            // ISO date string
  isActive: boolean;            // Assessment active status
  lastSubmissionAt: string | null; // Last submission ISO date
  projectInfo?: {               // Only for multimedia assessments
    id: string;
    name: string;
    category: string;
  };
}

interface OverviewResponse {
  success: true;
  message: "Assessment overview retrieved successfully";
  data: {
    assessments: Assessment[];
    statistics: {
      totalAssessments: number;
      activeAssessments: number;
      totalSubmissions: number;
      totalPendingReview: number;
      totalApproved: number;
      totalRejected: number;
      averageCompletionRate: number;
    };
  };
}
```

## 🔄 Replace Your Mock Data Easily

### Before (Mock Data):
```typescript
const mockAssessments: Assessment[] = [
  {
    id: 'multimedia_1',
    title: 'Multimedia Assessment',
    // ... rest of mock data
  }
];
```

### After (Real API Call):
```typescript
const [assessments, setAssessments] = useState<Assessment[]>([]);
const [statistics, setStatistics] = useState(null);

const fetchAssessments = async () => {
  try {
    const response = await fetch('/api/assessments/admin/overview', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      setAssessments(data.data.assessments);
      setStatistics(data.data.statistics);
    }
  } catch (error) {
    console.error('Failed to fetch assessments:', error);
  }
};

// Call in useEffect
useEffect(() => {
  fetchAssessments();
}, []);
```

## 📋 Real Data vs Mock Data Comparison

| Field | Mock Data | Real API Data |
|-------|-----------|---------------|
| `totalSubmissions` | Static: 45, 128, 89 | ✅ **Live database counts** |
| `pendingReview` | Static: 8, 3, 12 | ✅ **Real pending submissions** |
| `approvedSubmissions` | Static: 32, 98, 65 | ✅ **Actual passed assessments** |
| `rejectedSubmissions` | Static: 5, 27, 12 | ✅ **Actual failed assessments** |
| `averageScore` | Static: 7.8, 8.2, 6.9 | ✅ **Calculated from submissions** |
| `completionRate` | Static: 71.1%, 76.6%, 73% | ✅ **Real completion rates** |
| `averageCompletionTime` | Static values | ✅ **Actual time spent by users** |
| `lastSubmissionAt` | Static dates | ✅ **Real last submission timestamps** |

## 🎨 Assessment Types Supported

### 1. English Proficiency Assessment
```json
{
  "id": "english_proficiency",
  "title": "English Proficiency Assessment",
  "description": "Evaluate English language skills including grammar, vocabulary, and comprehension.",
  "type": "english_proficiency",
  "totalSubmissions": 128,
  "pendingReview": 0,
  "approvedSubmissions": 98,
  "rejectedSubmissions": 30,
  "averageScore": 82.4,
  "passingScore": 60,
  "completionRate": 76.6,
  "averageCompletionTime": 1800000,
  "isActive": true,
  "lastSubmissionAt": "2025-12-21T14:20:00Z"
}
```

### 2. Multimedia Assessments
```json
{
  "id": "676123abc456def789012345",
  "title": "Video Annotation Assessment",
  "description": "Create engaging conversations from Instagram-style video reels",
  "type": "multimedia",
  "totalSubmissions": 45,
  "pendingReview": 8,
  "approvedSubmissions": 32,
  "rejectedSubmissions": 5,
  "averageScore": 78.5,
  "passingScore": 70,
  "completionRate": 82.2,
  "averageCompletionTime": 2730000,
  "isActive": true,
  "lastSubmissionAt": "2025-12-21T11:30:00Z",
  "projectInfo": {
    "id": "675e1234567890abcdef1234",
    "name": "Product Review Videos",
    "category": "E-commerce"
  }
}
```

## 🌐 cURL Testing

### Basic Request:
```bash
curl -X GET "http://localhost:4000/api/assessments/admin/overview" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### With Pretty JSON Output:
```bash
curl -X GET "http://localhost:4000/api/assessments/admin/overview" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq
```

## 🔧 Frontend Integration Examples

### React with Hooks:
```typescript
import { useState, useEffect } from 'react';

interface Assessment {
  // Your existing Assessment interface
}5

const AssessmentDashboard = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/assessments/admin/overview', {
          headers: {
            'Authorization': `Bearer ${getAdminToken()}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setAssessments(data.data.assessments);
        } else {
          throw new Error(data.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch assessments');
        console.error('Error fetching assessments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, []);

  if (loading) return <div>Loading assessments...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {assessments.map(assessment => (
        <AssessmentCard key={assessment.id} assessment={assessment} />
      ))}
    </div>
  );
};
```

### Next.js API Route:
```typescript
// pages/api/assessments/overview.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch('http://localhost:4000/api/assessments/admin/overview', {
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
}
```

### Axios with Error Handling:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchAssessmentOverview = async () => {
  try {
    const response = await api.get('/assessments/admin/overview');
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to fetch assessments');
    }
    throw error;
  }
};
```

## 📈 Key Benefits

### ✅ **Zero Migration Effort**
- Same data structure as your mock data
- Just replace the data source
- No component changes needed

### ✅ **Real-Time Data**
- Live submission counts
- Actual user performance metrics
- Current assessment status

### ✅ **Comprehensive Statistics**
- Individual assessment metrics
- Overall dashboard statistics
- Performance insights

### ✅ **Future-Proof**
- Automatically includes new multimedia assessments
- Scales with your assessment system
- Maintains consistent structure

## 🚨 Error Handling

### Common Errors:
```json
// 401 Unauthorized
{
  "success": false,
  "message": "Admin authentication required"
}

// 500 Server Error
{
  "success": false,
  "message": "Failed to fetch assessments overview",
  "error": "Database connection error"
}
```

### Frontend Error Handling:
```typescript
const fetchWithErrorHandling = async () => {
  try {
    const response = await fetch('/api/assessments/admin/overview', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Redirect to login or refresh token
      window.location.href = '/admin/login';
      return;
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }

    return data.data;
  } catch (error) {
    console.error('Assessment fetch failed:', error);
    // Show user-friendly error message
  }
};
```

## 🎯 Summary

**Your Frontend Code**: ✅ **No changes needed!**
**Your Data Structure**: ✅ **Perfect match!**
**Your Mock Data**: ➡️ **Replace with real API call**

Just update your data fetching logic and you'll have real-time assessment statistics that match your existing frontend structure perfectly! 🚀