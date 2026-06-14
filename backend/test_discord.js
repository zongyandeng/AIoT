/**
 * 測試 Discord Webhook 警報發送
 */
const fs = require('fs');
const path = require('path');

// 載入 .env 變數
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
    console.log("[System] .env 設定檔載入成功");
  }
} catch (e) {
  console.error("無法載入 .env 檔:", e.message);
}

const { sendAlert } = require('./notifier');

async function main() {
  console.log("正在讀取測試圖片 (bus.jpg)...");
  const imgPath = path.join(__dirname, '../bus.jpg');
  if (!fs.existsSync(imgPath)) {
    console.error(`找不到測試圖片：${imgPath}`);
    return;
  }
  const imgBuffer = fs.readFileSync(imgPath);

  console.log("開始發送 Discord 測試警報...");
  // 為了測試，我們會清除可能存在的冷卻時間，但 notifier 內部是 Map, 這次直接發送 'no-helmet'
  await sendAlert('no-helmet', 0.9487, imgBuffer);
  
  console.log("Discord 測試腳本執行完畢，請到 Discord 頻道確認是否有收到包含 '未配戴安全帽'、'95%' 置信度及公車圖片的警報訊息。");
}

main().catch(err => {
  console.error("測試執行失敗:", err);
});
