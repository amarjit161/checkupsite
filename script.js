/**
 * CheckUpSite Dashboard - Frontend Logic
 * Monitors website status and manages UI updates
 */

// Use local backend in dev, production URL otherwise
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://checkupsite.onrender.com';

// Elements
const checkNowBtn = document.getElementById('checkBtn');
const errorMessage = document.getElementById('errorMessage');
const sitesList = document.getElementById('sitesList');
const lastUpdatedEl = document.getElementById('lastUpdated');
const statUp = document.getElementById('upCount');
const statDown = document.getElementById('downCount');
const statTotal = document.getElementById('totalSites');
const statUptimeEl = document.getElementById('uptime');

let isChecking = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('CheckUpSite Dashboard Loaded');
    
    // Load saved data from localStorage
    const savedData = loadFromLocalStorage();
    if (savedData) {
        updateDashboard(savedData);
    } else {
        sitesList.innerHTML = '<div class="loading-message">No data yet. Click "Check Now" to start monitoring.</div>';
    }
    
    // Check if backend is running
    pingBackend();
});

// Event listeners
checkNowBtn.addEventListener('click', checkSites);

// Keyboard shortcut: Press 'R' to check now
document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'r' && !isChecking) {
        checkSites();
    }
});

/**
 * Ping the backend to check if it's running
 * Includes retry logic for cold-start detection (Render FREE tier)
 * @param {number} retryCount - Current retry attempt
 * @param {number} maxRetries - Maximum retry attempts
 */
async function pingBackend(retryCount = 0, maxRetries = 3) {
  const RETRY_DELAY = 2000; // 2 seconds between retries
  const TIMEOUT = 10000; // 10 second timeout per attempt
  
  try {
    // Use /health endpoint (lightweight, fast response)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✓ Backend is running');
      clearError(); // Clear any previous errors
      return;
    }
  } catch (error) {
    // Cold start detected or timeout
    if (retryCount < maxRetries) {
      console.warn(`⚠️ Backend warming up... (attempt ${retryCount + 1}/${maxRetries})`);
      showError(`⏳ Backend is warming up (cold start). Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`);
      
      // Wait and retry
      setTimeout(() => pingBackend(retryCount + 1, maxRetries), RETRY_DELAY);
      return;
    } else {
      // All retries exhausted
      console.warn('Backend not responding after retries:', error.message);
      showError('⚠️ Backend not responding. It may be overloaded. Try clicking "Check Now" manually.');
    }
  }
}

/**
 * Fetch site status from backend
 * Includes timeout handling for cold-start scenarios
 */
async function checkSites() {
    if (isChecking) return;
    
    isChecking = true;
    checkNowBtn.disabled = true;
    checkNowBtn.innerHTML = '<span class="btn-spinner">🔄</span> Checking...';
    clearError();
    
    try {
        // Add timeout for backend request (handle Render cold starts)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for full check
        
        const response = await fetch(`${API_BASE_URL}/api/check`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.sites || data.sites.length === 0) {
            showError('No sites configured on backend');
            return;
        }
        
        // Save to localStorage
        saveToLocalStorage(data);
        
        // Update UI
        updateDashboard(data);
        
        console.log('✓ Sites checked successfully', data);
        
    } catch (error) {
        console.error('Error checking sites:', error);
        
        // Better error handling for timeout vs other errors
        if (error.name === 'AbortError') {
            showError(`Request timeout (2 minutes). Backend may be experiencing issues. Please try again.`);
        } else {
            showError(`Error: ${error.message}. Make sure the backend is running at ${API_BASE_URL}`);
        }
    } finally {
        isChecking = false;
        checkNowBtn.disabled = false;
        checkNowBtn.innerHTML = '🔄 Check Now';
    }
}

/**
 * Update dashboard with site data
 */
function updateDashboard(data) {
    if (!data || !data.sites) {
        console.error('Invalid data structure:', data);
        return;
    }
    
    // Calculate statistics
    const sites = data.sites;
    const upCount = sites.filter(s => s.status === 'UP').length;
    const downCount = sites.filter(s => s.status === 'DOWN').length;
    const uptime = sites.length > 0 ? Math.round((upCount / sites.length) * 100) : 0;
    
    // Update stats cards
    statTotal.textContent = sites.length;
    statUp.textContent = upCount;
    statDown.textContent = downCount;
    statUptimeEl.textContent = `${uptime}%`;
    
    // Update last checked time (use data.timestamp from API response)
    const lastCheckedTime = formatTime(data.timestamp);
    lastUpdatedEl.textContent = `Last checked: ${lastCheckedTime}`;
    
    // Render site cards
    sitesList.innerHTML = '';
    sites.forEach(site => {
        sitesList.appendChild(createSiteCard(site));
    });
}

/**
 * Create a site card element
 */
function createSiteCard(site) {
    const card = document.createElement('div');
    card.className = 'site-card';
    
    // Status styling
    const isUp = site.status === 'UP';
    const statusClass = isUp ? 'status-up' : 'status-down';
    const statusText = isUp ? '✓ UP' : '✗ DOWN';
    
    // Build details HTML
    let detailsHTML = `<div class="detail-item">⏱️ ${site.responseTime || 'N/A'}ms</div>`;
    
    if (site.statusCode) {
        detailsHTML += `<div class="detail-item">📊 ${site.statusCode}</div>`;
    }
    
    if (site.checkedAt) {
        const checkedTime = new Date(site.checkedAt);
        const timeAgo = getTimeAgo(checkedTime);
        detailsHTML += `<div class="detail-item">🕐 ${timeAgo}</div>`;
    }
    
    if (site.error) {
        detailsHTML += `<div class="detail-item">❌ ${site.error}</div>`;
    }
    
    card.innerHTML = `
        <div class="site-info">
            <div class="site-name">${site.name}</div>
            <div class="site-url"><a href="${site.url}" target="_blank" style="color: var(--color-primary); text-decoration: none;">${site.url}</a></div>
            <div class="site-details">
                ${detailsHTML}
            </div>
        </div>
        <div class="site-status ${statusClass}">
            <span class="status-indicator"></span>
            ${statusText}
        </div>
    `;
    
    return card;
}

/**
 * Format timestamp to local date/time string safely
 */
function formatTime(dateString) {
    if (!dateString) return 'Never';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString();
}

/**
 * Calculate time ago from timestamp
 */
function getTimeAgo(date) {
    const now = new Date();
    const secondsAgo = Math.floor((now - date) / 1000);
    
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return `${Math.floor(secondsAgo / 86400)}d ago`;
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

/**
 * Clear error message
 */
function clearError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}

/**
 * Save data to localStorage
 */
function saveToLocalStorage(data) {
    try {
        localStorage.setItem('checkupsite_data', JSON.stringify(data));
        localStorage.setItem('checkupsite_timestamp', new Date().toISOString());
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
    }
}

/**
 * Load data from localStorage
 */
function loadFromLocalStorage() {
    try {
        const data = localStorage.getItem('checkupsite_data');
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('Could not load from localStorage:', error);
    }
    return null;
}

/**
 * OPTIONAL: Auto-refresh every 5 minutes
 * Uncomment to enable automatic refreshing
 */
// setInterval(checkSites, 5 * 60 * 1000);

console.log('🚀 CheckUpSite Dashboard initialized');
console.log('💡 Press R key to refresh, or click "Check Now" button');
console.log('Backend API:', API_BASE_URL);
