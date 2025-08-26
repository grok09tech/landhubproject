# API Debugging Guide

## Enhanced Error Handling

I've improved your MapView.tsx with enhanced error handling that will help identify the exact cause of API failures. The new implementation includes:

### 1. Detailed Response Inspection
- Logs HTTP status codes and messages
- Checks Content-Type headers to detect HTML responses
- Provides specific error messages for common status codes:
  - 404: API endpoint not found
  - 500: Internal server error
  - 503: Service unavailable
  - 401/403: Authentication/authorization issues

### 2. Graceful Fallback
- Falls back to demo data when API is unavailable
- Continues functioning in offline mode
- Clearly indicates when demo data is being used

### 3. Content Type Validation
- Validates that the API returns JSON (not HTML error pages)
- Logs response preview when unexpected content type is received

## How to Debug API Issues

### Step 1: Check Browser Console
Open your browser's Developer Tools (F12) and look for detailed error logs. The new implementation will show:

```
❌ API responded with error: {
  status: 404,
  statusText: "Not Found",
  url: "http://localhost:3000/api/plots",
  headers: {...},
  responseBody: "<!DOCTYPE html>..."
}
```

### Step 2: Use the Debug Script
Run the debug script I created:

```bash
node debug-api.js
```

This will test your API endpoints directly and show exactly what's being returned.

### Step 3: Check Your Backend
Make sure your backend server is running and accessible:

```bash
# Check if backend is running
curl http://localhost:8000/api/plots

# Or check the port your backend uses
curl http://localhost:3000/api/plots
```

### Step 4: Verify API Endpoints
Common issues:
- Wrong port number (frontend expects one port, backend runs on another)
- API endpoints not implemented (`/api/plots` and `/api/orders`)
- CORS issues (backend not allowing frontend requests)
- Backend returning HTML error pages instead of JSON

## Common Solutions

### If getting 404 errors:
- Verify the backend API endpoints are implemented
- Check that the backend is running on the expected port
- Ensure the frontend is making requests to the correct URL

### If getting HTML instead of JSON:
- Backend might be serving a default HTML page
- API routes might not be properly configured
- Check backend logs for routing errors

### If getting CORS errors:
- Configure CORS in your backend to allow requests from your frontend
- For development, typically allow `http://localhost:5173` (Vite default)

### If getting connection refused:
- Backend server is not running
- Wrong port number in frontend API calls
- Firewall or network issues

## Current Implementation Benefits

1. **Resilient**: App continues working even when API is down
2. **Informative**: Detailed error messages help identify issues
3. **User-friendly**: Falls back to demo data with clear indicators
4. **Developer-friendly**: Comprehensive logging for debugging

The app will now show connection status and data source (live vs demo) in the UI, making it clear when there are API issues.
