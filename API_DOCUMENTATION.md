// docs/API_DOCUMENTATION.md

# API Documentation

## Library Analytics - API Reference & MCP Integration

Complete documentation for all API endpoints and MCP server integration.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Circulation Data Endpoints](#circulation-data-endpoints)
4. [Analytics Endpoints](#analytics-endpoints)
5. [File Upload](#file-upload)
6. [Questions & MCP Integration](#questions--mcp-integration)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

---

## API Overview

### Base URL

```
Development: http://localhost:3000/api
Production: https://api.libraryanalytics.example.com/api
```

### Response Format

All endpoints return JSON responses with the following structure:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2025-05-23T12:34:56.789Z",
  "requestId": "req_abc123def456"
}
```

### HTTP Methods

- `GET` - Retrieve data
- `POST` - Create new data
- `PUT` - Update existing data
- `DELETE` - Remove data
- `PATCH` - Partial update

---

## Authentication

### Token-Based Authentication

```bash
# Get authentication token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

### Using Token

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/circulation
```

### Token Refresh

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

---

## Circulation Data Endpoints

### Get Circulation Data

**Endpoint:**

```
GET /circulation
```

**Query Parameters:**

```
- category (optional): Filter by category name
- startDate (optional): ISO format date
- endDate (optional): ISO format date
- limit (optional): Number of records (default: 100)
- offset (optional): Pagination offset
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/circulation?category=Juvenile%20Fiction"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "category": "Juvenile Fiction",
        "month": "May 2025",
        "year": 2025,
        "circulation": 600
      }
    ],
    "lastUpdated": "2025-05-23T12:00:00Z",
    "totalRecords": 12
  }
}
```

---

### Get Category List

**Endpoint:**

```
GET /circulation/categories
```

**Response:**

```json
{
  "success": true,
  "data": [
    "Juvenile Fiction",
    "Young Adult",
    "Adult Fiction",
    "Non-Fiction",
    "Reference",
    "Children Books"
  ]
}
```

---

## Analytics Endpoints

### Get Monthly Analytics

**Endpoint:**

```
GET /analytics/monthly
```

**Query Parameters:**

```
- month: Month name (January, February, etc.)
- year: Year (2025)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/analytics/monthly?month=May&year=2025"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "month": "May",
    "year": 2025,
    "totalCirculation": 4500,
    "categories": {
      "Juvenile Fiction": 600,
      "Young Adult": 450,
      "Adult Fiction": 2000,
      "Non-Fiction": 1000,
      "Reference": 400,
      "Children Books": 50
    },
    "topCategory": "Adult Fiction",
    "comparisonsToLastMonth": {
      "Juvenile Fiction": 0.05,
      "Young Adult": 0.08
    }
  }
}
```

---

### Get Daily Analytics

**Endpoint:**

```
GET /analytics/daily
```

**Query Parameters:**

```
- date: ISO format date (2025-05-23)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/analytics/daily?date=2025-05-23"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "date": "2025-05-23",
    "totalCirculation": 150,
    "categories": {
      "Juvenile Fiction": 45,
      "Young Adult": 35,
      "Adult Fiction": 60,
      "Non-Fiction": 10
    },
    "peakHours": ["14:00-15:00", "16:00-17:00"],
    "userCount": 120
  }
}
```

---

## File Upload

### Upload Circulation Data

**Endpoint:**

```
POST /upload
```

**Content-Type:**

```
multipart/form-data
```

**Form Fields:**

```
- file (required): CSV or Excel file
- category (optional): Category name
- overwrite (optional): Boolean (true/false)
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@circulation_data.csv" \
  -F "category=Juvenile Fiction" \
  -F "overwrite=false"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileName": "circulation_data.csv",
    "recordsProcessed": 100,
    "recordsSkipped": 2,
    "errors": [
      {
        "row": 5,
        "column": "circulation",
        "message": "Invalid number format"
      }
    ],
    "warnings": ["Some dates were adjusted to nearest month"],
    "timestamp": "2025-05-23T12:34:56.789Z"
  }
}
```

### File Validation

**Endpoint:**

```
POST /upload/validate
```

Validate file without uploading:

```bash
curl -X POST http://localhost:3000/api/upload/validate \
  -F "file=@circulation_data.csv"
