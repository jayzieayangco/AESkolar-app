# AESkolar - Automated Essay Scoring System

A modern web application for automated essay scoring, built with React, Vite, and Supabase.

## Deployment to GitHub Pages

### Prerequisites
1. Make sure you have a GitHub account
2. Create a new repository on GitHub (or use an existing one)
3. Initialize Git in your project (if not already done)

### Step 1: Configure Vite Base URL
In `vite.config.js`, update the `base` property to match your repository name:
```javascript
base: process.env.NODE_ENV === 'production' ? '/YOUR-REPO-NAME/' : '/',
```
Replace `YOUR-REPO-NAME` with your actual GitHub repository name.

### Step 2: Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to GitHub Pages
Run the deployment script:
```bash
npm run deploy
```

### Step 4: Configure GitHub Pages
1. Go to your GitHub repository
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment" → "Branch", select `gh-pages`
4. Click **Save**

Your app will be available at: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

### Important Notes
- **Supabase Configuration**: Make sure to add your GitHub Pages URL to your Supabase project's "Site URL" and "Redirect URLs" in the Supabase Dashboard → Authentication → URL Configuration
- **AI Engine**: The AI engine backend (Flask server) is not included in the GitHub Pages deployment. Only the client-side heuristic grader will work
- **Environment Variables**: Don't commit your `.env` file! You'll need to configure your Supabase credentials in your deployment environment or use a service like Vercel, Netlify, or Render for full functionality

---

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
