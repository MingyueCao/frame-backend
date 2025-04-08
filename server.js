const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const { fetch } = require('undici');
require('dotenv').config();

const app = express();

app.use(cors()); // ✅ Allow CORS from all origins for testing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
}));

// 🔍 Serve manifest.json FIRST — with error logging
app.get('/manifest.json', (req, res) => {
  const filePath = path.join(__dirname, 'dist/manifest.json');
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
  const state = Math.random().toString(36).substring(2);
  req.session.oauthState = state;

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
      res.send(`<script>
        window.opener.postMessage(${JSON.stringify({
          type: 'frameio-auth-success',
          token: token.access_token
        })}, '*');
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

// ✅ Support alternate callback path
app.get('/oauth/callback', (req, res) => {
  req.url = '/auth/callback';
  app._router.handle(req, res);
});

// 📦 API: List Frame.io assets using token passed in headers
app.get('/api/assets', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return res.status(401).send("Missing access token");

  try {
    const response = await fetch(`https://api.frame.io/v2/projects/${process.env.FRAMEIO_PROJECT_ID}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const assets = await response.json();
    res.json(assets);
  } catch (err) {
    console.error('❌ Error fetching assets:', err);
    res.status(500).send("Failed to fetch assets");
  }
});

// 🚀 Start server
app.listen(5241, () => {
  console.log('✅ Add-on panel running at http://localhost:5241');
});
