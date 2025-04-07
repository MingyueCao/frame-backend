import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
  console.log("✅ Adobe Add-On SDK is ready");

  const loginBtn = document.getElementById("frameioLoginBtn");

  // Enable the login button once the SDK is ready
  loginBtn.disabled = false;

  // Handle click to open OAuth popup
  loginBtn.addEventListener("click", () => {
    const width = 600, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open('/auth/frameio', 'frameioLogin', `width=${width},height=${height},left=${left},top=${top}`);
  });

  // Listen for postMessage from popup when login is complete
  window.addEventListener("message", (event) => {
    if (event.data === "frameio-auth-success") {
      loginBtn.textContent = "✅ Connected to Frame.io";
      loginBtn.disabled = true;
      console.log("🎉 Logged into Frame.io");
    }
  });
});

window.addEventListener("message", async (event) => {
    if (event.data === "frameio-auth-success") {
      loginBtn.textContent = "✅ Connected to Frame.io";
      loginBtn.disabled = true;
      console.log("🎉 Logged into Frame.io");
  
      const res = await fetch('/api/assets');
      const assets = await res.json();
      
      const container = document.getElementById("assetsContainer");
      container.innerHTML = "";
  
      assets.forEach(asset => {
        const item = document.createElement("div");
        item.textContent = asset.name || "(Unnamed asset)";
        container.appendChild(item);
      });
    }
  });
  
