from ultralytics import YOLO
import torch

def train_yolo():
    # 確保 PyTorch 偵測到 GPU 進行加速
    device = "0" if torch.cuda.is_available() else "cpu"
    print("=" * 50)
    print(f"目前使用的訓練裝置：{device}")
    if device == "0":
        print(f"顯卡名稱：{torch.cuda.get_device_name(0)}")
    print("=" * 50)

    # 1. 載入輕量化模型 (強烈建議 GTX 1650 4GB 使用 nano 'n' 版本)
    # yolo26n.pt 非常適合 4GB 顯存，訓練速度快且不易 OOM
    model = YOLO("yolo26n.pt")

    # 2. 開始訓練並應用低顯存優化超參數
    model.train(
        data="dataset.yaml",      # 你的資料集設定檔路徑 (例如 data.yaml)
        epochs=20,                # 訓練的 Epoch 數 (修正：3.5 萬張圖片遷移學習 20 輪已完全足夠收斂，總計僅需約 9 小時)
        batch=4,                  # GTX 1650 關鍵：設為 4 或 2 避免顯存溢出
        imgsz=416,                # GTX 1650 關鍵：降至 416 節省大量顯存
        device=device,            # 指定顯卡進行訓練
        amp=False,                # 專門針對 GTX 1650 關閉 AMP，避免硬體 FP16 計算 Bug 與警告
        workers=2,                # WSL 下優化：設為 2 避免記憶體開銷過大
        cache=False,              # 不快取圖片到記憶體/顯存，保持顯存健康
        save=True,                # 自動保存 best.pt 與 last.pt
        save_period=5,            # 每 5 個 epoch 額外備份一次模型，以防萬一
        project="yolo_low_vram",  # 自定義儲存專案名稱
        name="low_vram_run"       # 自定義該次訓練的名稱
    )

if __name__ == "__main__":
    train_yolo()
