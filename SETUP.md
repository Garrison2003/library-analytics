// docs/SETUP.md

# Setup & Installation Guide

## Library Analytics - Complete Setup Instructions

This guide will walk you through setting up the Library Analytics application from scratch.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Development](#development)
6. [Build & Deployment](#build--deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher
- **Git**: 2.0.0 or higher
- **TypeScript**: 5.2.2 or higher

### Verify Installation

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Git version
git --version
```

---

## Environment Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/library-analytics.git

# Navigate to project directory
cd library-analytics

# Create a new branch for development
git checkout -b develop
```

### 2. Install Node.js (if not already installed)

#### macOS (using Homebrew)

```bash
brew install node
```

#### Windows

```bash
# Using Chocolatey
choco install nodejs

# Or download from https://nodejs.org/
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install nodejs npm
```

---

## Installation

### Step 1: Install Dependencies

```bash
# Install all project dependencies
npm install

# Install TypeScript (if not global)
npm install -D typescript

# Install Tailwind CSS dependencies
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind CSS
npx tailwindcss init -p
```

### Step 2: Install Additional Libraries

```bash
# Install UI component library
npm install lucide-react

# Install routing (if using React Router)
npm install react-router-dom

# Install state management (optional)
npm install zustand  # or redux, jotai, etc.

# Install HTTP client (if not using fetch)
npm install axios

# Install form handling
npm install react-hook-form zod
```

### Step 3: Verify Installation

```bash
# Check installed dependencies
npm list

# Verify TypeScript installation
npx tsc --version

# Verify Tailwind CSS installation
npx tailwindcss --version
```

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root:

```env
# Application
VITE_APP_NAME=Library Analytics
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development

# API Configuration
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT=30000

# MCP Server Configuration
VITE_MCP_SERVER_URL=http://localhost:3001/mcp
VITE_MCP_ENABLED=true

# Cache Configuration
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=300000
```

### 2. TypeScript Configuration

Verify `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3. Vite Configuration

Verify `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
```

### 4. Tailwind CSS Configuration

Verify `tailwind.config.js`:

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2C3E50",
        success: "#38A169",
        warning: "#F76D3B",
      },
    },
  },
  plugins: [],
};
```

---

## Development

### Start Development Server

```bash
# Start Vite development server
npm run dev

# Server will start at http://localhost:5173
# Application will auto-reload on file changes
```

### Development Scripts

```bash
# Type checking
npm run type-check

# Linting (if ESLint is set up)
npm run lint

# Format code (if Prettier is set up)
npm run format

# Run tests (if Jest is set up)
npm test

# Run tests in watch mode
npm test:watch
```

### Project Structure

```
library-analytics/
├── src/
│   ├── components/          # React components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── CirculationTrends.tsx
│   │   ├── QuestionsSection.tsx
│   │   └── QuickAccessCard.tsx
│   ├── pages/               # Page components
│   │   ├── Homepage.tsx
│   │   ├── MonthlyAnalytics.tsx
│   │   ├── DailyAnalytics.tsx
│   │   └── Upload.tsx
│   ├── services/            # API services
│   │   ├── api.ts
│   │   └── mcpClient.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── hooks/               # Custom React hooks
│   ├── App.tsx              # Root component
│   ├── App.css              # Global styles
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── docs/                    # Documentation
├── tailwind.config.js       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
├── package.json
└── .env                     # Environment variables
```

---

## Build & Deployment

### Production Build

```bash
# Create production build
npm run build

# Output will be in the 'dist/' directory
```

### Preview Production Build

```bash
# Preview the production build locally
npm run preview

# Open http://localhost:4173
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Docker Deployment

```bash
# Build Docker image
docker build -t library-analytics:latest .

# Run container
docker run -p 3000:5173 library-analytics:latest
```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: Port 5173 is already in use

**Solution:**

```bash
# Use a different port
npm run dev -- --port 3001
```

#### Issue: Module not found error

**Solution:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: TypeScript errors

**Solution:**

```bash
# Run type checking
npm run type-check

# Clear TypeScript cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install
```

#### Issue: Tailwind CSS styles not working

**Solution:**

1. Verify `tailwind.config.js` content paths are correct
2. Check that `@tailwind` directives are in `App.css`
3. Restart dev server: `npm run dev`

#### Issue: Environment variables not loading

**Solution:**

```bash
# Restart dev server to load .env changes
npm run dev
```

### Getting Help

- **Documentation**: Check `/docs` directory
- **GitHub Issues**: Report bugs on GitHub
- **Email**: support@libraryanalytics.example.com
- **Discord**: Join community server (link)

---

## Next Steps

After successful installation:

1. **Configure API**: Set up backend API endpoints in `.env`
2. **Setup MCP Server**: Configure MCP server integration
3. **Create Database**: Set up database if using backend
4. **Start Development**: Begin building features
5. **Run Tests**: Write and run tests

---

## Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Node.js Documentation](https://nodejs.org/en/docs/)

---

**Last Updated**: May 2025
