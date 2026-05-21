# Okta Setup for GitHub Deployment

This guide explains how to configure Okta credentials in GitHub for automated deployments.

## Step 1: Create Okta Applications

### Development Environment

1. Log in to your Okta developer account
2. Create a new application for development:
   - **Name:** Library Analytics Dev
   - **Application type:** OIDC - Single-Page Application
   - **Sign-in redirect URI:** `https://library-analytics-dev.com/login/callback`
   - **Sign-out redirect URI:** `https://library-analytics-dev.com`
3. Note the **Client ID** and **Okta Domain**

### Production Environment

1. Create another application for production:
   - **Name:** Library Analytics Prod
   - **Application type:** OIDC - Single-Page Application
   - **Sign-in redirect URI:** `https://library-analytics.com/login/callback`
   - **Sign-out redirect URI:** `https://library-analytics.com`
2. Note the **Client ID** and **Okta Domain**

## Step 2: Calculate Issuer URLs

For each environment:

- If using default authorization server: `https://<YOUR_OKTA_DOMAIN>/oauth2/default`
- If using custom server: `https://<YOUR_OKTA_DOMAIN>/oauth2/<SERVER_ID>`

Example:

- Dev Issuer: `https://dev-12345.okta.com/oauth2/default`
- Prod Issuer: `https://prod-67890.okta.com/oauth2/default`

## Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

### Development Secrets

- **Name:** `OKTA_ISSUER_DEV`
  - **Value:** `https://dev-12345.okta.com/oauth2/default`

- **Name:** `OKTA_CLIENT_ID_DEV`
  - **Value:** Your dev Client ID

### Production Secrets

- **Name:** `OKTA_ISSUER_PROD`
  - **Value:** `https://prod-12345.okta.com/oauth2/default`

- **Name:** `OKTA_CLIENT_ID_PROD`
  - **Value:** Your prod Client ID

## Step 4: Verify Deployment

1. Push code to `dev` branch
2. GitHub Actions will automatically:
   - Build the React app with dev Okta credentials
   - Deploy to dev S3 bucket
   - Update CloudFront distribution
3. Check GitHub Actions logs for any errors

## Testing

### Local Testing

```bash
# Set environment variables
export REACT_APP_OKTA_ISSUER=https://dev-12345.okta.com/oauth2/default
export REACT_APP_OKTA_CLIENT_ID=your_client_id

# Run dev server
npm run dev
```

### Production Testing

Before deploying to production:

1. Test the login flow in dev environment
2. Verify all Okta redirect URIs match
3. Confirm user assignments in Okta
4. Test logout functionality

## Troubleshooting

### "Invalid Client ID" Error

- Verify secret names match exactly
- Check Client ID is correct in Okta console
- Ensure no extra spaces or quotes in secret value

### "Redirect URI Mismatch" Error

- Verify production domain has SSL certificate
- Add exact redirect URIs in Okta app settings
- Check for trailing slashes (must match exactly)

### Build Succeeds but Login Fails

- Verify Okta credentials are being passed to build
- Check browser console for specific error messages
- Ensure Okta domain is accessible from user location

## Updating Credentials

If you need to update Okta credentials:

1. Rotate the application credentials in Okta console
2. Update the corresponding GitHub secret
3. Re-run the deployment workflow

## Environment Variables in Workflow

The `.github/workflows/config.yaml` uses:

- `OKTA_ISSUER_DEV` / `OKTA_ISSUER_PROD`
- `OKTA_CLIENT_ID_DEV` / `OKTA_CLIENT_ID_PROD`

These are automatically used during the build process:

```bash
REACT_APP_OKTA_ISSUER=${{ env.OKTA_ISSUER }} \
REACT_APP_OKTA_CLIENT_ID=${{ env.OKTA_CLIENT_ID }} \
npm run build
```

## Security Best Practices

✅ **Use separate Okta apps for dev and prod**  
✅ **Rotate credentials periodically**  
✅ **Use GitHub environment secrets** (optional, for additional protection)  
✅ **Restrict Okta app access by IP** (enterprise feature)  
✅ **Monitor Okta login attempts** in audit logs  
✅ **Keep Client IDs confidential** (though they're semi-public)

## Next Steps

1. Create Okta applications for dev and prod
2. Calculate issuer URLs
3. Add GitHub secrets
4. Push code and verify deployment
5. Test login in deployed environments
