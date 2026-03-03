console.log("🚀 Starting Discord login...");
client.login(BOT_TOKEN)
  .then(() => console.log("✅ Discord login() successful"))
  .catch((err) => console.error("❌ Discord login() failed:", err));