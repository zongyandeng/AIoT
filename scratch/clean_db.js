const { Detection } = require('../backend/models');

async function cleanDatabase() {
  try {
    console.log("正在連接資料庫並清空 Detections 資料表...");
    const count = await Detection.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true
    });
    console.log("資料庫清空成功！");
    process.exit(0);
  } catch (error) {
    console.error("清空資料庫時發生錯誤:", error.message);
    process.exit(1);
  }
}

cleanDatabase();
