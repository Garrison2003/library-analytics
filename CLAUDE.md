# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (run from `frontend/`)
```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # Type-check + build for production (tsc -b && vite build)
npm run lint         # Run ESLint
npm run test         # Run Vitest (all tests)
npm test -- --run    # Run Vitest once (no watch mode, as used in CI)
npm run test:ui      # Vitest with browser UI
npm run test:coverage
```

### Lambda Tests (Python, run from each lambda directory)
```bash
cd lambdas/circulationLambda   && python -m pytest tests/ -v
cd lambdas/timeSeriesLambda    && python -m pytest tests/ -v
cd lambdas/uploadHandlerLambda && python -m pytest tests/ -v
cd lambdas/programmingDataParser && python -m pytest tests/ -v
cd lambdas/programmingHistoryAPI && python -m pytest tests/ -v
```
Python test dependencies: `pip install pytest openpyxl boto3 botocore numpy pandas matplotlib`

### TypeScript Lambda (run from `lambdas/timeSeriesLambda/`)
```bash
npm run build    # Compile TypeScript
npm run package  # Build + zip for deployment
```

## Architecture

This is a library circulation analytics platform. The data flow is:

1. **Upload**: `.xlsm`/`.xlsx` files are uploaded via the React frontend → API Gateway → `uploadHandlerLambda` (Python) → S3
2. **Parse**: `circulationLambda` (Python + openpyxl) and `programmingDataParser` (Python) parse uploaded files and store structured data in DynamoDB
3. **Serve**: `timeSeriesLambda` (TypeScript/Node) and `programmingHistoryAPI` (Python) query DynamoDB and return JSON to API Gateway
4. **Display**: React frontend fetches data via `frontend/src/services/api.ts` (singleton `APIService`) and renders charts

### Key boundaries

- **Frontend** (`frontend/src/`): React 19 + TypeScript + Tailwind. Pages live in `pages/`, reusable UI in `components/`, all API calls go through the singleton `apiClient` in `services/api.ts`. Auth0 wraps the entire app in `App.tsx`.
- **Lambdas** (`lambdas/`): Each lambda is independent — Python lambdas are single-file. `timeSeriesLambda` uses `lambda_handler.py` (Python) as the entry point; `index.ts` is a leftover stub and not deployed.
- **Infrastructure** (`TF/`): Terraform manages all AWS resources. Lambda zips are built by CI and placed into `TF/` before `terraform apply` runs. Do not run Terraform locally against prod/dev — changes deploy through GitHub Actions on push to `main` (prod) or `dev` (dev environment).

### Frontend type system

All shared types live in `frontend/src/types/index.ts`. Key types:
- `CirculationData`, `MonthlyAnalytics`, `DailyAnalytics` — chart data shapes
- `APIResponse<T>` — generic wrapper returned by all API endpoints
- `FileUploadResponse` — includes a `FILE_EXISTS` conflict status (HTTP 409 is handled specially in `uploadFile()`, not thrown as an error)
- `Question` / `Answer` — MCP AI assistant integration

### CI/CD

GitHub Actions (`.github/workflows/config.yaml`):
- **Every push**: runs all frontend and Python lambda tests
- **Push to `main` or `dev`**: tests → build lambda zips → Terraform apply → build React app with env vars from Terraform outputs → deploy to S3 + CloudFront invalidation

Environment variables for the React build (`VITE_AUTH0_*`, `VITE_API_URL`) come from GitHub secrets and Terraform outputs at deploy time, not from local `.env` files checked in.

### Branch → environment mapping
- `main` → prod (`library-analytics-prod` workspace, `library-analytics.com`)
- `dev` → dev (`library-analytics-dev` workspace, `library-analytics-dev.com`)
