const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const { fetch } = require('undici');
require('dotenv').config();

const app = express();

// 🔓 Enable CORS for Adobe Express origin
app.use(cors({
  origin: 'https://new.express.adobe.com',
  credentials: true,
}));

// 🧠 Basic Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: 'none',   // Required for iframes + third-party
    secure: true,       // Must be true when using sameSite: 'none'
    httpOnly: true
  }
}));

// 🔍 Serve manifest.json FIRST — with error logging
app.get('/manifest.json', (req, res) => {
  const filePath = path.join(__dirname, 'dist/manifest.json');
  console.log('📦 Trying to serve:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Error sending manifest:', err);
      res.status(err.statusCode || 500).end();
    }
  });
});

// 🌐 Serve other static frontend files (index.html, etc)
app.use(express.static(path.join(__dirname, 'dist')));

// 🔐 OAuth: Start login
app.get('/auth/frameio', (req, res) => {
  console.log('🔥 /auth/frameio hit');
  const state = Math.random().toString(36).substring(2);
  req.session.oauthState = state;

  console.log('🔐 Stored session state:', state);
  console.log('🧁 Session ID (login):', req.session.id);

  const authUrl = `https://applications.frame.io/oauth2/auth` +
    `?response_type=code&client_id=${process.env.FRAMEIO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.FRAMEIO_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent('asset.read asset.create asset.delete reviewlink.create offline')}` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// 🔐 OAuth: Callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  console.log('🧁 Session ID (callback):', req.session.id);
  console.log('🔁 Returned state:', state);
  console.log('📦 Session state:', req.session.oauthState);

  if (state !== req.session.oauthState) return res.status(400).send('CSRF detected.');

  try {
    const basicAuth = Buffer
      .from(`${process.env.FRAMEIO_CLIENT_ID}:${process.env.FRAMEIO_CLIENT_SECRET}`)
      .toString('base64');

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', process.env.FRAMEIO_REDIRECT_URI);

    const tokenRes = await fetch('https://applications.frame.io/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const token = await tokenRes.json();

    if (token.access_token) {
      req.session.frameioToken = token;
      console.log('✅ Token stored in session');
      res.send(`<script>
        window.opener?.postMessage('frameio-auth-success', '*');
        window.close();
      </script>`);
    } else {
      console.error('❌ Token exchange failed:', token);
      res.status(500).send('OAuth failed.');
    }
  } catch (err) {
    console.error('❌ Error during callback:', err);
    res.status(500).send('OAuth server error.');
  }
});

// ✅ SUPPORT alternate callback path from Frame.io
app.get('/oauth/callback', (req, res) => {
  req.url = '/auth/callback';
  app._router.handle(req, res);
});

// 📦 API: List Frame.io assets
app.get('/api/assets', async (req, res) => {
  console.log('📦 Session ID (api):', req.session.id);
  console.log('📦 Session token:', req.session.frameioToken);

  const token = req.session.frameioToken?.access_token;
  const projectId = process.env.FRAMEIO_PROJECT_ID;

  if (!token) return res.status(401).send('Not authenticated');

  try {
    const response = await fetch(`https://api.frame.io/v2/projects/${projectId}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const assets = await response.json();
    res.json(assets);
  } catch (err) {
    console.error('❌ Error fetching assets:', err);
    res.status(500).send('Failed to fetch assets');
  }
});

// 🚀 Start server
app.listen(5241, () => {
  console.log('✅ Add-on panel running at http://localhost:5241');
});
