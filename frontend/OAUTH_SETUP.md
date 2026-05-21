# Frontend Auth0 Authentication Setup Guide

The frontend uses Auth0 for secure, scalable authentication suitable for external-facing applications.

## Prerequisites

1. Auth0 Account (free at https://auth0.com)
2. Admin access to your Auth0 tenant

## Setup Steps

### 1. Create an Auth0 Application

1. Log in to your [Auth0 Dashboard](https://manage.auth0.com/)
2. Go to **Applications** → **Applications**
3. Click **Create Application**
4. Name: **Library Analytics Frontend**
5. Choose **Single Page Application**
6. Select **React** as technology
7. Click **Create**

### 2. Configure Application Settings

In the **Settings** tab:

**Allowed Callback URLs:**

```
http://localhost:5173
http://localhost:5173/login/callback
https://library-analytics-dev.com
https://library-analytics-dev.com/login/callback
https://library-analytics.com
https://library-analytics.com/login/callback
```

**Allowed Logout URLs:**

```
http://localhost:5173
https://library-analytics-dev.com
https://library-analytics.com
```

**Allowed Web Origins:**

```
http://localhost:5173
https://library-analytics-dev.com
https://library-analytics.com
```

**Allowed Origins (CORS):**

```
http://localhost:5173
https://library-analytics-dev.com
https://library-analytics.com
```

Click **Save Changes**

### 3. Get Your Configuration Values

In the **Settings** tab, find:

- **Domain** (e.g., `dev-abc123.us.auth0.com`)
- **Client ID** (e.g., `abcdef123456`)

For the Audience (optional but recommended):

1. Go to **APIs** (in sidebar)
2. Click **Create API**
3. Name: **Library Analytics API**
4. Identifier: `https://library-analytics-api.com` (or your API domain)
5. Click **Create**

### 4. Configure Environment Variables

Update `.env.local`:

```env
REACT_APP_AUTH0_DOMAIN=dev-abc123.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your_client_id_here
REACT_APP_AUTH0_AUDIENCE=https://library-analytics-api.com
```

The audience is optional but recommended for API access.

### 5. Run the Application

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` and click "Sign in with Auth0"

## Features

- ✅ Universal login experience
- ✅ Multi-factor authentication (MFA)
- ✅ Social login integration
- ✅ Database connections
- ✅ Passwordless authentication
- ✅ User management
- ✅ Log tracking and analytics

## Environment-Specific Configuration

### Development (localhost:5173)

```env
REACT_APP_AUTH0_DOMAIN=dev-abc123.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=YOUR_DEV_CLIENT_ID
REACT_APP_AUTH0_AUDIENCE=https://dev-api.library-analytics.com
```

### Dev Environment (library-analytics-dev.com)

Create a separate Auth0 app or use the same app with additional URLs configured

### Production (library-analytics.com)

Create separate Auth0 app for production with production-only URLs

## User Management

### Creating Test Users

1. Go to **User Management** → **Users**
2. Click **Create user**
3. Email: (your test email)
4. Password: (generate a strong one)
5. Connection: Username-Password-Authentication (or your preferred)
6. Click **Create**

### Setting Up Social Connections

1. Go to **Connections** → **Social**
2. Click the social provider (Google, GitHub, Microsoft, etc.)
3. Follow setup instructions for each provider
4. Enable the connection in your application settings

### Configuring MFA

1. Go to **Security** → **Multi-factor Authentication**
2. Select factors to enable (Google Authenticator, SMS, etc.)
3. Set policy (optional, always required, etc.)

## Troubleshooting

**"Invalid Client ID" Error**

- Verify `REACT_APP_AUTH0_CLIENT_ID` matches exactly
- Check in Auth0 Dashboard Settings tab

**"Redirect URI mismatch" Error**

- Add exact URL to "Allowed Callback URLs" in settings
- Include trailing slash if your URL has one
- Must use https in production

**"Access Denied" Error**

- Check user has been created in Auth0
- Verify email is confirmed (if required)
- Check connection is enabled for the application

**Blank Login Page**

- Check browser console for errors
- Verify `REACT_APP_AUTH0_DOMAIN` and `REACT_APP_AUTH0_CLIENT_ID`
- Ensure domain is accessible (no firewall blocking)

## Security Best Practices

✅ Use separate Auth0 applications for dev/prod  
✅ Implement MFA for all users  
✅ Use strong password policies  
✅ Enable login anomaly detection  
✅ Monitor Auth0 audit logs  
✅ Rotate client secrets periodically  
✅ Use environment variables for sensitive data

## Advanced Features

### Rules and Hooks

Customize authentication and token behavior with Auth0 Rules

### Actions

Create flexible authentication flows with Actions

### Custom Domain

Configure a custom domain for better branding

### Organizations

Manage multiple customers/teams within one Auth0 tenant

## Resources

- [Auth0 React SDK Documentation](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 Dashboard](https://manage.auth0.com/)
- [Auth0 Support](https://support.auth0.com/)
- [Auth0 Community](https://community.auth0.com/)
