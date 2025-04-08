import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

async function generatePKCE() {
  const codeVerifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b => b.toString(36))
    .join('')
    .slice(0, 128);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge: base64Digest };
}

addOnUISdk.ready.then(() => {
  console.log("✅ Adobe Add-On SDK is ready");

  const loginBtn = document.getElementById("frameioLoginBtn");
  const authStatus = document.getElementById("authStatus");
  const container = document.getElementById("assetsContainer");

  loginBtn.disabled = false;

  // 🔐 Initiate PKCE login
  loginBtn.addEventListener("click", async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    sessionStorage.setItem("frameio_code_verifier", codeVerifier);

    const authUrl = `https://frame-backend-0m58.onrender.com/auth/frameio?code_challenge=${codeChallenge}`;

    // ⚠️ FULL-PAGE REDIRECT
    window.location.href = authUrl;
  });

  // ✅ Handle success message from redirect or popup
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
        console.log("📦 Frame.io assets:", assets);

        container.innerHTML = "";
        if (!assets.length) {
          container.textContent = "No assets found in your project.";
          return;
        }

        assets.forEach((item) => {
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
