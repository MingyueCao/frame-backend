import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
  console.log("✅ SDK ready");

  const loginBtn = document.getElementById("frameioLoginBtn");
  const status = document.getElementById("authStatus");
  const container = document.getElementById("assetsContainer");

  loginBtn.disabled = false;

  loginBtn.addEventListener("click", () => {
    window.location.href = "https://frame-backend-0m58.onrender.com/auth/frameio";
  });

  // Check if auth was successful based on URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") === "success") {
    loginBtn.disabled = true;
    loginBtn.textContent = "✅ Logged into Frame.io";
    if (status) status.textContent = "✅ Logged into Frame.io";

    fetch("https://frame-backend-0m58.onrender.com/api/assets", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch assets");
        return res.json();
      })
      .then((assets) => {
        console.log("📦 Frame.io assets:", assets);
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
      })
      .catch((err) => {
        console.error("❌ Asset fetch failed:", err);
        container.textContent = "❌ Failed to load assets.";
      });
  }
});
