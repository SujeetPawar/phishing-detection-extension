# Deploy to Render - Simple Guide

## Method 1: Manual Deployment (Recommended)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Create Web Service on Render

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Use these settings:

**Basic Settings:**
- **Name**: `phishing-detection-api` (or your choice)
- **Region**: Oregon (or closest to you)
- **Branch**: `main`
- **Runtime**: `Python 3`

**Build & Deploy:**
- **Root Directory**: Leave empty (uses project root)
- **Build Command**: `cd api && pip install -r requirements.txt`
- **Start Command**: `cd api && gunicorn --bind 0.0.0.0:$PORT wsgi:app`

**Advanced:**
- **Port**: `8080` (Render will set this automatically)
- **Environment Variables**: None needed (Render sets PORT automatically)

### Step 3: Deploy

1. Click "Create Web Service"
2. Wait for deployment (usually 2-5 minutes)
3. Get your URL (will be something like `https://your-app-name.onrender.com`)

### Step 4: Test Your Deployment

```bash
# Test health check
curl -I https://your-app-name.onrender.com

# Test prediction
curl -X POST https://your-app-name.onrender.com/predict \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://google.com"]}'
```

### Step 5: Update Extension

```bash
# Configure extension for production
./configure-extension.sh production https://your-app-name.onrender.com

# Or manually edit extension/background.js
# Change: const API_URL = "http://localhost:5000";
# To:     const API_URL = "https://your-app-name.onrender.com";
```

### Step 6: Reload Extension in Chrome

1. Go to `chrome://extensions/`
2. Find your extension
3. Click the reload button 🔄
4. Test on a webpage!

---

## Method 2: Using render.yaml (Infrastructure as Code)

1. The `api/render.yaml` file is already configured
2. Push to GitHub
3. In Render dashboard, use "New +" → "From YAML"
4. Connect repository and deploy

---

## Troubleshooting

### Common Issues:

1. **Build fails**: Check that all dependencies are in `api/requirements.txt`
2. **Model not found**: Make sure `api/model.pkl` is in your repo (not in .gitignore)
3. **Import errors**: Ensure `ml_mode` folder is included in your repo
4. **Cold starts**: First request after inactivity may take 10-30 seconds

### Check Logs:
- In Render dashboard, go to your service → "Logs" tab
- Look for any Python import errors or missing files

### Extension Issues:
- Make sure to update the API URL in extension
- Reload the extension after URL change
- Check browser console for CORS or network errors

---

## Free Tier Limitations

- Service sleeps after 15 minutes of inactivity
- 750 hours per month (enough for development/testing)
- Cold start delay (10-30 seconds) when waking up
- For production, consider upgrading to a paid plan

---

## Next Steps After Deployment

1. **Test thoroughly** with your extension
2. **Monitor** the Render dashboard for any issues
3. **Consider custom domain** (paid feature)
4. **Set up monitoring** if this goes to production
5. **Optimize cold starts** by implementing health check endpoints

