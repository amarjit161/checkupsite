# CheckUpSite - Website Monitoring Dashboard

A simple, free, and beginner-friendly website monitoring system. Check if your websites are UP or DOWN in real-time!

## 🎯 Features

✅ Monitor multiple websites in real-time  
✅ Simple, responsive dashboard  
✅ Show status UP (green) or DOWN (red)  
✅ Display response time and HTTP status codes  
✅ Last checked timestamp  
✅ Mobile-friendly design  
✅ Completely free to deploy and run  
✅ No database required (JSON file based)  

## 📁 Project Structure

```
checkupsite/
├── backend/
│   ├── server.js          # Express server with API
│   ├── package.json       # Node.js dependencies
│   └── sites.json         # List of websites to monitor
└── frontend/
    ├── index.html         # Dashboard UI
    ├── style.css          # Responsive styles
    └── script.js          # Dashboard logic
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js** (v14 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **Git** (optional, for version control)
- **Text Editor** (VS Code, Sublime Text, etc.)

### Backend Setup (Local)

1. **Navigate to backend folder:**
   ```bash
   cd checkupsite/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Add websites to monitor** (Edit `sites.json`):
   ```json
   {
     "sites": [
       {
         "name": "Amarjit Personal",
         "url": "https://amarjit.co.in"
       },
       {
         "name": "Wedding Website",
         "url": "https://wedding.amarjit.co.in"
       },
       {
         "name": "Passbolt",
         "url": "https://passbolt.amarjit.co.in"
       },
       {
         "name": "Another Site",
         "url": "https://example.com"
       }
     ]
   }
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

   You should see:
   ```
   ✓ CheckUpSite Backend running on http://localhost:5000
   ✓ API endpoint: http://localhost:5000/api/check
   ✓ Monitoring 3 websites
   ```

5. **Test the API:**
   - Open browser: http://localhost:5000/api/check
   - You should see JSON with website statuses

### Frontend Setup (Local)

1. **Open `frontend/index.html` in browser:**
   - Right-click `frontend/index.html` → Open with Browser
   - Or: Drag and drop the file into your browser
   - Or: Use VS Code Live Server extension

2. **Click "Check Now" button**
   - API connects to `http://localhost:5000`
   - Dashboard displays all websites with UP/DOWN status

## 📊 API Endpoint Reference

### GET `/api/check`
Returns status of all monitored websites.

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-21T10:30:45.123Z",
  "summary": {
    "total": 3,
    "up": 2,
    "down": 1,
    "uptime": "66.7%"
  },
  "sites": [
    {
      "name": "Amarjit Personal",
      "url": "https://amarjit.co.in",
      "status": "UP",
      "statusCode": 200,
      "responseTime": 245,
      "checkedAt": "2026-01-21T10:30:45.123Z",
      "error": null
    },
    {
      "name": "Down Site",
      "url": "https://offline.example.com",
      "status": "DOWN",
      "statusCode": null,
      "responseTime": 5000,
      "checkedAt": "2026-01-21T10:30:45.123Z",
      "error": "Request timeout (5 seconds)"
    }
  ]
}
```

### GET `/health`
Simple health check endpoint.

### GET `/`
Welcome message with available endpoints.

## 🌐 Deployment

### Option 1: Deploy Backend on Render (FREE)

Render provides free hosting with automatic deployments from GitHub.

#### Step 1: Create GitHub Repository

1. Create GitHub account (if you don't have one): [github.com/signup](https://github.com/signup)
2. Create new repository:
   - Go to [github.com/new](https://github.com/new)
   - Name: `checkupsite`
   - Description: "Website monitoring dashboard"
   - Make it **Public**
   - Click "Create repository"

3. Push your code to GitHub:
   ```bash
   cd checkupsite
   git init
   git add .
   git commit -m "Initial commit: CheckUpSite monitoring dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/checkupsite.git
   git push -u origin main
   ```

#### Step 2: Deploy Backend on Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "Create New +" → "Web Service"
4. Select your `checkupsite` repository
5. Fill in the form:
   - **Name:** `checkupsite-backend`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (this is okay!)

6. Click "Create Web Service"
7. Wait for deployment (1-2 minutes)
8. Copy your Render URL (looks like: `https://checkupsite-backend.onrender.com`)

#### Step 3: Update Frontend API URL

Edit `frontend/script.js` line 4:
```javascript
// Change this:
const API_BASE_URL = 'http://localhost:5000';

// To this:
const API_BASE_URL = 'https://checkupsite-backend.onrender.com';
```

Commit and push to GitHub:
```bash
git add frontend/script.js
git commit -m "Update API endpoint to Render deployment"
git push
```

### Option 2: Deploy Frontend on GitHub Pages (FREE)

GitHub Pages hosts your frontend absolutely free!

#### Step 1: Enable GitHub Pages

