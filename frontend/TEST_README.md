# Frontend Testing Guide

This project uses **Vitest** and **React Testing Library** for unit testing React components.

## Setup

Tests are already configured. To get started:

```bash
cd frontend
npm install
```

## Running Tests

### Run all tests in watch mode:

```bash
npm test
```

### Run tests with UI dashboard:

```bash
npm run test:ui
```

### Generate coverage report:

```bash
npm run test:coverage
```

## Test Coverage

- **App.tsx** — Tests authentication flow, conditional rendering (loading, error, authenticated states)
- **Login.tsx** — Tests render, button clicks, loginWithRedirect call
- **UserProfile.tsx** — Tests user display, logout functionality, profile picture handling
- **AccessDenied.tsx** — Tests error page rendering, links, and messages

## Key Testing Patterns

### Mocking Auth0

```typescript
vi.mock("@auth0/auth0-react");

beforeEach(() => {
  (useAuth0 as any).mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    user: mockUser,
  });
});
```

### Testing User Interactions

```typescript
const user = userEvent.setup();
await user.click(button);
```

### Checking Rendered Content

```typescript
expect(screen.getByText("Expected text")).toBeInTheDocument();
expect(
  screen.getByRole("button", { name: /Button Label/i }),
).toBeInTheDocument();
```

## Files

- `vitest.config.ts` — Vitest configuration
- `src/test/setup.ts` — Test environment setup
- `src/**/*.test.tsx` — Test files for each component

## Notes

- Tests use jsdom environment for DOM simulation
- All tests automatically clean up after running
- Mock `@auth0/auth0-react` to avoid auth0 provider initialization in tests
- Use `vi.fn()` to create mock functions and verify calls
