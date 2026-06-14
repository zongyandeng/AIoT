/**
 * 測試後端 API 運作是否正常
 */
const fs = require('fs');
const path = require('path');

async function testSnapshotAPI() {
  console.log("開始測試 /api/snapshot API...");
  
  // 準備一筆 dummy base64 JPEG 資料
  const dummyBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  try {
    const response = await fetch('http://127.0.0.1:3001/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dummyBase64 })
    });
    
    const result = await response.json();
    console.log("API 回傳結果:", result);
    
    if (result.success) {
      console.log(`[成功] 截圖已儲存為 ${result.filename}`);
      const expectedPath = path.join(__dirname, '../image/Instant_screenshot', result.filename);
      if (fs.existsSync(expectedPath)) {
        console.log(`[成功] 確認實體檔案存在於: ${expectedPath}`);
        // 刪除測試產生的暫存檔以保持乾淨
        fs.unlinkSync(expectedPath);
        console.log(`[成功] 已清理測試暫存檔。`);
      } else {
        console.error(`[錯誤] 雖然 API 回報成功，但實體檔案不存在於: ${expectedPath}`);
      }
    } else {
      console.error("[失敗] API 回報錯誤:", result.error);
    }
  } catch (err) {
    console.error("[失敗] 無法連線至 API 伺服器:", err.message);
  }
}

async function testFrameAPI() {
  console.log("開始測試 /api/test-frame YOLO 影格偵測 API...");
  try {
    const response = await fetch('http://127.0.0.1:3001/api/test-frame');
    const result = await response.json();
    console.log("YOLO 影格偵測 API 回傳結果:", result);
  } catch (err) {
    console.error("[失敗] 無法連線至 YOLO 偵測 API:", err.message);
  }
}

async function main() {
  await testSnapshotAPI();
  await testFrameAPI();
}

main();
