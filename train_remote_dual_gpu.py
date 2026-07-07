from ultralytics import YOLO
import torch

def train_yolo():
    # 確保 PyTorch 偵測到多張 GPU 進行加速
    if torch.cuda.is_available():
        device_count = torch.cuda.device_count()
        print("=" * 50)
        print(f"偵測到 GPU 數量：{device_count}")
        for i in range(device_count):
            print(f"GPU {i} 名稱：{torch.cuda.get_device_name(i)}")
        print("=" * 50)
        
        # 如果有兩張卡或以上，自動使用 [0, 1] 雙卡訓練
        device = [0, 1] if device_count >= 2 else "0"
    else:
        print("=" * 50)
        print("未偵測到 GPU，將使用 CPU 進行訓練（極度不建議）")
        print("=" * 50)
        device = "cpu"

    # 1. 載入模型 (yolo26n.pt)
    model = YOLO("yolo26n.pt")

    # 2. 開始訓練並應用雙卡效能優化超參數與 Early Stopping
    model.train(
        data="dataset.yaml",      # 你的資料集設定檔路徑
        epochs=100,               # 訓練的 Epoch 數
        batch=32,                 # 雙卡 2080 建議設為 16 或 32
        imgsz=640,                # 恢復為標準 640 提升模型精準度
        device=device,            # 指定雙顯卡或單卡進行訓練
        amp=True,                 # 2080 支援良好，開啟混合精度加速並節省顯存
        workers=8,                # 多核心 CPU 載入資料，設為 8
        cache=True,               # 伺服器記憶體充足，開啟 cache 圖片加速訓練
        patience=15,              # 【新增】早停法：若連續 15 個 Epoch 驗證集指標沒有改善，則提早結束訓練防止過擬合
        save=True,                # 自動保存 best.pt 與 last.pt
        save_period=5,            # 每 5 個 epoch 備份一次模型
        project="yolo_remote_2080", # 遠端訓練專案名稱
        name="dual_gpu_run"       # 該次訓練名稱
    )

if __name__ == "__main__":
    train_yolo()