1. Go to your GitHub repository (checkupsite)
2. Click **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** `/frontend`
4. Click "Save"
5. Wait 1-2 minutes for deployment
6. Your site will be at: `https://YOUR_USERNAME.github.io/checkupsite`

#### Step 2: Full Deployment URL

Your complete monitoring dashboard is now live at:
```
https://YOUR_USERNAME.github.io/checkupsite
```

**Note:** Make sure `frontend/script.js` has the correct Render API URL before deploying!

### Option 3: Deploy Backend on Railway (Alternative)

Railway is another great free option.

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your checkupsite repository
5. Railway auto-detects Node.js and deploys automatically
6. Get your Railway URL and update `frontend/script.js`

## ✏️ Adding More Websites

Simply edit `backend/sites.json`:

```json
{
  "sites": [
    {
      "name": "My Blog",
      "url": "https://myblog.com"
    },
    {
      "name": "Company Site",
      "url": "https://company.com"
    },
    {
      "name": "AWS App",
      "url": "https://app.aws.example.com"
    }
  ]
}
```

Then commit and push:
```bash
git add backend/sites.json
git commit -m "Add new websites to monitor"
git push
```

Render auto-deploys when you push to GitHub!

## 🔧 Customization

### Change Check Timeout (Backend)

Edit `backend/server.js` line 68:
```javascript
// Default is 5000ms (5 seconds), change to:
async function checkSite(url, timeout = 10000) { // 10 seconds
```

### Enable Auto-Refresh (Frontend)

Edit `frontend/script.js` - uncomment line 127:
```javascript
// Check every 5 minutes
setInterval(checkSites, 300000);
```

### Modify Status Codes

Edit `backend/server.js` line 79 - change the range:
```javascript
// Current: 200-399 is UP
const status = statusCode >= 200 && statusCode < 400 ? 'UP' : 'DOWN';

// Example: Also accept 404 as UP
const status = (statusCode >= 200 && statusCode < 400) || statusCode === 404 ? 'UP' : 'DOWN';
```

## 🐛 Troubleshooting

### "Cannot connect to backend" error
- Make sure backend server is running: `npm start` in backend folder
- Check if API URL in `frontend/script.js` is correct
- For local: should be `http://localhost:5000`
- For deployed: should be your Render URL

### Backend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### CORS errors
- Backend has CORS enabled by default
- If issues persist, check `backend/server.js` line 16

### Websites show as DOWN
- Check if URL is correct in `sites.json`
- Try opening URL in browser manually
- Check internet connection
- Some sites may block automated requests

### Old data showing after refresh
- Clear browser cache: Ctrl+Shift+Delete (Windows)
- Or: Open Developer Tools → Storage → Clear All

## 📚 Code Documentation

### Backend Structure

**server.js:**
- Lines 1-9: Imports and setup
- Lines 11-24: Middleware configuration
- Lines 26-36: `loadSites()` function
- Lines 38-75: `checkSite()` function - core logic
- Lines 77-105: `/api/check` endpoint
- Lines 107-110: `/health` endpoint
- Lines 115-119: Error handling
- Lines 121-125: Server startup

**sites.json:**
- Simple JSON array of websites to monitor
- Easy to add/remove sites

### Frontend Structure

**index.html:**
- HTML structure with semantic tags
- Status indicators
- Summary statistics cards
- Control panel with "Check Now" button

**style.css:**
- Modern dark theme
- Responsive grid layout
- Smooth animations and transitions
- Mobile breakpoints at 768px and 480px

**script.js:**
- `checkSites()` - Fetches data from API
- `updateDashboard()` - Updates UI with data
- `createSiteCard()` - Generates site card HTML
- LocalStorage for persistent data
- Keyboard shortcut: Press 'R' to refresh

## 🔒 Security Notes

- Frontend is static - no sensitive data stored
- Backend uses CORS for controlled access
- No authentication needed for demo
- For production: Add API keys or authentication

## 📦 Dependencies

**Backend:**
- express (web framework)
- axios (HTTP requests)
- cors (cross-origin requests)

**Frontend:**
- Pure JavaScript (no frameworks needed)

## 🤝 Support

### Common Issues

**Q: Can I deploy without GitHub?**
A: Yes, use Git commands locally or upload files directly to Render/Railway.

**Q: Do I need a paid plan?**
A: No! Render and Railway have generous free tiers.

**Q: Can I monitor HTTPS sites?**
A: Yes! Dashboard works with any website.

**Q: How often should I check?**
A: Default is manual. Uncomment line 127 in `script.js` for auto-refresh.

## 📝 License

MIT License - Use freely for personal and commercial projects.

## 🎉 You're All Set!

Your website monitoring dashboard is ready to go!

1. ✅ Backend running on Render
2. ✅ Frontend deployed on GitHub Pages
3. ✅ Monitoring your websites 24/7
4. ✅ Completely free
5. ✅ Ready to scale

**Happy Monitoring!** 🚀
