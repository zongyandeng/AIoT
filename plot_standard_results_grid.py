import csv
import matplotlib.pyplot as plt
import os

def generate_standard_grid():
    csv_path = '/home/edison/aiot_workspace/runs/detect/yolo_low_vram/low_vram_run-9/results.csv'
    output_dir = '/home/edison/aiot_workspace/runs/detect/yolo_low_vram/low_vram_run-9'
    output_path = os.path.join(output_dir, 'results.png')  # Save as standard results.png
    
    if not os.path.exists(csv_path):
        print(f"Error: Could not find {csv_path}")
        return

    epochs = []
    data = {
        'train/box_loss': [],
        'train/cls_loss': [],
        'train/dfl_loss': [],
        'metrics/precision(B)': [],
        'metrics/recall(B)': [],
        'val/box_loss': [],
        'val/cls_loss': [],
        'val/dfl_loss': [],
        'metrics/mAP50(B)': [],
        'metrics/mAP50-95(B)': []
    }

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Strip keys and values
            row = {k.strip(): v.strip() for k, v in row.items()}
            epochs.append(int(row['epoch']))
            for key in data.keys():
                data[key].append(float(row[key]))

    # Set up matplotlib style (clean white background with thin grids)
    fig, axes = plt.subplots(2, 5, figsize=(18, 8), sharex=True)
    
    # Grid of subplots mapping: (row, col)
    # Row 1: train losses, precision, recall
    # Row 2: val losses, mAP50, mAP50-95
    plot_mapping = [
        ('train/box_loss', 0, 0, '#1f77b4'),
        ('train/cls_loss', 0, 1, '#1f77b4'),
        ('train/dfl_loss', 0, 2, '#1f77b4'),
        ('metrics/precision(B)', 0, 3, '#1f77b4'),
        ('metrics/recall(B)', 0, 4, '#1f77b4'),
        ('val/box_loss', 1, 0, '#ff7f0e'),
        ('val/cls_loss', 1, 1, '#ff7f0e'),
        ('val/dfl_loss', 1, 2, '#ff7f0e'),
        ('metrics/mAP50(B)', 1, 3, '#ff7f0e'),
        ('metrics/mAP50-95(B)', 1, 4, '#ff7f0e')
    ]

    for key, r, c, color in plot_mapping:
        ax = axes[r, c]
        ax.plot(epochs, data[key], color=color, linewidth=1.5, label='results')
        
        # Add a light moving average smoothing line like TensorBoard / newer YOLO
        if len(data[key]) > 5:
            # Simple moving average helper
            smooth_y = []
            window = 5
            for i in range(len(data[key])):
                start = max(0, i - window + 1)
                smooth_y.append(sum(data[key][start:i+1]) / (i - start + 1))
            ax.plot(epochs, smooth_y, color=color, linestyle=':', alpha=0.6, label='smooth')

        # Formatting
        ax.set_title(key, fontsize=11, fontweight='bold', pad=8)
        ax.grid(True, which='both', linestyle='--', linewidth=0.5, alpha=0.7)
        ax.tick_params(axis='both', which='major', labelsize=9)
        
        # Adjust Y limits for metrics to be between 0 and 1
        if 'metrics' in key:
            ax.set_ylim(-0.05, 1.05)
            
        # Hide x labels except for the bottom row
        if r == 1:
            ax.set_xlabel('epoch', fontsize=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    print(f"Standard 2x5 grid plot saved successfully to {output_path}!")

if __name__ == '__main__':
    generate_standard_grid()