```

---

## Questions & MCP Integration

### Ask Question (MCP Relay)

**Endpoint:**

```
POST /questions/ask
```

**Request Body:**

```json
{
  "query": "What were the circulation trends last month?",
  "category": "Juvenile Fiction",
  "timeRange": {
    "startDate": "2025-04-01",
    "endDate": "2025-04-30"
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/questions/ask \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What were the circulation trends last month?"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "q_abc123def456",
    "questionId": "q_abc123def456",
    "response": "Based on the library data, circulation in April 2025 showed a 12% increase compared to March. The Juvenile Fiction category led with 1,150 items circulated, followed by Young Adult with 1,080 items. Overall trends indicate seasonal growth in youth categories.",
    "confidence": 0.95,
    "sources": ["circulation_data", "category_analysis"],
    "metadata": {
      "model": "claude-3-sonnet",
      "processingTime": 1234,
      "tokensUsed": 156
    },
    "timestamp": "2025-05-23T12:34:56.789Z"
  }
}
```

### Get Question History

**Endpoint:**

```
GET /questions/history
```

**Query Parameters:**

```
- limit: Number of questions (default: 10, max: 100)
- offset: Pagination offset (default: 0)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/questions/history?limit=10&offset=0"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "q_001",
      "query": "What were the circulation trends last month?",
      "category": null,
      "timeRange": null,
      "timestamp": "2025-05-23T12:00:00Z"
    }
  ]
}
```

### Get Answer for Question

**Endpoint:**

```
GET /questions/{questionId}/answer
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/questions/q_abc123def456/answer"
```

---

## MCP Server Configuration

### Environment Variables

```env
# MCP Server URL
VITE_MCP_SERVER_URL=http://localhost:3001/mcp

# Enable/Disable MCP
VITE_MCP_ENABLED=true

# MCP Timeout (milliseconds)
VITE_MCP_TIMEOUT=60000
```

### MCP Request Format

```json
{
  "method": "ask_question",
  "params": {
    "query": "user question here",
    "context": {
      "category": "optional category",
      "dateRange": {
        "start": "2025-01-01",
        "end": "2025-12-31"
      }
    }
  },
  "id": "request_id_123"
}
```

### MCP Response Format

```json
{
  "result": {
    "response": "AI generated response",
    "confidence": 0.95,
    "sources": ["source1", "source2"]
  },
  "id": "request_id_123"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid query parameter",
    "details": {
      "field": "category",
      "issue": "Unknown category name"
    }
  },
  "timestamp": "2025-05-23T12:34:56.789Z",
  "requestId": "req_error_123"
}
```

### HTTP Status Codes

| Code | Meaning       | Description                    |
| ---- | ------------- | ------------------------------ |
| 200  | OK            | Request succeeded              |
| 201  | Created       | Resource created               |
| 400  | Bad Request   | Invalid request parameters     |
| 401  | Unauthorized  | Missing/invalid authentication |
| 403  | Forbidden     | Insufficient permissions       |
| 404  | Not Found     | Resource not found             |
| 422  | Unprocessable | Invalid data format            |
| 500  | Server Error  | Internal server error          |
| 503  | Unavailable   | Service temporarily down       |

### Common Error Codes

```
INVALID_REQUEST - Invalid request parameters
INVALID_FILE - Invalid file format
FILE_TOO_LARGE - File exceeds size limit
UNAUTHORIZED - Authentication required
FORBIDDEN - Permission denied
NOT_FOUND - Resource not found
DUPLICATE - Resource already exists
INVALID_DATA - Data validation failed
MCP_ERROR - MCP server error
TIMEOUT - Request timeout
```

---

## Examples

### Complete Workflow Example

#### 1. Upload Circulation Data

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@circulation_data.csv" \
  -F "category=Juvenile Fiction"
```

#### 2. Get Circulation Data

```bash
curl -X GET "http://localhost:3000/api/circulation?category=Juvenile%20Fiction"
```

#### 3. Get Monthly Analytics

```bash
curl -X GET "http://localhost:3000/api/analytics/monthly?month=May&year=2025"
```

#### 4. Ask Question via MCP

```bash
curl -X POST http://localhost:3000/api/questions/ask \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What category had the highest circulation?"
  }'
```

### Using with JavaScript/Fetch

```typescript
// Get circulation data
const response = await fetch(
  "http://localhost:3000/api/circulation?category=Juvenile%20Fiction",
);
const data = await response.json();

// Ask question
const questionResponse = await fetch(
  "http://localhost:3000/api/questions/ask",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "What were the circulation trends?",
    }),
  },
);
const answer = await questionResponse.json();
```

---

## Rate Limiting

- **Default Limit**: 100 requests per minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Status Code**: 429 Too Many Requests

---

## Pagination

For endpoints returning arrays, pagination is supported:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

---

## Caching

Responses are cached by default:

- **Duration**: 5 minutes
- **Header**: `X-Cache: HIT` or `X-Cache: MISS`
- **Override**: `?cache=false`

---

**Last Updated**: May 2025
