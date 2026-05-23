// docs/COMPONENT_DOCUMENTATION.md

# Component Documentation

## Library Analytics - React Component Reference

Complete documentation for all React components in the application.

---

## Table of Contents

1. [Layout Components](#layout-components)
2. [Page Components](#page-components)
3. [Feature Components](#feature-components)
4. [Props & Interfaces](#props--interfaces)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)

---

## Layout Components

### Header Component

**File:** `src/components/Header.tsx`

**Description:** Main navigation header with logo and branding.

**Props:**

```typescript
interface HeaderProps {
  onLogoClick: () => void; // Callback when logo is clicked
}
```

**Usage:**

```tsx
<Header onLogoClick={() => navigate("/")} />
```

**Features:**

- Responsive design (mobile hamburger menu ready)
- Logo with app name and tagline
- Navigation links
- Hover effects and transitions

---

### Footer Component

**File:** `src/components/Footer.tsx`

**Description:** Application footer with copyright and links.

**Props:** None

**Usage:**

```tsx
<Footer />
```

**Features:**

- Copyright information with current year
- Footer navigation links
- Version information
- Responsive grid layout

---

## Page Components

### Homepage Component

**File:** `src/pages/Homepage.tsx`

**Description:** Main landing page displaying dashboard and quick navigation.

**Props:**

```typescript
interface HomepageProps {
  onMonthlyClick: () => void; // Navigate to monthly analytics
  onDailyClick: () => void; // Navigate to daily analytics
  onUploadClick: () => void; // Navigate to upload page
}
```

**Sections:**

1. **Hero Section** - Welcome message and description
2. **Quick Access** - Navigation cards to main features
3. **Circulation Trends** - Line graphs for categories
4. **Questions Section** - MCP-integrated question input

**Usage:**

```tsx
<Homepage
  onMonthlyClick={handleMonthly}
  onDailyClick={handleDaily}
  onUploadClick={handleUpload}
/>
```

---

### MonthlyAnalytics Component

**File:** `src/pages/MonthlyAnalytics.tsx`

**Description:** Detailed monthly circulation analysis page.

**Props:**

```typescript
interface MonthlyAnalyticsProps {
  onBackHome: () => void; // Navigate back to home
}
```

**Features:**

- Monthly data overview
- Category breakdown
- Comparison to previous month
- Trend visualization

---

### DailyAnalytics Component

**File:** `src/pages/DailyAnalytics.tsx`

**Description:** Daily circulation tracking and real-time data page.

**Props:**

```typescript
interface DailyAnalyticsProps {
  onBackHome: () => void; // Navigate back to home
}
```

**Features:**

- Daily metrics
- Peak hours visualization
- User activity tracking
- Real-time updates

---

### Upload Component

**File:** `src/pages/Upload.tsx`

**Description:** File upload interface for importing circulation data.

**Props:**

```typescript
interface UploadProps {
  onBackHome: () => void; // Navigate back to home
}
```

**Features:**

- Drag and drop file upload
- File format validation
- Upload progress indication
- Error handling

---

## Feature Components

### CirculationTrends Component

**File:** `src/components/CirculationTrends.tsx`

**Description:** Displays circulation trends using line graphs with SVG.

**Props:** None (internal component)

**Data Points:**

- Juvenile Fiction: 12 months of data
- Young Adult: 12 months of data
- X-Axis: Month and year labels
- Y-Axis: Circulation numbers

**Features:**

- Responsive SVG charts
- Interactive data points
- Grid lines for readability
- Color-coded categories

**Usage:**

```tsx
<CirculationTrends />
```

---

### QuickAccessCard Component

**File:** `src/components/QuickAccessCard.tsx`

**Description:** Clickable navigation card for quick access to features.

**Props:**

```typescript
interface QuickAccessCardProps {
  icon: React.ReactNode; // Icon element
  title: string; // Card title
  description: string; // Card description
  color: "blue" | "green" | "orange"; // Accent color
  onClick: () => void; // Click handler
}
```

**Available Colors:**

- `blue` - Blue accent and hover effect
- `green` - Green accent and hover effect
- `orange` - Orange accent and hover effect

**Usage:**

```tsx
<QuickAccessCard
  icon={<Calendar className="w-8 h-8" />}
  title="Monthly View"
  description="Analyze trends and patterns over months"
  color="blue"
  onClick={() => setCurrentPage("monthly")}
/>
```

---

### QuestionsSection Component

**File:** `src/components/QuestionsSection.tsx`

**Description:** Input area for questions to be sent to MCP server.

**Props:**

```typescript
interface QuestionsProps {
  onSubmit: (question: string) => Promise<void>; // Submit handler
  isLoading?: boolean; // Loading state
}
```

**Features:**

- Text area with character limit
- Submit and clear buttons
- Suggested questions
- Loading state with spinner
- Error messages
- Form validation

**Usage:**

```tsx
<QuestionsSection
  onSubmit={async (q) => {
    const answer = await askQuestion(q);
    displayAnswer(answer);
  }}
  isLoading={isLoading}
/>
```

---

## Props & Interfaces

### CirculationDataPoint

```typescript
interface CirculationDataPoint {
  category: string;
  month: string; // Format: "May 2025"
  year: number;
  circulation: number;
  trend?: "up" | "down" | "stable";
}
```

### LineGraphProps

```typescript
interface LineGraphProps {
  title: string;
  data: CirculationDataPoint[];
  lineColor: string;
  backgroundColor?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  width?: number;
  onDataPointClick?: (data: CirculationDataPoint) => void;
}
```

### StatCardProps

```typescript
interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: number;
}
```

---

## Usage Examples

### Example 1: Basic Homepage Setup

```tsx
import React, { useState } from "react";
import Homepage from "./pages/Homepage";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  return (
    <div>
      <Homepage
        onMonthlyClick={() => setCurrentPage("monthly")}
        onDailyClick={() => setCurrentPage("daily")}
        onUploadClick={() => setCurrentPage("upload")}
      />
    </div>
  );
}

export default App;
```

### Example 2: Questions with MCP Integration

```tsx
import { QuestionsSection } from "./components/QuestionsSection";
import { apiClient } from "./services/api";

function MyPage() {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);

  const handleQuestion = async (question: string) => {
    setLoading(true);
    try {
      const response = await apiClient.askQuestion(question);
      setAnswer(response.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <QuestionsSection onSubmit={handleQuestion} isLoading={loading} />
      {answer && <div>{answer.response}</div>}
    </>
  );
}
```

### Example 3: Custom Card Grid

```tsx
import QuickAccessCard from "./components/QuickAccessCard";
import { Calendar, BarChart3, Upload } from "lucide-react";

function CardGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <QuickAccessCard
        icon={<Calendar className="w-8 h-8" />}
        title="Monthly View"
        description="Analyze trends and patterns"
        color="blue"
        onClick={() => console.log("Monthly")}
      />
      <QuickAccessCard
        icon={<BarChart3 className="w-8 h-8" />}
        title="Daily View"
        description="Track daily metrics"
        color="green"
        onClick={() => console.log("Daily")}
      />
      <QuickAccessCard
        icon={<Upload className="w-8 h-8" />}
        title="Upload File"
        description="Import your data"
        color="orange"
        onClick={() => console.log("Upload")}
      />
    </div>
  );
}
```

---

## Best Practices

### 1. Component Organization

- Keep components focused and single-responsibility
- Use TypeScript interfaces for props
- Document component purpose and usage

### 2. State Management

```tsx
// ✅ Good: Clear state management
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
const [data, setData] = useState<DataType | null>(null);

// ❌ Avoid: Too many useState calls
const [loading, setLoading] = useState(false);
const [loading2, setLoading2] = useState(false);
```

### 3. Props & TypeScript

```tsx
// ✅ Good: Properly typed props
interface MyComponentProps {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
}

const MyComponent: React.FC<MyComponentProps> = ({ ... }) => {
  // Component code
};

// ❌ Avoid: Untyped props
const MyComponent = (props) => {
  // Can't tell what props are expected
};
```

### 4. Error Handling

```tsx
// ✅ Good: Comprehensive error handling
try {
  const result = await fetchData();
  setData(result);
} catch (error) {
  setError(error instanceof Error ? error : new Error("Unknown error"));
  console.error("Fetch failed:", error);
}

// ❌ Avoid: Silent failures
const result = await fetchData();
setData(result);
```

### 5. Performance Optimization

```tsx
// ✅ Good: Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return processData(data);
}, [data]);

// ✅ Good: Use useCallback for handlers
const handleClick = useCallback(() => {
  onSubmit(value);
}, [value, onSubmit]);

// ❌ Avoid: Recreating functions on every render
const handleClick = () => onSubmit(value);
```

### 6. Accessibility

```tsx
// ✅ Good: Proper ARIA labels and semantic HTML
<button
  aria-label="Submit form"
  onClick={handleSubmit}
>
  Submit
</button>

// ❌ Avoid: Non-semantic elements for buttons
<div onClick={handleSubmit}>Submit</div>
```

### 7. Styling

```tsx
// ✅ Good: Use Tailwind classes consistently
className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

// ❌ Avoid: Mixing inline styles and classes
style={{ color: 'white' }} className="bg-blue-600"
```

---

## Component Testing

### Example Unit Test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickAccessCard from "./QuickAccessCard";
import { Calendar } from "lucide-react";

describe("QuickAccessCard", () => {
  it("should render with provided title", () => {
    render(
      <QuickAccessCard
        icon={<Calendar />}
        title="Test Card"
        description="Test Description"
        color="blue"
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("should call onClick when clicked", async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(
      <QuickAccessCard
        icon={<Calendar />}
        title="Test Card"
        description="Test Description"
        color="blue"
        onClick={handleClick}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## Troubleshooting

### Issue: Component not rendering

**Solution:** Check that props are properly typed and passed correctly.

### Issue: Styling not applied

**Solution:** Verify Tailwind CSS is configured and import statements are correct.

### Issue: Event handlers not firing

**Solution:** Ensure handlers are properly bound and not missing in dependencies.

---

**Last Updated**: May 2025
