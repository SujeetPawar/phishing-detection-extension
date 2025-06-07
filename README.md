# Phishing Detection Extension

A Chrome extension that detects phishing websites using machine learning.

## Project Structure

- `/api`: Backend Flask API with ML model
- `/extension`: Chrome extension
- `/ml_mode`: Machine learning model code

## Local Development

### Running the Backend API

**Using Python directly:**

```bash
cd api
python app.py
```

**Using Gunicorn (for production-like environment):**

```bash
cd api
gunicorn --bind 0.0.0.0:5000 wsgi:app
```

### Loading the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the `extension` directory

## Deployment

### Deploying the Backend API

The API can be deployed to various platforms. We recommend using Render.com for simplicity:

1. Create an account on [Render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure as follows:
   - Environment: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn wsgi:app`
   - Plan: Free

### Updating the Chrome Extension

After deploying the backend API, you need to update the Chrome extension to use the new API URL:

1. Update `API_URL` in `extension/background.js`
2. Update `host_permissions` in `extension/manifest.json` to include the new API URL
3. Reload the extension in Chrome

### Automated Deployment

You can use the provided deployment script to automate these steps:

```bash
./deploy.sh
```

Follow the prompts to deploy your application.

## Publishing the Chrome Extension

To publish your extension to the Chrome Web Store:

1. Create a ZIP file of the extension directory
2. Sign up for a [Chrome Web Store Developer account](https://chrome.google.com/webstore/devconsole/)
3. Pay the one-time $5 registration fee
4. Create a new item and upload your ZIP file
5. Fill out the required information
6. Submit for review

## License

MIT
