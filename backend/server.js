/**
 * CheckUpSite Backend Server
 * Monitors website uptime and provides API endpoints
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cron = require('node-cron');
const dotenv = require('dotenv');

const app = express();
const PORT = process.env.PORT || 5000;

// Load environment variables from .env (if present)
dotenv.config();

// Telegram configuration (optional; alerts sent only when both are set)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

// HTTPS Agent with disabled certificate validation for self-signed certificates
// This is specifically for monitoring HTTPS sites and only applies to monitoring requests
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // Allow self-signed certificates
});

// HTTP Agent for consistency
const httpAgent = new http.Agent();

// Default headers to mimic a real browser (helps avoid some 403 blocks)
const DEFAULT_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

// ============================================================================
// AUTOMATIC MONITORING STATE TRACKER
// ============================================================================

/**
 * In-memory state tracking for each monitored site
 * Structure: { siteName: { lastStatus, lastCheckedAt, lastChangedAt, changeCount } }
 */
let monitoringState = {};

/**
 * Initialize monitoring state for all sites
 */
function initializeMonitoringState() {
  const sites = loadSites();
  sites.forEach(site => {
    if (!monitoringState[site.name]) {
      monitoringState[site.name] = {
        name: site.name,
        url: site.url,
        lastStatus: null,
        lastCheckedAt: null,
        lastChangedAt: null,
        changeCount: 0,
        lastStatusCode: null,
        lastError: null
      };
    }
  });
  console.log(`📊 Monitoring state initialized for ${sites.length} sites`);
}

/**
 * Get monitoring state for a specific site
 * @param {string} siteName - Name of the site
 * @returns {Object} Current monitoring state
 */
function getSiteState(siteName) {
  return monitoringState[siteName] || null;
}

/**
 * Update monitoring state and detect state changes
 * @param {string} siteName - Name of the site
 * @param {Object} checkResult - Result from checkSite()
 */
function updateMonitoringState(siteName, checkResult) {
  const currentState = monitoringState[siteName];
  if (!currentState) return;

  const previousStatus = currentState.lastStatus;
  const newStatus = checkResult.status;

  // Update state
  currentState.lastStatus = newStatus;
  currentState.lastCheckedAt = checkResult.checkedAt;
  currentState.lastStatusCode = checkResult.statusCode;
  currentState.lastError = checkResult.error;

  // Detect state change
  if (previousStatus !== null && previousStatus !== newStatus) {
    currentState.changeCount++;
    currentState.lastChangedAt = new Date().toISOString();
    
    // Log state change
    const changeType = newStatus === 'UP' ? '📈 UP' : '📉 DOWN';
    const emoji = newStatus === 'UP' ? '✅' : '⚠️';
    console.log(`${emoji} STATE CHANGE [${siteName}]: ${previousStatus} → ${newStatus} (Change #${currentState.changeCount})`);

    // Fire-and-forget Telegram alert (does not block monitoring)
    sendTelegramAlert({
      siteName,
      url: currentState.url,
      newStatus,
      previousStatus,
      statusCode: checkResult.statusCode,
      responseTime: checkResult.responseTime,
      error: checkResult.error,
      checkedAt: checkResult.checkedAt
    });
    
    return {
      siteChanged: true,
      siteName: siteName,
      previousStatus: previousStatus,
      newStatus: newStatus,
      changedAt: currentState.lastChangedAt,
      changeCount: currentState.changeCount
    };
  }

  return null;
}

/**
 * Send Telegram alert for state changes (non-blocking)
 * Alerts are skipped if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing
 */
