# GTX 1650 (4GB VRAM) 訓練 YOLO 模型優化與斷點續訓實戰指南

在使用入門級顯卡（如 **NVIDIA GTX 1650 4GB**）訓練 YOLO 模型（如 YOLOv8、YOLOv11 等）時，最常遇到的瓶頸就是 **顯存溢出 (CUDA out of memory, OOM)**。

本指南為你系統性地整理了如何透過**調整超參數**、**優化顯存佔用**，以及**設定自動保存與斷點續訓**，讓 4GB 的小顯卡也能順利跑完 YOLO 訓練！

---

## 一、 GTX 1650 訓練 YOLO 的核心瓶頸：顯存 (VRAM) 限制

GTX 1650 擁有 **4GB** 的顯存。在深度學習訓練中，顯存的消耗主要來自以下幾個地方：
1. **模型本身的參數與梯度**：模型越大（如 `yolo11x.pt` vs `yolo11n.pt`），佔用顯存就越多。
2. **特徵圖 (Activation Maps)**：在前向傳播過程中，每一層卷積層輸出特徵圖的尺寸與張量大小。**這與「輸入圖片大小 (imgsz)」與「批次大小 (batch)」成正比！**
3. **優化器狀態 (Optimizer States)**：如 AdamW 優化器會記錄每個參數的一階與二階動量，這會消耗大量顯存。

---

## 二、 突破 4GB 顯存！5 大關鍵超參數調優策略

學長說的「調 batch」是解決 OOM 最直接的方法。以下是針對低顯存顯卡必須調整 of 參數設定：

### 1. 批次大小 (Batch Size)
* **超參數名稱**：`batch`
* **調整建議**：將預設的 `batch=16` 調小至 **`batch=4`** 甚至 **`batch=2`**。
* **原理解析**：Batch size 決定了每次顯示卡要同時處理多少張圖片。調小 batch 會直接降低特徵圖的顯存佔用。
* **副作用與補救**：Batch size 太小（例如 2 或 4）會導致每次更新梯度的方向不夠穩定，模型可能難以收斂或效果變差。YOLO 內部有 **梯度累積 (Gradient Accumulation)** 機制，會自動根據你的 batch size 來累積幾次 batch 後才更新一次權重，因此不用太擔心！

### 2. 輸入圖片大小 (Image Size)
* **超參數名稱**：`imgsz`
* **調整建議**：從預設的 `640` 調降到 **`416`** 或 **`320`**（必須是 32 的倍數）。
* **原理解析**：顯存佔用與圖片像素量的平方成正比。將 `640x640` 降到 `416x416`，顯存消耗可以直接砍半以上，這對於 GTX 1650 來說是「續命級」的優化！
* **注意**：圖片變小會稍微降低對極小目標的偵測精度，但對於中大型目標影響不大。

### 3. 自動混合精度 (Automatic Mixed Precision, AMP)
* **超參數名稱**：`amp`
* **調整建議**：保持預設的 **`amp=True`**。
* **原理解析**：AMP 會在不影響精度的前提下，自動將部分計算從 FP32（單精度）轉為 FP16（半精度）。這可以**直接節省近一半的顯存**，並利用 GTX 1650 的 Turing 架構 Tensor Cores 進行計算加速。

### 4. 數據載入執行緒 (Data Loader Workers)
* **超參數名稱**：`workers`
* **調整建議**：設定為 **`workers=2`** 或 **`workers=4`**。在 Windows / WSL 系統上，如果遇到記憶體洩漏或報錯，甚至可以設為 **`workers=0`**。
* **原理解析**：過多的 workers 會佔用額外的 CPU 記憶體與顯卡溝通開銷，適度調小可讓訓練更穩定。

### 5. 快取機制 (Cache)
* **超參數名稱**：`cache`
* **調整建議**：絕對**不要**開啟，設為 **`cache=False`** (預設)。
* **原理解析**：開啟 `cache=True` 會將整張圖片數據快取到系統 RAM 或 GPU 顯存中，這會瞬間撐爆你的記憶體與顯存。

---

## 三、 保存最佳模型 (.pt) 與「死掉前」的模型機制

在訓練過程中，最怕遇到顯卡過熱、系統當機、斷電或是顯存突然爆掉導致訓練中斷。YOLO 提供了非常完善的自動保存與檢查點 (Checkpoint) 機制。

### 1. YOLO 自動保存的兩大模型檔案
在訓練啟動後，YOLO 會在你的工作目錄下自動建立 `runs/detect/train/weights/` 資料夾，並在裡面維持保存兩個最重要的模型：
* **`best.pt` (最佳模型)**：在每次 Epoch 結束後，YOLO 會在驗證集（Validation Set）上進行評估。只要目前的 mAP 等指標超過歷史最高，就會將此時的權重保存為 `best.pt`。
* **`last.pt` (最新模型/死掉前的模型)**：每個 Epoch 結束時，YOLO 都會把最新一次的權重覆寫儲存到 `last.pt`。**這就是用來應對系統「死掉（中斷）」的救命關鍵！**

### 2. 週期性保存設定 (`save_period`)
為了防止在某個 epoch 中途卡死或直接 crash，你可以設定：
* **`save_period=5`**（每 5 個 Epoch 額外備份一個模型檔案，如 `epoch5.pt`, `epoch10.pt`...）。這樣即使連 `last.pt` 都因為寫入中斷損毀，你也還有最近的備份。

---

## 四、 斷點續訓 (Resume) 實戰：顯卡死掉後如何滿血復活？

