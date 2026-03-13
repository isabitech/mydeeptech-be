# HVNC Shift Scheduling API

## Overview
This document outlines the payload structure for scheduling shifts for users as an admin in the HVNC system.

## Endpoint
**POST** `/api/hvnc/admin/shifts`

## Authentication
- Admin authentication required
- `shift_management` permission needed

## Payload Structure

### Required Fields
```json
{
  "userId": "string",        // MongoDB ObjectId of the user
  "deviceId": "string",      // MongoDB ObjectId of the device  
  "startDate": "string",     // ISO date string (e.g., "2024-03-15T00:00:00.000Z")
  "startTime": "string",     // 24-hour format "HH:mm" (e.g., "09:00")
  "endTime": "string"        // 24-hour format "HH:mm" (e.g., "17:00")
}
```

### Optional Fields
```json
{
  "endDate": "string",       // ISO date string, null for indefinite shifts
  "isRecurring": boolean,    // Default: false
  "daysOfWeek": [number],    // Array of numbers 0-6 (Sunday=0, Saturday=6)
  "timezone": "string"       // Default: "UTC"
}
```

## Examples

### One-time Shift
```json
{
  "userId": "64a1b2c3d4e5f6789012345",
  "deviceId": "64b2c3d4e5f6789012346",
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-15T23:59:59.999Z",
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "UTC"
}
```

### Recurring Shift (Monday-Friday)
```json
{
  "userId": "64a1b2c3d4e5f6789012345",
  "deviceId": "64b2c3d4e5f6789012346",
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.999Z",
  "startTime": "09:00",
  "endTime": "17:00",
  "isRecurring": true,
  "daysOfWeek": [1, 2, 3, 4, 5],
  "timezone": "America/New_York"
}
```

### 24/7 Shift
```json
{
  "userId": "64a1b2c3d4e5f6789012345",
  "deviceId": "64b2c3d4e5f6789012346",
  "startDate": "2024-03-15T00:00:00.000Z",
  "startTime": "00:00",
  "endTime": "23:59",
  "isRecurring": true,
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6]
}
```

## Validation Rules

- **Time Format**: Must be "HH:mm" in 24-hour format
- **Days of Week**: Numbers 0-6 (Sunday=0, Saturday=6)
- **User/Device**: IDs must exist in respective collections
- **Conflicts**: System prevents duplicate active shifts for same user/device

## Response
Returns created shift details with user and device information upon success.

## Error Codes
- `400`: Missing required fields
- `404`: User or device not found
- `409`: User already has active shift for this device
- `500`: Server error