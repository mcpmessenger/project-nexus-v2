# AWS Amplify Deployment Setup

## Quick Setup Steps

1. **Go to AWS Amplify Console**
   - Visit https://console.aws.amazon.com/amplify
   - Sign in to your AWS account

2. **Connect Repository**
   - Click "New app" → "Host web app"
   - Select "GitHub" and authorize AWS Amplify
   - Choose your repository: `mcpmessenger/project-nexus-v2`
   - Select branch: `main`

3. **Configure Build Settings**
   - Amplify will auto-detect Next.js
   - The `amplify.yml` file is already configured
   - Review and click "Save and deploy"

4. **Environment Variables** (if needed)
   - Add any required environment variables in Amplify console
   - Go to App settings → Environment variables

5. **Deploy**
   - Amplify will automatically build and deploy
   - You'll get a URL like: `https://main.xxxxx.amplifyapp.com`

## Build Configuration

The `amplify.yml` file is configured for:
- Node.js 18+ (Amplify default)
- npm install
- Next.js build
- Proper caching headers to prevent stale content

## Notes

- Amplify supports Next.js server-side rendering out of the box
- Automatic deployments on every push to `main`
- Free tier includes 1000 build minutes/month
