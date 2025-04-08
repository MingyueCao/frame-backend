const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const { fetch } = require('undici');
require('dotenv').config();

const app = express();

// 🕵️ Log incoming origin
app.use((req, res, next) => {
  console.log('🌍 Origin:', req.headers.origin);
  next();
});

// 🔓 Enable CORS for Adobe Express
const allowedOrigins = [
  'https://new.express.adobe.com',
  'https://your-addon-id.wxp.adobe-addons.com' // Replace this!
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`❌ Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
}));

// 🧠 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: 'none',
    secure: true
  }
}));

// 📦 Serve manifest.json
app.get('/manifest.json', (req, res) => {
  const filePath = path.join(__dirname, 'dist/manifest.json');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Manifest error:', err);
      res.status(err.statusCode || 500).end();
    }
  });
});

// 🌐 Static frontend
app.use(express.static(path.join(__dirname, 'dist')));

// 🔐 OAuth login redirect
app.get('/auth/frameio', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  req.session.oauthState = state;

  const authUrl = `https://applications.frame.io/oauth2/auth` +
    `?response_type=code` +
    `&client_id=${process.env.FRAMEIO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.FRAMEIO_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent('asset.read asset.create asset.delete reviewlink.create offline')}` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// 🔐 OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauthState) return res.status(400).send('CSRF detected.');

  try {
    const basicAuth = Buffer.from(
      `${process.env.FRAMEIO_CLIENT_ID}:${process.env.FRAMEIO_CLIENT_SECRET}`
    ).toString('base64');

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
      // Redirect to frontend with success marker
      res.redirect('/?auth=success');
    } else {
      console.error('❌ Token exchange failed:', token);
      res.redirect('/?auth=error');
    }
  } catch (err) {
    console.error('❌ Callback error:', err);
    res.redirect('/?auth=error');
  }
});

// 📦 Get assets
app.get('/api/assets', async (req, res) => {
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
  console.log('✅ Backend live at http://localhost:5241');
});