如果你的訓練在第 45 個 Epoch 因為顯卡過熱或 OOM 中斷了，**千萬不要從頭開始跑**！你只需要用以下程式碼，就能載入 `last.pt` 繼續往下訓練：

```python
from ultralytics import YOLO

# 1. 載入死掉前（最新保存）的 last.pt 模型
# 注意：路徑要指向你中斷訓練的那個 runs 目錄下的 weights
model = YOLO("runs/detect/train/weights/last.pt")

# 2. 啟動斷點續訓，設定 resume=True 即可！
# YOLO 會自動讀取原先的訓練設定（包括 Epoch 數、Batch 等），並從第 46 個 Epoch 繼續往下練！
results = model.train(resume=True)
```

> [!IMPORTANT]
> **斷點續訓的黃金法則**：
> 1. 當你使用 `resume=True` 時，**不要**在 `train()` 裡面傳入其他超參數（例如重新設定 `epochs=100` 或 `batch=4`），因為 YOLO 會直接讀取上次中斷時保存在 `last.pt` 內部配置的超參數。
> 2. 如果要修改超參數（例如想把 batch 調得更小以防再次當機），請不要使用 `resume=True`。此時應將 `last.pt` 當作一般的預訓練模型載入：`model = YOLO("runs/detect/train/weights/last.pt")`，然後正常呼叫 `model.train(epochs=..., batch=...)` 以新的超參數啟動訓練。

---

## 五、 開箱即用：針對 GTX 1650 優化的訓練腳本範例

我們為你準備了一份專門針對 **GTX 1650 4GB 顯卡**優化的 Python 訓練腳本。你可以直接在專案工作區執行此腳本。

### 1. 首次啟動訓練腳本 (`train_low_vram.py`)
```python
from ultralytics import YOLO
import torch

def train_yolo():
    # 確保 PyTorch 偵測到你的 GTX 1650 GPU
    device = "0" if torch.cuda.is_available() else "cpu"
    print("=" * 50)
    print(f"目前使用的訓練裝置：{device}")
    if device == "0":
        print(f"顯卡名稱：{torch.cuda.get_device_name(0)}")
    print("=" * 50)

    # 1. 載入輕量化模型 (強烈建議 GTX 1650 使用 nano 'n' 或 small 's' 版本)
    # yolo11n.pt 只有約 11MB，非常適合 4GB 顯卡！
    model = YOLO("yolo11n.pt")

    # 2. 開始訓練並應用低顯存優化超參數
    model.train(
        data="dataset.yaml",      # 你的資料集設定檔路徑
        epochs=100,               # 訓練的 Epoch 數
        batch=4,                  # GTX 1650 關鍵：設為 4 或 2 避免顯存溢出
        imgsz=416,                # GTX 1650 關鍵：降至 416 節省大量顯存
        device=device,            # 強制指定顯卡訓練
        amp=True,                 # 啟用半精度混合訓練 (節省顯存 + 加速)
        workers=2,                # Windows/WSL 與低階卡優化：設為 2 避免記憶體開銷過大
        cache=False,              # 不快取圖片到記憶體/顯存，保持顯存健康
        save=True,                # 自動保存 best.pt 與 last.pt
        save_period=5,            # 每 5 個 epoch 額外備份一次模型，以防萬一
        project="yolo_low_vram",  # 自定義儲存專案名稱
        name="low_vram_run"       # 自定義該次訓練的名稱
    )

if __name__ == "__main__":
    train_yolo()
```

### 2. 萬一中斷後的「斷點續訓」腳本 (`resume_train.py`)
```python
from ultralytics import YOLO
import torch

def resume_yolo_train():
    # 載入最後保存的斷點模型 weights
    # 路徑為：{project}/{name}/weights/last.pt
    last_model_path = "yolo_low_vram/low_vram_run/weights/last.pt"
    
    print("=" * 50)
    print(f"正在載入斷點模型：{last_model_path} 進行續訓...")
    print("YOLO 將會讀取上次中斷前的超參數與進度繼續往下訓練。")
    print("=" * 50)
    
    try:
        model = YOLO(last_model_path)
        # 啟動斷點續訓
        model.train(resume=True)
    except FileNotFoundError:
        print(f"找不到斷點模型檔案：{last_model_path}。")
        print("請確認先前的訓練有正常啟動並在該目錄下產生了 last.pt，或是確認路徑是否正確。")
    except Exception as e:
        print(f"續訓過程中發生錯誤：{str(e)}")

if __name__ == "__main__":
    resume_yolo_train()
```

---

## 六、 學長說的超參數與顯卡關係對照表

| 超參數 | 作用 | 對顯存的影響 | GTX 1650 (4GB) 推薦設定 |
| :--- | :--- | :--- | :--- |
| **`batch`** | 每次訓練送入顯卡的圖片張數 | **極大**。成正比例關係。 | **`2` 或 `4`** |
| **`imgsz`** | 輸入圖片的解析度大小 | **極大**。呈二次方正比關係。 | **`416` 或 `320`** (預設 640 太吃力) |
| **`amp`** | FPS16 混合精度訓練 | **大**。開啟後可節省近一半顯存。 | **`True`** (必開) |
| **`workers`**| 載入數據的線程數 | **中**。線程越多，顯卡與記憶體負載越高。| **`2`** (WSL 下推薦 `2` 或 `0`) |
| **`cache`** | 快取圖片到 RAM / VRAM | **極大**。極易導致顯存與系統記憶體爆掉。| **`False`** |
| **`model`** | 選擇 YOLO 模型的模型級別 | **大**。Nano (n) 最輕量，XLarge (x) 最龐大。 | 推薦 **`yolo11n.pt`** 或 **`yolo11s.pt`** |
