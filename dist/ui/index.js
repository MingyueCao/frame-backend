import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
  console.log("✅ Adobe Add-On SDK is ready");

  const loginBtn = document.getElementById("frameioLoginBtn");

  loginBtn.disabled = false;

  loginBtn.addEventListener("click", () => {
    const width = 600, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      "https://frame-backend-0m58.onrender.com/auth/frameio",
      "frameioLogin",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  });

  window.addEventListener("message", async (event) => {
    if (event.data === "frameio-auth-success") {
      loginBtn.textContent = "✅ Logged into Frame.io";
      loginBtn.disabled = true;

      const authStatus = document.getElementById("authStatus");
      if (authStatus) authStatus.textContent = "✅ Logged into Frame.io";

      try {
        const res = await fetch("https://frame-backend-0m58.onrender.com/api/assets", {
          credentials: "include", // important for session-based auth!
        });

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const assets = await res.json();
        console.log("📦 Frame.io assets:", assets);

        const container = document.getElementById("assetsContainer");
        container.innerHTML = "";

        if (assets.length === 0) {
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
        const container = document.getElementById("assetsContainer");
        container.textContent = "❌ Failed to load assets";
      }
    }
  });
});
