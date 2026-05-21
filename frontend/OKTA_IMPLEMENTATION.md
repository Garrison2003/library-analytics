# Auth0 Authentication Implementation

## Summary of Changes

The frontend has been updated to use **Auth0** for secure, scalable authentication suitable for external-facing applications.

## What Was Updated

### Installed Packages

- `@auth0/auth0-react@2.x` - Auth0 React SDK v2

### Code Changes

**App.tsx**

- Wrapped with `Auth0Provider`
- Uses Auth0's `useAuth0()` hook for authentication state
- Automatically handles token management
- Redirects to login if not authenticated

**Login.tsx**

- Uses `loginWithRedirect()` for secure authentication flow
- Displays Auth0 branding
- No local token storage (handled by Auth0)

**UserProfile.tsx**

- Uses `useAuth0()` hook for user data and logout
- Integrated logout with Auth0's secure `logout()` method
- Displays user info from Auth0 token

**Environment Files**

- Updated `.env.example` and `.env.local` for Auth0 configuration
- Requires `REACT_APP_AUTH0_DOMAIN`, `REACT_APP_AUTH0_CLIENT_ID`, `REACT_APP_AUTH0_AUDIENCE`

### GitHub Actions Workflow

- Updated to pass Auth0 credentials from GitHub secrets
- Credentials injected during build for environment-specific config

### Documentation

- **OAUTH_SETUP.md** - Complete Auth0 setup guide
- **AUTH0_GITHUB_SETUP.md** - GitHub secrets configuration

## Quick Start

### 1. Get Auth0 Credentials

1. Visit https://auth0.com (create free account if needed)
2. Go to Auth0 Dashboard
3. Create new Single Page Application
4. Add callback URLs:
   - `http://localhost:5173`
   - `https://library-analytics-dev.com`
   - `https://library-analytics.com`
5. Copy **Domain** and **Client ID**

### 2. Configure Environment

Update `.env.local`:

```env
REACT_APP_AUTH0_DOMAIN=your-domain.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=YOUR_CLIENT_ID_HERE
REACT_APP_AUTH0_AUDIENCE=https://library-analytics-api.com
```

### 3. Run Locally

```bash
cd frontend
npm install
npm run dev
```

### 4. Test Login

- Navigate to `http://localhost:5173`
- Click "Sign in with Auth0"
- Sign up or log in with email/password or social login
- You should see the dashboard

## Features

✅ Universal login page  
✅ Built-in social login  
✅ Multi-factor authentication  
✅ User management dashboard  
✅ Custom branding options  
✅ Rules and hooks for extensibility  
✅ Organizations support (enterprise)  
✅ Passwordless authentication

## Environment-Specific Setup

### Development

- Auth0 app with localhost callbacks
- Email/password connection only
- No MFA required

### Production

- Separate Auth0 app for production domain
- Enable MFA
- Configure custom domain (optional)
- Add social login connections
- Enable anomaly detection

## GitHub Secrets Required

Add these to GitHub repository secrets:

**Development**

- `AUTH0_DOMAIN_DEV` - Dev Auth0 domain
- `AUTH0_CLIENT_ID_DEV` - Dev Client ID
- `AUTH0_AUDIENCE_DEV` - Dev audience (optional)

**Production**

- `AUTH0_DOMAIN_PROD` - Production Auth0 domain
- `AUTH0_CLIENT_ID_PROD` - Production Client ID
- `AUTH0_AUDIENCE_PROD` - Production audience (optional)

## Deployment Flow

1. Code push to `dev` or `main` branch
2. GitHub Actions retrieves Auth0 credentials
3. React app built with Auth0 config
4. Frontend deployed to S3
5. CloudFront distribution updated
6. Users can login with Auth0

## Differences from Previous Setup

### Google OAuth

- ❌ Limited social providers
- ❌ Consumer-focused
- ❌ Manual token management

### Okta

- ✅ Enterprise-focused
- ✅ OIDC standard
- ❌ More complex setup

### Auth0

- ✅ Modern, clean API
- ✅ Excellent React integration
- ✅ Built-in social login
- ✅ Free tier generous
- ✅ Perfect for external-facing apps
- ✅ Dashboard for user management

## Troubleshooting

**Blank login page**

- Check browser console for errors
- Verify Auth0 domain and Client ID in `.env.local`
- Check Auth0 dashboard for configuration

**"Redirect URI mismatch"**

- Add exact URL to Auth0 app settings
- Must include callback path
- HTTPS required in production

**Users can't sign up**

- Check Auth0 app connections
- Enable "Allow Signups" in connection settings
- Verify email verification if required

## API Integration (Optional)

To add backend API protection:

1. Create API in Auth0 Dashboard
2. Define API Identifier: `https://library-analytics-api.com`
3. Add permissions/scopes for your API
4. Backend validates tokens from frontend

## Next Steps

1. Set up Auth0 tenant and application
2. Configure GitHub secrets
3. Update `.env.local` for local development
4. Test login flow locally
5. Deploy to dev environment
6. Test in production environment

## File Reference

- `src/App.tsx` - Main app with Auth0Provider
- `src/components/Login.tsx` - Auth0 login button
- `src/components/UserProfile.tsx` - User info and logout
- `.env.local` - Auth0 configuration
- `OAUTH_SETUP.md` - Detailed Auth0 setup guide
- `AUTH0_GITHUB_SETUP.md` - GitHub deployment guide
