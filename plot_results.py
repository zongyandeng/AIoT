import csv
import matplotlib.pyplot as plt
import os

def generate_plots():
    csv_path = '/home/edison/aiot_workspace/runs/detect/yolo_low_vram/low_vram_run-9/results.csv'
    output_dir = '/home/edison/aiot_workspace/runs/detect/yolo_low_vram/low_vram_run-9'
    output_path = os.path.join(output_dir, 'results_plot.png')
    
    if not os.path.exists(csv_path):
        print(f"Error: Could not find {csv_path}")
        return

    epochs = []
    train_box_loss = []
    train_cls_loss = []
    val_box_loss = []
    val_cls_loss = []
    metrics_precision = []
    metrics_recall = []
    metrics_map50 = []
    metrics_map50_95 = []

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Strip keys and values
            row = {k.strip(): v.strip() for k, v in row.items()}
            epochs.append(int(row['epoch']))
            train_box_loss.append(float(row['train/box_loss']))
            train_cls_loss.append(float(row['train/cls_loss']))
            val_box_loss.append(float(row['val/box_loss']))
            val_cls_loss.append(float(row['val/cls_loss']))
            metrics_precision.append(float(row['metrics/precision(B)']))
            metrics_recall.append(float(row['metrics/recall(B)']))
            metrics_map50.append(float(row['metrics/mAP50(B)']))
            metrics_map50_95.append(float(row['metrics/mAP50-95(B)']))

    # Use standard style
    plt.style.use('ggplot')
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    # Plot Losses
    ax1.plot(epochs, train_box_loss, label='Train Box Loss', color='#FF6B6B', linewidth=2)
    ax1.plot(epochs, train_cls_loss, label='Train Class Loss', color='#4D96FF', linewidth=2)
    ax1.plot(epochs, val_box_loss, label='Val Box Loss', color='#FFD93D', linestyle='--', linewidth=2)
    ax1.plot(epochs, val_cls_loss, label='Val Class Loss', color='#6BCB77', linestyle='--', linewidth=2)
    ax1.set_title('Training & Validation Loss Curves', fontsize=14, fontweight='bold')
    ax1.set_xlabel('Epochs', fontsize=12)
    ax1.set_ylabel('Loss', fontsize=12)
    ax1.legend(fontsize=10)
    ax1.grid(True, linestyle=':', alpha=0.6)

    # Plot Metrics
    ax2.plot(epochs, metrics_precision, label='Precision', color='#FF9F43', linewidth=2)
    ax2.plot(epochs, metrics_recall, label='Recall', color='#00D2FC', linewidth=2)
    ax2.plot(epochs, metrics_map50, label='mAP50', color='#10AC84', linewidth=2.5)
    ax2.plot(epochs, metrics_map50_95, label='mAP50-95', color='#5f27cd', linewidth=2)
    ax2.set_title('Training Evaluation Metrics', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Epochs', fontsize=12)
    ax2.set_ylabel('Score', fontsize=12)
    ax2.set_ylim(0, 1.05)
    ax2.legend(fontsize=10)
    ax2.grid(True, linestyle=':', alpha=0.6)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    print(f"Plot saved successfully to {output_path}!")

if __name__ == '__main__':
    generate_plots()