async function sendTelegramAlert({ siteName, url, newStatus, previousStatus, statusCode, responseTime, error, checkedAt }) {
  if (!TELEGRAM_ENABLED) {
    return; // Alerts disabled when env vars are not set
  }

  const emoji = newStatus === 'UP' ? '✅' : '🚨';
  const header = `${emoji} Site status change`;
  const lines = [
    header,
    `Site: ${siteName}`,
    `URL: ${url}`,
    `Status: ${newStatus} (was ${previousStatus ?? 'unknown'})`,
    `HTTP: ${statusCode ?? 'N/A'}`,
    `Response: ${typeof responseTime === 'number' ? `${responseTime}ms` : 'N/A'}`,
    `Checked: ${checkedAt || new Date().toISOString()}`
  ];

  if (error) {
    lines.push(`Error: ${error}`);
  }

  const text = lines.join('\n');

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    }, {
      timeout: 5000
    });
  } catch (alertError) {
    console.error('⚠️ Telegram alert failed:', alertError.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Load sites from sites.json file
 * @returns {Array} Array of site objects with name and url
 */
function loadSites() {
  try {
    const sitesPath = path.join(__dirname, 'sites.json');
    const data = fs.readFileSync(sitesPath, 'utf-8');
    const parsedData = JSON.parse(data);
    return parsedData.sites || [];
  } catch (error) {
    console.error('Error loading sites.json:', error.message);
    return [];
  }
}

/**
 * Check the status of a single website
 * @param {string} url - The website URL to check
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Object with status, statusCode, and responseTime
 */
async function checkSite(url, timeout = 5000) {
  const startTime = Date.now();
  try {
    const response = await axios.get(url, {
      timeout: timeout,
      // Follow redirects
      maxRedirects: 5,
      // Don't reject on any status code
      validateStatus: () => true,
      // Use HTTPS agent that allows self-signed certificates
      httpsAgent: httpsAgent,
      // Also use for HTTP to keep consistency
      httpAgent: httpAgent,
      headers: DEFAULT_REQUEST_HEADERS
    });

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    // Status is UP if response code is between 200-399
    const status = statusCode >= 200 && statusCode < 400 ? 'UP' : 'DOWN';

    return {
      status: status,
      statusCode: statusCode,
      responseTime: responseTime,
      checkedAt: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorMessage = 'Unknown error';
    let errorType = 'Unknown';

    // Distinguish between different error types
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout (5 seconds)';
      errorType = 'Timeout';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Domain not found';
      errorType = 'DNS Error';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
      errorType = 'Connection Error';
    } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || error.code === 'CERT_HAS_EXPIRED' || error.message.includes('certificate')) {
      errorMessage = 'SSL certificate issue (but connection was made)';
      errorType = 'SSL Warning';
      // Note: If we got here, it means the TLS error was not caught by httpsAgent
      // This is still DOWN because we couldn't verify the connection
    } else if (error.message.includes('getaddrinfo')) {
      errorMessage = 'Network error';
      errorType = 'Network Error';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      status: 'DOWN',
      statusCode: null,
      responseTime: responseTime,
      checkedAt: new Date().toISOString(),
      error: errorMessage,
      errorType: errorType
    };
  }
}

/**
 * Automatic background monitoring function
 * Runs every 5 minutes to check all sites and detect state changes
 * Reuses the existing checkSite() logic
 */
async function performAutomaticMonitoring() {
  const sites = loadSites();
  console.log(`\n🔄 [${new Date().toISOString()}] Starting automatic monitoring cycle...`);

  const stateChanges = [];

  // Check all sites in parallel
  const checkPromises = sites.map(site =>
    checkSite(site.url)
      .then(result => {
        // Update monitoring state and detect changes
        const change = updateMonitoringState(site.name, result);
        if (change) {
          stateChanges.push(change);
        }
        return {
          name: site.name,
          url: site.url,
          ...result
        };
      })
      .catch(error => {
        console.error(`❌ Error checking ${site.name}:`, error.message);
        return {
          name: site.name,
          url: site.url,
          status: 'DOWN',
          error: error.message,
          checkedAt: new Date().toISOString()
        };
      })
  );

  const results = await Promise.all(checkPromises);

  // Calculate summary
  const upCount = results.filter(r => r.status === 'UP').length;
  const downCount = results.filter(r => r.status === 'DOWN').length;

  // Log summary
  console.log(`✓ Monitoring cycle complete: ${upCount}/${results.length} sites UP, ${downCount}/${results.length} sites DOWN`);

  // Log any state changes
  if (stateChanges.length > 0) {
    console.log(`\n🔔 STATE CHANGES DETECTED (${stateChanges.length}):`);
    stateChanges.forEach(change => {
      console.log(`   • ${change.siteName}: ${change.previousStatus} → ${change.newStatus}`);
    });
  }

  return {
    timestamp: new Date().toISOString(),
    monitoringCycle: true,
    results: results,
    stateChanges: stateChanges,
    summary: {
      total: results.length,
      up: upCount,
      down: downCount
    }
  };
}

/**
 * API Endpoint: GET /api/check
 * Checks all configured websites and returns their status
 */
app.get('/api/check', async (req, res) => {
  try {
    const sites = loadSites();

    if (sites.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No sites configured in sites.json',
        data: []
      });
    }

    // Check all sites in parallel
    const checkPromises = sites.map(site =>
      checkSite(site.url).then(result => ({
        name: site.name,
        url: site.url,
        ...result
      }))
    );

    const results = await Promise.all(checkPromises);

    // Calculate summary statistics
    const upCount = results.filter(r => r.status === 'UP').length;
    const downCount = results.filter(r => r.status === 'DOWN').length;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        up: upCount,
        down: downCount,
        uptime: `${((upCount / results.length) * 100).toFixed(1)}%`
      },
      sites: results
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking sites',
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Welcome message endpoint
 */
/**
 * Health Check Endpoint: GET /health
 * Lightweight endpoint for monitoring backend availability
 * Used by frontend to detect cold starts and by keep-alive services
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'CheckUpSite Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health - Health check (lightweight, use for keep-alive)',
      check: 'GET /api/check - Check all configured websites (manual)',
      status: 'GET /api/status - Get last known status of all sites',
      'site-status': 'GET /api/status/:siteName - Get last known status of specific site'
    }
  });
});

/**
 * API Endpoint: GET /api/status
 * Returns last known status of all monitored sites from background monitoring
 */
app.get('/api/status', (req, res) => {
  const statusData = Object.values(monitoringState).map(state => ({
    name: state.name,
    url: state.url,
    lastStatus: state.lastStatus,
    lastCheckedAt: state.lastCheckedAt,
    lastChangedAt: state.lastChangedAt,
    changeCount: state.changeCount,
    lastStatusCode: state.lastStatusCode,
    lastError: state.lastError
  }));

  const upCount = statusData.filter(s => s.lastStatus === 'UP').length;
  const downCount = statusData.filter(s => s.lastStatus === 'DOWN').length;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: 'automatic-monitoring',
    summary: {
      total: statusData.length,
      up: upCount,
      down: downCount,
      uptime: statusData.length > 0 ? `${((upCount / statusData.length) * 100).toFixed(1)}%` : 'N/A'
    },
    sites: statusData
  });
});

