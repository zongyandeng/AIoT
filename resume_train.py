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
