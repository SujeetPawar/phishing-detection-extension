#!/bin/bash

# Simple script to update extension API URL

if [ -z "$1" ]; then
    echo "❌ Please provide the Render URL"
    echo "Usage: $0 <render-url>"
    echo "Example: $0 https://your-app.onrender.com"
    exit 1
fi

RENDER_URL="$1"

echo "🔧 Updating extension to use: $RENDER_URL"

# Update background.js
sed -i "s|const API_URL = .*|const API_URL = \"$RENDER_URL\";|" extension/background.js

echo "✅ Updated extension/background.js"
echo "📍 API URL set to: $RENDER_URL"
echo ""
echo "🔄 Next steps:"
echo "1. Go to chrome://extensions/"
echo "2. Click reload on your extension"
echo "3. Test on a webpage!"

