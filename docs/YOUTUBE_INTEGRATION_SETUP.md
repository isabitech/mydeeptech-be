# YouTube Embed Integration Configuration for Multimedia Assessment System

## Required Environment Variables

Add the following environment variables to your `.env` file:

```bash
# YouTube Data API v3 Configuration
YOUTUBE_API_KEY=your_youtube_data_api_v3_key_here

# Optional: YouTube API Configuration
YOUTUBE_API_QUOTA_LIMIT=10000  # Daily quota limit (default: 10000)
YOUTUBE_API_REQUESTS_PER_SECOND=1  # Rate limiting (default: 1 request per second)
```

## YouTube Embed URL Format

The system now uses YouTube embed URLs to resolve CORS policy issues on the frontend:

**Preferred Format**: `https://www.youtube.com/embed/VIDEO_ID`

**Auto-Conversion**: The system accepts these formats and converts them to embed URLs:
- `https://www.youtube.com/shorts/VIDEO_ID` → `https://www.youtube.com/embed/VIDEO_ID`
- `https://youtu.be/VIDEO_ID` → `https://www.youtube.com/embed/VIDEO_ID`  
- `https://www.youtube.com/watch?v=VIDEO_ID` → `https://www.youtube.com/embed/VIDEO_ID`

## Getting YouTube Data API v3 Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3:
   - Navigate to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key
   - (Optional) Restrict the key to YouTube Data API v3 for security

## API Usage and Quotas

- **Daily Quota**: 10,000 units per day (default)
- **Video Details Request**: 1-4 units per request
- **Search Request**: 100 units per request
- **Recommended Rate Limiting**: 1 request per second

### API Operations Used:

1. **Video Details** (`videos` endpoint):
   - Gets video metadata (title, description, duration, thumbnails)
   - Gets video statistics (view count, like count)
   - Gets video content details (duration, aspect ratio)
   - Cost: 1-4 quota units per request

## Supported YouTube URL Formats

The system accepts these YouTube URL formats and automatically converts them to embed format:

```
Input formats (auto-converted):
https://www.youtube.com/shorts/VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/watch?v=VIDEO_ID
https://youtube.com/watch?v=VIDEO_ID

Output format (embed):
https://www.youtube.com/embed/VIDEO_ID
```

## Video Requirements

- **Duration**: Maximum 60 seconds (YouTube Shorts requirement)
- **Aspect Ratio**: Preferably 9:16 (portrait) for mobile viewing
- **Content**: Must be publicly accessible (not private/unlisted)
- **Age Restrictions**: No age-restricted content for assessments
- **CORS Compatibility**: Embed URLs resolve frontend CORS policy issues

## Error Handling

The system handles these common scenarios:

1. **Invalid URLs**: Returns validation error
2. **Private/Deleted Videos**: Returns "video not found" error  
3. **API Key Missing**: Falls back to basic URL validation
4. **Rate Limiting**: Implements automatic delays between requests
5. **Quota Exceeded**: Returns appropriate error message

## Testing the Integration

Use these test endpoints with embed URLs:

```bash
# Test single video addition
POST /api/admin/multimedia-assessments/reels/add
{
  "youtubeUrl": "https://www.youtube.com/embed/YOUR_VIDEO_ID",
  "niche": "education",
  "title": "Test Video",
  "description": "Test description"
}

# Test with auto-conversion
POST /api/admin/multimedia-assessments/reels/add
{
  "youtubeUrl": "https://www.youtube.com/shorts/YOUR_VIDEO_ID", // Auto-converts to embed
  "niche": "education"
}

# Test bulk video addition  
POST /api/admin/multimedia-assessments/reels/bulk-add
{
  "youtubeUrls": [
    "https://www.youtube.com/embed/VIDEO_ID_1",
    "https://www.youtube.com/shorts/VIDEO_ID_2", // Auto-converts
    "https://youtu.be/VIDEO_ID_3" // Auto-converts
  ],
  "defaultNiche": "education",
  "defaultTags": ["test", "assessment"]
}
```

## Monitoring and Logs

The system logs the following YouTube integration events:

- ✅ Successful video data extraction
- ⚠️ Videos longer than 60 seconds (warnings)
- ❌ API errors and rate limiting
- 📺 YouTube API requests and responses
- 🎬 Video processing and validation results

Check your application logs for these prefixed messages to monitor YouTube integration health.