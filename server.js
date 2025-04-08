const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const { fetch } = require('undici');
require('dotenv').config();

const app = express();

// 🌍 Log origin for debugging
app.use((req, res, next) => {
  console.log('🌍 Origin:', req.headers.origin);
  next();
});

// 🔓 Enable dynamic CORS
const allowedOrigins = [
  'https://new.express.adobe.com',
  'https://your-addon-id.wxp.adobe-addons.com' // replace with your real ID if deployed
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

// 📦 Serve manifest.json first
app.get('/manifest.json', (req, res) => {
  const filePath = path.join(__dirname, 'dist/manifest.json');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Error sending manifest:', err);
      res.status(err.statusCode || 500).end();
    }
  });
});

// 🌐 Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// 🔐 Start PKCE login
app.get('/auth/frameio', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  const codeChallenge = req.query.code_challenge;

  if (!codeChallenge) return res.status(400).send('Missing code_challenge');

  req.session.oauthState = state;
  req.session.codeChallenge = codeChallenge;

  const authUrl = `https://applications.frame.io/oauth2/auth` +
    `?response_type=code` +
    `&client_id=${process.env.FRAMEIO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.FRAMEIO_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent('asset.read asset.create asset.delete reviewlink.create offline')}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  res.redirect(authUrl);
});

// 🔐 OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const codeVerifier = req.session.codeVerifier;

  if (state !== req.session.oauthState) {
    return res.status(400).send('CSRF detected.');
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', process.env.FRAMEIO_REDIRECT_URI);
    params.append('client_id', process.env.FRAMEIO_CLIENT_ID);
    params.append('code_verifier', req.session.codeVerifier);

    const tokenRes = await fetch('https://applications.frame.io/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const token = await tokenRes.json();

    if (token.access_token) {
      req.session.frameioToken = token;
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

// ✅ Fallback route for /oauth/callback
app.get('/oauth/callback', (req, res) => {
  req.url = '/auth/callback';
  app._router.handle(req, res);
});

// 📦 List Frame.io assets
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
  console.log('✅ Add-on panel running at http://localhost:5241');
});
