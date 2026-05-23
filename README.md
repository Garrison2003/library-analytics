# Library Analytics

A comprehensive TypeScript/React application for analyzing and visualizing library circulation data with AI-powered insights through MCP server integration.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)

---

## 📊 Overview

**Library Analytics** is a modern web application designed to help librarians and administrators track, analyze, and understand circulation patterns across different library categories (Juvenile Fiction, Young Adult, etc.).

### Key Capabilities

- **Real-time Circulation Tracking** - View circulation trends over 12-month periods
- **Visual Analytics** - Interactive line graphs showing circulation patterns
- **Data Management** - Upload and manage library data files
- **AI-Powered Insights** - Ask questions about your data using an MCP-powered AI assistant
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

---

## ✨ Features

### 1. **Homepage Dashboard**
- Welcome section with key metrics
- Quick access to main features (Monthly View, Daily View, Upload)
- At-a-Glance circulation trends for categories
- Line graphs showing 12-month trends

### 2. **Monthly Analytics View**
- Detailed breakdown of monthly circulation data
- Trend analysis and comparisons
- Category-specific metrics

### 3. **Daily Analytics View**
- Daily circulation tracking
- Real-time data updates
- Performance metrics

### 4. **File Upload**
- Drag-and-drop file upload interface
- CSV/Excel data import
- Data validation and error handling

### 5. **AI-Powered Questions**
- Natural language query support
- MCP server integration for intelligent responses
- Example questions and suggestions
- Response caching and history

---

## 🛠 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript 5.2+** - Type-safe JavaScript
- **Tailwind CSS 3.3+** - Utility-first styling
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Recharts** - Data visualization library

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Backend language
- **MCP (Model Context Protocol)** - AI integration

### Design & Prototyping
- **Figma** - UI/UX design and prototyping
- **Design System** - Reusable components and styles

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- npm 7.0.0 or higher
- TypeScript 5.2.2 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/library-analytics.git
cd library-analytics

# Install dependencies
npm install

# Install Tailwind CSS and Lucide React
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react

# Configure Tailwind CSS
npx tailwindcss init -p
```

### Development

```bash
# Start development server
npm run dev

# The application will be available at http://localhost:5173
```

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
library-analytics/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── QuickAccess.tsx
│   │   ├── CirculationTrends.tsx
│   │   ├── Questions.tsx
│   │   └── Footer.tsx
│   ├── pages/
│   │   ├── Homepage.tsx
│   │   ├── MonthlyAnalytics.tsx
│   │   ├── DailyAnalytics.tsx
│   │   └── Upload.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── mcpClient.ts
│   │   └── dataService.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── analytics.ts
│   │   └── api.ts
│   ├── hooks/
│   │   ├── useCirculationData.ts
│   │   ├── useMCPServer.ts
│   │   └── useFileUpload.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── public/
│   └── (static assets)
├── design-system/
│   └── (Figma exports and design tokens)
├── docs/
│   ├── SETUP.md
│   ├── API_DOCUMENTATION.md
│   ├── COMPONENT_DOCUMENTATION.md
│   └── MCP_INTEGRATION.md
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[SETUP.md](./docs/SETUP.md)** - Detailed setup and installation guide
- **[API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)** - API endpoints and MCP integration
- **[COMPONENT_DOCUMENTATION.md](./docs/COMPONENT_DOCUMENTATION.md)** - React component API reference
- **[MCP_INTEGRATION.md](./docs/MCP_INTEGRATION.md)** - MCP server setup and configuration

---

## 💻 Development

### Code Style

This project follows TypeScript and React best practices:

- **Strict TypeScript** - All files use `strict: true`
- **ESLint** - Code quality linting
- **Prettier** - Code formatting
- **Component-based** - Modular, reusable components
- **Hooks-based** - Modern React patterns

### Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run type-check      # Run TypeScript type checking

# Linting & Formatting
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run lint:fix        # Fix linting issues

# Testing
npm run test            # Run unit tests
npm test:watch          # Watch mode
npm run test:coverage   # Coverage report
```

### Git Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat: add your feature"

# Push to remote
git push origin feature/your-feature-name

# Create a Pull Request
```

---

## 🚀 Deployment

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://api.yourdomain.com
VITE_MCP_SERVER_URL=https://mcp.yourdomain.com
VITE_APP_NAME=Library Analytics
VITE_APP_VERSION=1.0.0
```

### Production Build

```bash
# Build the application
npm run build

# The build output will be in the `dist/` directory

# Deploy to your hosting platform
# (Vercel, Netlify, AWS, etc.)
```

### Docker Deployment

```bash
# Build Docker image
docker build -t library-analytics:latest .

# Run container
docker run -p 3000:5173 library-analytics:latest
```

---

## 📖 Key Concepts

### Data Model

The application works with circulation data structured as:

```typescript
interface CirculationData {
  category: string;
  month: string;
  year: number;
  circulation: number;
}
```

### MCP Server Integration

The application communicates with an MCP server for AI-powered question answering:

```typescript
interface Question {
  query: string;
  category?: string;
  timeRange?: {
    startMonth: string;
    endMonth: string;
  };
}

interface Answer {
  response: string;
  confidence: number;
  sources?: string[];
}
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

For major changes, please open an issue first to discuss proposed changes.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

For questions, issues, or suggestions:

- **Issues** - GitHub Issues
- **Discussions** - GitHub Discussions
- **Email** - support@libraryanalytics.example.com
- **Documentation** - See `/docs` directory

---

## 🔄 Changelog

### Version 1.0.0 (Current)
- Initial release
- Homepage with circulation trends
- Monthly and Daily analytics views
- File upload functionality
- MCP server integration for AI questions

---

## 🗺️ Roadmap

### Q2 2025
- [ ] Real-time data updates
- [ ] Advanced filtering options
- [ ] Custom report generation
- [ ] User authentication

### Q3 2025
- [ ] Mobile app (React Native)
- [ ] Advanced analytics (forecasting, anomaly detection)
- [ ] Data export functionality
- [ ] Scheduling and alerts

### Q4 2025
- [ ] Multi-library support
- [ ] Comparative analysis
- [ ] API for third-party integrations
- [ ] Performance optimizations

---

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [MCP Protocol](https://modelcontextprotocol.io)

---

## ✅ Status

🟢 **Active Development** - New features and improvements are regularly added.

---

*Last Updated: May 2025*
