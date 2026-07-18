# Finetune Whisper ASR — Tiếng H'Mông

Fine-tune mô hình `openai/whisper-small` cho bài toán Automatic Speech Recognition (ASR)
tiếng H'Mông.

## Nguồn dữ liệu

Dữ liệu được xây dựng từ các bản ghi âm tôn giáo tiếng H'Mông công khai trên internet
(Kinh Thánh tiếng H'Mông, gồm Cựu Ước và Tân Ước) cùng văn bản phiên âm tương ứng theo
từng chương. Dữ liệu thô ở dạng audio dài (MP3, chuyển sang WAV 16kHz mono bằng `ffmpeg`)
đi kèm transcript TXT.

## Tiền xử lý (tóm tắt)

Audio dài được cắt thành các đoạn ngắn bằng forced alignment (Whisper large qua
`stable-whisper`) ở cấp độ từ, để tránh cắt ngang câu/từ như phân đoạn theo độ dài cố
định. Một đoạn mới được chốt khi thời lượng tích lũy đạt 25 giây hoặc từ hiện tại kết
thúc bằng dấu câu. Mỗi đoạn audio được lưu thành file WAV riêng, nhãn văn bản tương ứng
ghi vào `label.csv` với hai cột `file_path` và `label`.

## Thống kê dataset

| Thuộc tính | Giá trị |
|---|---|
| Tổng số phát ngôn | 36.065 |
| Tổng thời lượng | 48,70 giờ |
| Thời lượng trung bình / phát ngôn | 4,86 giây |
| Tổng số từ | 445.124 |
| Số từ độc lập (unique words) | 8.788 |
| Số từ trung bình / phát ngôn | 12,34 |

Dữ liệu được chia ngẫu nhiên theo tỷ lệ 80/10/10 (seed = 42):

| Tập | Phát ngôn | Thời lượng (giờ) |
|---|---|---|
| Train | 28.852 | ≈38,96 |
| Validation | 3.607 | ≈4,87 |
| Test nội bộ | 3.606 | ≈4,87 |

Toàn bộ dữ liệu xuất phát từ một miền duy nhất (âm thanh tôn giáo đọc văn bản), nên tập
test nội bộ chia sẻ cùng phân phối âm học với tập train — cần một tập test thực tế độc
lập để đánh giá khả năng tổng quát hóa (xem phần Đánh giá).

## Quy trình fine-tuning

- **Model nền:** `openai/whisper-small` (~244M tham số), full fine-tuning toàn bộ tham số
  qua `WhisperForConditionalGeneration` (Hugging Face Transformers).
- **Framework:** PyTorch Lightning, theo dõi qua TensorBoard.
- **Optimizer:** AdamW, lr = 1e-5, weight decay = 0,01.
- **LR schedule:** linear warmup (500 bước) + linear decay.
- **Batch size:** 16/device, gradient accumulation 4 bước → effective batch size 64.
- **Precision:** bf16-mixed.
- **Epoch tối đa:** 500, early stopping patience 10 epoch theo `val_wer`.
- **Checkpoint:** lưu checkpoint có `val_wer` tốt nhất.
- **Seed:** 42.

Mô hình tốt nhất thu được tại epoch 21 (val_wer = 12,26%).

## Kết quả đánh giá

**Test nội bộ** (cùng phân phối với dữ liệu train):

| Thang đo | Giá trị |
|---|---|
| WER | 12,35% |
| CER | 8,68% |
| RTF | 0,0232 |

**Test thực tế** (audio tự thu, điều kiện không kiểm soát):

| Thang đo | Giá trị |
|---|---|
| WER | 26,60% |
| CER | 12,02% |
| RTF | 0,0125 |

RTF ở cả hai tập đều rất thấp (< 0,03), cho thấy mô hình xử lý nhanh hơn thời gian thực
40–80 lần, đáp ứng tốt yêu cầu triển khai thực tế về tốc độ.

Khoảng cách WER giữa hai tập (+14,25 điểm) phản ánh domain shift rõ rệt: dữ liệu train chỉ
đến từ một miền hẹp (audio tôn giáo, đọc chậm, rõ ràng, ít nhiễu), trong khi audio thực tế
có nhiễu nền, đặc tính thiết bị thu khác biệt và tốc độ/phong cách nói tự nhiên hơn. Chênh
lệch WER lớn hơn nhiều so với chênh lệch CER (+3,34 điểm) cho thấy mô hình vẫn nhận dạng
tốt các đơn vị âm học cơ bản nhưng gặp khó khi ghép thành từ đúng — điển hình của lỗi
out-of-vocabulary kết hợp lỗi ranh giới từ.

Chi tiết đầy đủ (phương pháp, công thức, phân tích) xem `technical_report.tex` ở thư mục
gốc `finetune-whisper/`.

## Cấu trúc thư mục

```
finetune-whisper-asr-hmong/
├── scripts/
│   ├── config.py              # đường dẫn dữ liệu/output, hyperparameters
│   ├── data.py                # Dataset/DataModule, feature extraction, split 80/10/10
│   ├── train.py                # LightningModule + training loop
│   ├── test.py                 # đánh giá trên tập test nội bộ
│   ├── external_test.py        # đánh giá trên tập test thực tế (audio tự thu)
│   ├── manual_check_external.py  # sinh CSV so sánh predict/true, phát hiện hallucination
│   ├── test_inference.py       # inference thử qua microphone
│   └── utils.py                 # seed, chuẩn hóa text (normalize_text)
├── outputs/
│   ├── dataset_stats.txt              # thống kê tổng thể dataset
│   ├── test_metrics.json              # WER/CER/RTF — test nội bộ
│   ├── external_test_metrics.json     # WER/CER/RTF — test thực tế
│   ├── external_manual_check.csv      # so sánh predict/true chi tiết từng sample
│   ├── val_cer.png / val_wer.png      # biểu đồ CER/WER theo bước huấn luyện
│   └── whisper_small_ft/version_0/
│       ├── hparams.yaml               # hyperparameters đã log
│       
└── requirements.txt
```

Checkpoint model (`.ckpt`) không được đưa vào repo do dung lượng lớn.

## Chạy lại

```bash
cd scripts
python train.py              # fine-tune, tự động test sau khi train xong
python test.py                # đánh giá riêng trên tập test nội bộ
python external_test.py       # đánh giá trên tập test thực tế
python manual_check_external.py  # sinh báo cáo so sánh chi tiết
```

Cần chỉnh `Config` trong `config.py` (đường dẫn `DATA_DIR`, `OUTPUT_DIR`, `CKPT_PATH`) cho
đúng môi trường chạy. Dữ liệu đầu vào là thư mục audio đã cắt đoạn kèm `label.csv`
(hai cột `file_path`, `label`).
