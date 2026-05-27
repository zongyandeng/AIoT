/**
 * AIoT 即時防護系統 - 即時通報模組 (Discord Webhook & LINE Notify 雙管道併行)
 * 支援透過 Node.js 原生 fetch/FormData 傳送含圖片附件的警報訊息，並內建冷卻防洗版機制。
 */

const fs = require('fs');
const path = require('path');

// 載入環境變數 (在 index.js 載入後，此處可直接存取 process.env)
const getEnv = (key, defaultVal) => process.env[key] || defaultVal;

// 違規行為冷卻計時器 (避免在短時間內重複洗版通知，預設冷卻時間 10 秒)
const cooldownMap = new Map();
const COOLDOWN_TIME = parseInt(getEnv('NOTIFICATION_COOLDOWN', '10000'), 10);

// 中文類別字典
const translateDict = {
  'no-helmet': '❌ 未配戴安全帽',
  'no-vest': '❌ 未穿著反光背心',
  'violation': '⚠️ 安全違規行為'
};

/**
 * 傳送即時警報通知
 * @param {string} className 違規類別 (如 'no-helmet', 'no-vest')
 * @param {number} confidence 置信度 (0.0 ~ 1.0)
 * @param {Buffer} imageBuffer 違規畫面的圖片 Buffer
 */
async function sendAlert(className, confidence, imageBuffer) {
  const now = Date.now();
  
  // 檢查是否處於冷卻時間內
  if (cooldownMap.has(className)) {
    const lastSentTime = cooldownMap.get(className);
    if (now - lastSentTime < COOLDOWN_TIME) {
      console.log(`[Notifier] 偵測到違規: ${className}，但目前處於冷卻時間內，跳過發送。`);
      return;
    }
  }

  // 更新冷卻時間
  cooldownMap.set(className, now);

  const chineseName = translateDict[className] || className;
  const timeStr = new Date().toLocaleString('zh-TW', { hour12: false });
  const confPercent = (confidence * 100).toFixed(0);

  console.log(`[Notifier] 觸發警報通報: ${chineseName} (Acc: ${confPercent}%)`);

  // 1. Discord Webhook 傳送
  if (getEnv('ENABLE_DISCORD', 'false') === 'true') {
    const discordUrl = getEnv('DISCORD_WEBHOOK_URL', '');
    if (discordUrl) {
      sendToDiscord(discordUrl, chineseName, confPercent, timeStr, imageBuffer).catch(err => {
        console.error('[Notifier] Discord 傳送失敗:', err.message);
      });
    } else {
      console.warn('[Notifier] Discord 啟用但未設定 DISCORD_WEBHOOK_URL');
    }
  }

  // 2. LINE Notify 傳送
  if (getEnv('ENABLE_LINE', 'false') === 'true') {
    const lineToken = getEnv('LINE_NOTIFY_TOKEN', '');
    if (lineToken) {
      sendToLine(lineToken, chineseName, confPercent, timeStr, imageBuffer).catch(err => {
        console.error('[Notifier] LINE Notify 傳送失敗:', err.message);
      });
    } else {
      console.warn('[Notifier] LINE Notify 啟用但未設定 LINE_NOTIFY_TOKEN');
    }
  }
}

/**
 * 傳送 Rich Card Embed 訊息至 Discord Webhook
 */
async function sendToDiscord(url, alertName, confidence, timeStr, imageBuffer) {
  // 構造 Rich Embed 資料結構
  const payload = {
    embeds: [
      {
        title: '🚨 AIoT 智慧工地 - 現場安全違規通報',
        color: 16728919, // 亮紅色 (#ff4757)
        fields: [
          { name: '⚠️ 違規項目', value: `**${alertName}**`, inline: true },
          { name: '🎯 辨識置信度', value: `${confidence}%`, inline: true },
          { name: '⏰ 偵測時間', value: timeStr, inline: false }
        ],
        image: {
          url: 'attachment://snapshot.jpg'
        },
        footer: {
          text: 'AIoT 即時影像監控系統 • 自動警報'
        }
      }
    ]
  };

  const formData = new FormData();
  formData.append('payload_json', JSON.stringify(payload));

  if (imageBuffer) {
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('files[0]', blob, 'snapshot.jpg');
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord 回傳錯誤 (${response.status}): ${text}`);
  }
  console.log('[Notifier] Discord 警報發送成功！');
}

/**
 * 傳送 LINE Notify 訊息（文字 + 圖片檔案）
 */
async function sendToLine(token, alertName, confidence, timeStr, imageBuffer) {
  const message = `\n🚨 [AIoT 安全违规通报]\n■ 違規項目: ${alertName}\n■ 辨識置信度: ${confidence}%\n■ 偵測時間: ${timeStr}`;

  const formData = new FormData();
  formData.append('message', message);

  if (imageBuffer) {
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('imageFile', blob, 'snapshot.jpg');
  }

  const response = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE Notify 回傳錯誤 (${response.status}): ${text}`);
  }
  console.log('[Notifier] LINE Notify 警報發送成功！');
}

module.exports = {
  sendAlert
};
