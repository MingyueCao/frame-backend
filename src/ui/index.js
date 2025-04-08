import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
  console.log("✅ SDK ready");

  const button = document.getElementById("frameioLoginBtn");
  const authStatus = document.getElementById("authStatus");
  const assetsContainer = document.getElementById("assetsContainer");

  button.disabled = false;

  button.addEventListener("click", () => {
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
    if (event.data?.type === "frameio-auth-success") {
      const token = event.data.token;
      console.log("✅ Logged in with token:", token);

      button.textContent = "✅ Connected to Frame.io";
      button.disabled = true;
      if (authStatus) authStatus.textContent = "✅ Logged into Frame.io";

      try {
        const res = await fetch("https://frame-backend-0m58.onrender.com/api/assets", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const assets = await res.json();
        console.log("📦 Frame.io assets:", assets);

        assetsContainer.innerHTML = "";

        if (assets.length === 0) {
          assetsContainer.textContent = "No assets found.";
        } else {
          assets.forEach((item) => {
            const div = document.createElement("div");
            div.textContent = `📁 ${item.name}`;
            assetsContainer.appendChild(div);
          });
        }
      } catch (err) {
        console.error("❌ Failed to load assets:", err);
        assetsContainer.textContent = "❌ Error fetching assets.";
      }
    }
  });
});
