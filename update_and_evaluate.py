import os
import yaml
import matplotlib.pyplot as plt
import csv
from ultralytics import YOLO

def main():
    print("=" * 60)
    print("開始執行自動更新與評估流程...")
    print("=" * 60)

    # 定義路徑
    base_dir = "/home/edison/aiot_workspace"
    labels_file = os.path.join(base_dir, "image/Instant_screenshot/labels_0_indexed_full.txt")
    dataset_yaml_path = os.path.join(base_dir, "dataset.yaml")
    model_path = os.path.join(base_dir, "runs/detect/yolo_low_vram/low_vram_run-9/weights/best.pt")
    
    # 產出圖表資料夾
    output_dir = os.path.join(base_dir, "runs/detect/yolo_low_vram/val_new")
    os.makedirs(output_dir, exist_ok=True)

    # 1. 讀取與解析新類別名稱
    print(f"正在讀取類別對照表：{labels_file}")
    if not os.path.exists(labels_file):
        raise FileNotFoundError(f"找不到類別對照表檔案：{labels_file}")

    class_names = {}
    with open(labels_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # 格式例如: 0 people with helmet (pwh)
            parts = line.split(" ", 1)
            if len(parts) == 2:
                idx = int(parts[0])
                name = parts[1]
                class_names[idx] = name

    print(f"解析成功，共有 {len(class_names)} 個類別：")
    for idx, name in sorted(class_names.items()):
        print(f"  Class {idx}: {name}")

    # 2. 更新 dataset.yaml
    print(f"正在更新 dataset.yaml：{dataset_yaml_path}")
    if not os.path.exists(dataset_yaml_path):
        raise FileNotFoundError(f"找不到 dataset.yaml：{dataset_yaml_path}")

    with open(dataset_yaml_path, "r", encoding="utf-8") as f:
        data_config = yaml.safe_load(f)

    # 更新 nc 與 names
    data_config["nc"] = len(class_names)
    data_config["names"] = {idx: name for idx, name in sorted(class_names.items())}

    with open(dataset_yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(data_config, f, allow_unicode=True, default_flow_style=False)
    print("dataset.yaml 更新完成！")

    # 3. 掃描資料集，統計類別分布並繪製「分布圖」 (class_distribution.png)
    print("正在統計訓練集與驗證集的類別分布...")
    # 使用由 find + cut 高速命令計算出的靜態類別數量，避免對 70,000+ 檔案進行緩慢的循序開檔讀取
    train_counts = {
        0: 25917,
        1: 20595,
        2: 8536,
        3: 19742,
        4: 7610,
        5: 25250
    }
    val_counts = {
        0: 2131,
        1: 2158,
        2: 892,
        3: 1553,
        4: 561,
        5: 1448
    }

    # 繪製分布圖
    print("正在繪製類別分布圖...")
    fig, ax = plt.subplots(figsize=(10, 6))
    categories = [class_names[i] for i in sorted(class_names.keys())]
    y_pos = range(len(categories))
    
    train_values = [train_counts[i] for i in sorted(class_names.keys())]
    val_values = [val_counts[i] for i in sorted(class_names.keys())]

    # 繪製雙柱狀圖
    bar_width = 0.35
    rects1 = ax.barh([y - bar_width/2 for y in y_pos], train_values, bar_width, label='Train', color='#4C72B0')
    rects2 = ax.barh([y + bar_width/2 for y in y_pos], val_values, bar_width, label='Validation', color='#55A868')

    ax.set_xlabel('Count (Bounding Boxes)')
    ax.set_ylabel('Class Name')
    ax.set_title('Dataset Class Distribution (Train vs Validation)')
    ax.set_yticks(y_pos)
    ax.set_yticklabels(categories)
    ax.legend()
    
    # 在柱狀圖旁標註數值
    for rect in rects1:
        width = rect.get_width()
        ax.annotate(f'{width}',
                    xy=(width, rect.get_y() + rect.get_height() / 2),
                    xytext=(3, 0),  # 3 points horizontal offset
                    textcoords="offset points",
                    ha='left', va='center', fontsize=8)
    for rect in rects2:
        width = rect.get_width()
        ax.annotate(f'{width}',
                    xy=(width, rect.get_y() + rect.get_height() / 2),
                    xytext=(3, 0),
                    textcoords="offset points",
                    ha='left', va='center', fontsize=8)

    plt.tight_layout()
    dist_plot_path = os.path.join(output_dir, "class_distribution.png")
    plt.savefig(dist_plot_path, dpi=300)
    plt.close()
    print(f"類別分布圖已儲存至：{dist_plot_path}")

    # 4. 讀取 results.csv 繪製「折線圖」 (training_metrics_curves.png)
    results_csv_path = os.path.join(base_dir, "runs/detect/yolo_low_vram/low_vram_run-9/results.csv")
    print(f"正在讀取訓練記錄：{results_csv_path}")
    if os.path.exists(results_csv_path):
        try:
            epochs = []
            train_box_loss = []
            train_cls_loss = []
            train_dfl_loss = []
            val_box_loss = []
            val_cls_loss = []
            val_dfl_loss = []
            precision = []
            recall = []
            map50 = []
            map50_95 = []

            with open(results_csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                # 清理欄位名稱的多餘空格
                reader.fieldnames = [c.strip() for c in reader.fieldnames] if reader.fieldnames else []
                for row in reader:
                    epochs.append(int(row['epoch']))
                    train_box_loss.append(float(row['train/box_loss']))
                    train_cls_loss.append(float(row['train/cls_loss']))
                    train_dfl_loss.append(float(row['train/dfl_loss']))
                    val_box_loss.append(float(row['val/box_loss']))
                    val_cls_loss.append(float(row['val/cls_loss']))
                    val_dfl_loss.append(float(row['val/dfl_loss']))
                    precision.append(float(row['metrics/precision(B)']))
                    recall.append(float(row['metrics/recall(B)']))
                    map50.append(float(row['metrics/mAP50(B)']))
                    map50_95.append(float(row['metrics/mAP50-95(B)']))

            fig, axes = plt.subplots(2, 5, figsize=(18, 8))
            
            # Row 0: train losses & precision/recall
            axes[0, 0].plot(epochs, train_box_loss, color='#1f77b4', linewidth=1.5)
            axes[0, 0].set_title('train/box_loss')
            axes[0, 1].plot(epochs, train_cls_loss, color='#1f77b4', linewidth=1.5)
            axes[0, 1].set_title('train/cls_loss')
            axes[0, 2].plot(epochs, train_dfl_loss, color='#1f77b4', linewidth=1.5)
            axes[0, 2].set_title('train/dfl_loss')
            axes[0, 3].plot(epochs, precision, color='#1f77b4', linewidth=1.5)
            axes[0, 3].set_title('metrics/precision(B)')
            axes[0, 4].plot(epochs, recall, color='#1f77b4', linewidth=1.5)
            axes[0, 4].set_title('metrics/recall(B)')
            
            # Row 1: val losses & mAPs
            axes[1, 0].plot(epochs, val_box_loss, color='#ff7f0e', linewidth=1.5)
            axes[1, 0].set_title('val/box_loss')
            axes[1, 1].plot(epochs, val_cls_loss, color='#ff7f0e', linewidth=1.5)
            axes[1, 1].set_title('val/cls_loss')
            axes[1, 2].plot(epochs, val_dfl_loss, color='#ff7f0e', linewidth=1.5)
            axes[1, 2].set_title('val/dfl_loss')
            axes[1, 3].plot(epochs, map50, color='#ff7f0e', linewidth=1.5)
            axes[1, 3].set_title('metrics/mAP50(B)')
            axes[1, 4].plot(epochs, map50_95, color='#ff7f0e', linewidth=1.5)
            axes[1, 4].set_title('metrics/mAP50-95(B)')
            
            # Formats
            for r in range(2):
                for c in range(5):
                    axes[r, c].set_xlabel('epoch')
                    axes[r, c].grid(True, linestyle='--', alpha=0.5)
            
            plt.suptitle('YOLOv11 Training Progress Metrics', fontsize=14)
            plt.tight_layout()
            
            metrics_plot_path = os.path.join(output_dir, "results.png")  # 改為 YOLO 預設的檔名 results.png
            plt.savefig(metrics_plot_path, dpi=300)
            plt.close()
            print(f"訓練指標折線圖已儲存至：{metrics_plot_path}")
        except Exception as e:
            print(f"繪製訓練指標折線圖時發生錯誤: {e}")
    else:
        print("警告：找不到 results.csv，無法繪製訓練指標折線圖。")

    # 5. 運行 YOLO 驗證以產生混淆矩陣
    print(f"正在載入模型：{model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"找不到模型權重檔：{model_path}")

    model = YOLO(model_path)
    
    # 關鍵：使用 dict.clear() 與 update() 原地修改類別名稱，避開 property setter 限制，更新混淆矩陣
    print("原始類別名稱：", model.names)
    model.names.clear()
    model.names.update(class_names)
    if hasattr(model, 'model') and model.model is not None:
        if hasattr(model.model, 'names') and isinstance(model.model.names, dict):
            model.model.names.clear()
            model.model.names.update(class_names)
    print("覆寫後類別名稱：", model.names)
    
    print("正在執行 YOLO 驗證以生成混淆矩陣與 PR 曲線圖...")
    # val 方法會自動使用 dataset.yaml 的設定並將結果輸出到 val_new 資料夾下
    model.val(
        data=dataset_yaml_path,
        split='val',
        batch=16,
        imgsz=416,  # 配合你 GTX 1650 的訓練圖片大小
        device=0,
        workers=2,  # 設為 2 個執行緒，加速加載同時防止 OOM 記憶體溢出
        project=os.path.join(base_dir, "runs/detect/yolo_low_vram"),
        name="val_new",
        plots=True   # 確保繪製圖表 (混淆矩陣與 PR 曲線等)
    )

    print("=" * 60)
    print("所有更新與圖表生成任務成功完成！")
    print(f"所有圖表都保存在：{output_dir}")
    print("=" * 60)

if __name__ == "__main__":
    main()