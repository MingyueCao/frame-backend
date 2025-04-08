import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
  console.log("✅ Adobe Add-On SDK is ready");

  const loginBtn = document.getElementById("frameioLoginBtn");
  const container = document.getElementById("assetsContainer");

  loginBtn.disabled = false;

  loginBtn.addEventListener("click", () => {
    const width = 600, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open('/auth/frameio', 'frameioLogin', `width=${width},height=${height},left=${left},top=${top}`);
  });

  // ✅ Unified message handler
  window.addEventListener("message", async (event) => {
    if (event.data === "frameio-auth-success") {
      loginBtn.textContent = "✅ Connected to Frame.io";
      loginBtn.disabled = true;
      console.log("🎉 Logged into Frame.io");

      try {
        const res = await fetch('/api/assets');
        const assets = await res.json();

        container.innerHTML = "";

        if (!assets.length) {
          container.textContent = "No assets found.";
          return;
        }

        assets.forEach(asset => {
          const item = document.createElement("div");
          item.textContent = asset.name || "(Unnamed asset)";
          container.appendChild(item);
        });

      } catch (err) {
        console.error("❌ Failed to fetch Frame.io assets:", err);
        container.textContent = "Error fetching assets.";
      }
    }
  });
});
