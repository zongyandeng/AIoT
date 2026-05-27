const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Detection } = require('./models');

async function run() {
  console.log("📊 正在自 PostgreSQL 資料庫撈取最新的工安偵測數據...");
  
  try {
    // 1. 撈取最新 100 筆偵測資料
    const logs = await Detection.findAll({
      limit: 100,
      order: [['createdAt', 'DESC']]
    });

    if (logs.length === 0) {
      console.log("⚠️ 目前資料庫中沒有任何偵測數據。請確保您的後端正在運行且已有偵測到物體！");
      return;
    }

    console.log(`📥 成功撈取 ${logs.length} 筆偵測日誌！`);

    // 2. 格式化為乾淨的 JSON 格式供 Gemini 分析
    const formattedLogs = logs.map(log => ({
      className: log.className,
      confidence: log.confidence,
      detectedAt: log.createdAt
    }));

    // 3. 取得並驗證 Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("\n❌ 錯誤：找不到 GEMINI_API_KEY 環境變數！");
      console.error("💡 請使用以下指令運行：");
      console.error("   GEMINI_API_KEY=\"您的API_KEY\" node report_generator.js\n");
      process.exit(1);
    }

    console.log("🤖 正在連線至 Gemini API (使用 gemini-3.5-flash)...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    // 4. 精心設計的角色與稽核 Prompt
    const prompt = `
      你是專業的工安稽核員。請根據以下最新的 JSON 偵測日誌紀錄，生成一份繁體中文的【AIoT 實驗室工安違規分析與改善建議報告】：
      
      請依序包含以下結構：
      1. 📊【偵測數據統計分析】：列出這段時間內辨識出的主要物體種類、次數以及平均信賴度。
      2. 🚨【潛在安全風險警告】：分析資料庫日誌中的物體共現關係。例如，若同時頻繁偵測到 'person' (人員) 與 'bus' (車輛)，請警告人車混流、人機協作的安全風險。
      3. 💡【具體可行改善建議】：針對發現的風險，給予實驗室管理員 3 點具體、實用且可行的工安改善建議。
      
      偵測日誌數據：
      ${JSON.stringify(formattedLogs, null, 2)}
    `;

    // 5. 呼叫 API 生成
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reportText = response.text();

    console.log("\n==================================================");
    console.log("📝 GEMINI 智慧工安稽核報告產出：");
    console.log("==================================================");
    console.log(reportText);
    console.log("==================================================\n");

  } catch (error) {
    console.error("❌ 執行過程中發生錯誤：", error.message);
  } finally {
    process.exit(0);
  }
}

run();
