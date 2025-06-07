#!/bin/bash

# Script to deploy the phishing detection API and update the Chrome extension

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Phishing Detection Extension Deployment Script${NC}\n"

echo -e "${GREEN}Step 1: Ensure everything is committed to git${NC}"
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}Initializing git repository...${NC}"
  git init
  git add .
  git commit -m "Initial commit"
else
  git add .
  git commit -m "Deployment update"
fi

echo -e "\n${GREEN}Step 2: Deploy backend to Render${NC}"
echo -e "${YELLOW}To deploy the backend, you need to:${NC}"
echo -e "1. Create an account at render.com if you don't have one"
echo -e "2. Create a new Web Service"
echo -e "3. Connect your GitHub repository"
echo -e "4. Configure as follows:\n   - Environment: Python"
echo -e "   - Build Command: pip install -r requirements.txt"
echo -e "   - Start Command: gunicorn wsgi:app"
echo -e "   - Plan: Free"

echo -e "\nOnce deployed, Render will provide you with a URL like: https://your-app-name.onrender.com"

read -p "Enter the deployed API URL (or press enter to skip for now): " API_URL

if [ -n "$API_URL" ]; then
  echo -e "\n${GREEN}Step 3: Updating Chrome extension with new API URL${NC}"
  
  # Update background.js with the new API URL
  sed -i "s|const API_URL = \"http://localhost:5000\"|const API_URL = \"$API_URL\"|g" extension/background.js
  
  echo -e "${GREEN}✓ Updated extension/background.js with API URL: $API_URL${NC}"
  
  echo -e "\n${GREEN}Step 4: Preparing Chrome extension for deployment${NC}"
  
  # Update host_permissions in manifest.json to include the new API URL
  HOST_PERM_LINE=$(grep -n "host_permissions" extension/manifest.json | cut -d ':' -f 1)
  HOST_PERM_END=$((HOST_PERM_LINE + 3))
  
  # Check if the API URL is already in host_permissions
  if ! grep -q "$API_URL" extension/manifest.json; then
    # Insert the new API URL into host_permissions
    sed -i "${HOST_PERM_LINE}a\    \"$API_URL/*\"," extension/manifest.json
    echo -e "${GREEN}✓ Added $API_URL to host_permissions in manifest.json${NC}"
  else
    echo -e "${YELLOW}✓ $API_URL already in host_permissions in manifest.json${NC}"
  fi
  
  echo -e "\n${YELLOW}Chrome extension updated with new API URL${NC}"
  echo -e "To package the extension for deployment:"
  echo -e "1. Open Chrome and go to chrome://extensions/"
  echo -e "2. Enable 'Developer mode'"
  echo -e "3. Click 'Pack extension' and select the 'extension' directory"
  echo -e "4. This will create a .crx file for distribution"
  
  # Create a zip file of the extension for easy distribution
  echo -e "\n${GREEN}Creating zip file of the extension...${NC}"
  cd extension && zip -r ../phishing-detection-extension.zip * && cd ..
  echo -e "${GREEN}✓ Created phishing-detection-extension.zip${NC}"
else
  echo -e "\n${YELLOW}Skipping extension update. You'll need to manually update the API_URL in extension/background.js later.${NC}"
fi

echo -e "\n${GREEN}Deployment preparation complete!${NC}"
echo -e "${YELLOW}Follow these final steps:${NC}"
echo -e "1. If you haven't deployed to Render yet, follow the instructions in Step 2"
echo -e "2. Once your API is deployed, update the API_URL in extension/background.js if you skipped that step"
echo -e "3. Load the extension in Chrome via 'Load unpacked' or package it as described above"
echo -e "\n${GREEN}Good luck with your phishing detection extension!${NC}"