/**
 * API Endpoint: GET /api/status/:siteName
 * Returns detailed last known status of a specific site
 */
app.get('/api/status/:siteName', (req, res) => {
  const { siteName } = req.params;
  const state = getSiteState(siteName);

  if (!state) {
    return res.status(404).json({
      success: false,
      message: `Site "${siteName}" not found in monitoring`
    });
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    site: {
      name: state.name,
      url: state.url,
      lastStatus: state.lastStatus,
      lastCheckedAt: state.lastCheckedAt,
      lastChangedAt: state.lastChangedAt,
      changeCount: state.changeCount,
      lastStatusCode: state.lastStatusCode,
      lastError: state.lastError
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ============================================================================
// BACKGROUND MONITORING SETUP
// ============================================================================

/**
 * Schedule automatic monitoring every 5 minutes
  * Uses cron expression: every 5 minutes
 */
function setupAutomaticMonitoring() {
  console.log('⏰ Setting up automatic monitoring scheduler...');

  // Initialize state first
  initializeMonitoringState();

  // Run first check immediately on startup
  console.log('🚀 Running initial monitoring cycle...');
  performAutomaticMonitoring().catch(error => {
    console.error('❌ Initial monitoring error:', error.message);
  });

  // Schedule automatic checks every 5 minutes
  const monitoringCron = cron.schedule('*/5 * * * *', async () => {
    try {
      await performAutomaticMonitoring();
    } catch (error) {
      console.error('❌ Scheduled monitoring error:', error.message);
    }
  }, {
    scheduled: true
  });

  console.log('✓ Automatic monitoring scheduled: every 5 minutes');
  console.log('✓ Use /api/status endpoint to get last known status');
  console.log('✓ Use /api/check endpoint for manual checks');

  return monitoringCron;
}

// Start server
app.listen(PORT, () => {
  console.log(`✓ CheckUpSite Backend running on http://localhost:${PORT}`);
  console.log(`✓ API endpoint: http://localhost:${PORT}/api/check`);
  const sites = loadSites();
  console.log(`✓ Monitoring ${sites.length} websites`);
  console.log('');

  // Setup automatic background monitoring
  setupAutomaticMonitoring();
});
