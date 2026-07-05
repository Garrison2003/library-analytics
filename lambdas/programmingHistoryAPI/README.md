# programmingHistoryAPI

Python Lambda that serves historical programming data from DynamoDB to the React frontend.

## Endpoints

Both routes are mounted under `/programming` in API Gateway and require a valid Auth0 JWT Bearer token.

### `GET /programming/history`

Returns monthly attendance and program counts for a single branch over a rolling window.

**Query parameters**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `branch`  | Yes      | —       | 3-letter branch code (e.g. `IMG`, `MAI`) |
| `months`  | No       | `12`    | Number of months to return (newest first) |

**Example request**
```
GET /dev/programming/history?branch=IMG&months=12
Authorization: Bearer <token>
```

**Example response**
```json
{
  "success": true,
  "data": {
    "branch": "IMG",
    "branchName": "Imaginon",
    "data": [
      {
        "year_month": "2026-04",
        "attendance": 4889,
        "programs": 84,
        "virtual_attendance": 0,
        "date": "2026-04-01"
      }
    ],
    "months": ["2026-04"],
    "attendance": [4889],
    "programs": [84],
    "metrics": {
      "totalAttendance": 4889,
      "totalPrograms": 84,
      "averageMonthlyAttendance": 4889,
      "growthPercent": null
    },
    "dataFound": true,
    "lastUpdated": "2026-06-06T00:00:00+00:00"
  }
}
```

---

### `GET /programming/compare`

Returns the most recent (or a specific) month's data for multiple branches side by side.

**Query parameters**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `branches` | Yes     | —       | Comma-separated branch codes (e.g. `IMG,MAI,PLZ`) |
| `month`    | No      | Latest  | Specific month in `YYYY-MM` format |

**Example request**
```
GET /dev/programming/compare?branches=IMG,MAI&month=2026-05
Authorization: Bearer <token>
```

---

## Branch codes

| Code | Branch |
|------|--------|
| `ALW` | Allegra Westbrooks Regional |
| `CAR` | Carmel |
| `IMG` | Imaginon *(aggregated — see below)* |
| `MAI` | Main |
| `MAT` | Matthews |
| `MYP` | Myers Park |
| `NCR` | North County Regional |
| `PLZ` | Plaza Midwood |
| `SPK` | SouthPark Regional |
| `UCR` | University City Regional |

Full list is in `BRANCH_CODE_MAP` in `programming_history_api_lambda.py`.

### Imaginon aggregation

Imaginon (`IMG`) is a multi-department branch. Each department uploads its own PDF independently, so DynamoDB stores their records separately:

| Code | Department |
|------|------------|
| `SPA` | Spangler |
| `TEL` | Teen Loft |

When `/history?branch=IMG` is called, the Lambda queries all three codes (`IMG`, `SPA`, `TEL`) and sums attendance and programs for each month before returning. This is transparent to the caller — the response always shows `"branch": "IMG"`.

---

## DynamoDB table

**Table:** `library-analytics-programming-data-{environment}`  
**Partition key:** `branch_code` (String)  
**Sort key:** `year_month` (String, format `YYYY-MM`)

Data is written by the `programmingDataParser` Lambda when a PDF is uploaded.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `DYNAMODB_TABLE` | Programming data table name |
| `DYNAMODB_METADATA_TABLE` | Branch metadata table name |

---

## Running tests

```bash
cd lambdas/programmingHistoryAPI
python -m pytest tests/ -v
```

Tests mock DynamoDB using `unittest.mock` — no AWS credentials required.
