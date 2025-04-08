import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

async function generatePKCE() {
  const codeVerifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b => b.toString(36)).join('').slice(0, 128);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return { codeVerifier, codeChallenge: base64Digest };
}

addOnUISdk.ready.then(async () => {
  console.log("✅ Adobe Add-On SDK is ready");

  const loginBtn = document.getElementById("frameioLoginBtn");
  const authStatus = document.getElementById("authStatus");
  const container = document.getElementById("assetsContainer");
  loginBtn.disabled = false;

  loginBtn.addEventListener("click", async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Store verifier in sessionStorage
    sessionStorage.setItem('frameio_code_verifier', codeVerifier);

    const width = 600, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authUrl = `https://applications.frame.io/oauth2/auth?` +
      `response_type=code&client_id=YOUR_CLIENT_ID` +
      `&redirect_uri=${encodeURIComponent('https://frame-backend-0m58.onrender.com/oauth/callback')}` +
      `&scope=${encodeURIComponent('asset.read asset.create asset.delete reviewlink.create offline')}` +
      `&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    window.open(authUrl, "frameioLogin", `width=${width},height=${height},left=${left},top=${top}`);
  });

  window.addEventListener("message", async (event) => {
    if (event.data === "frameio-auth-success") {
      loginBtn.textContent = "✅ Logged into Frame.io";
      loginBtn.disabled = true;
      if (authStatus) authStatus.textContent = "✅ Logged into Frame.io";

      try {
        const res = await fetch("https://frame-backend-0m58.onrender.com/api/assets", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const assets = await res.json();
        container.innerHTML = "";
        assets.forEach(item => {
          const div = document.createElement("div");
          div.textContent = `📁 ${item.name || "(Unnamed asset)"}`;
          container.appendChild(div);
        });
      } catch (err) {
        console.error("❌ Failed to load assets:", err);
        container.textContent = "❌ Failed to load assets.";
      }
    }
  });
});
