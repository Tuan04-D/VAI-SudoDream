# Offline weather downscaling research

Thư mục này là **pipeline nghiên cứu độc lập**, không được backend/frontend
import và không tham gia phát cảnh báo production. Mục tiêu là chứng minh một
quy trình có thể tái lập: lấy output mô hình lưới thô, ghép với reanalysis,
thêm đặc trưng địa hình, train residual correction và đánh giá trên cả thời
gian lẫn địa điểm chưa từng xuất hiện khi fit.

## Pipeline

```text
GFS Global ~13 km forecast ─────┐
ERA5-Land / ERA5 reference ────┼─ timestamp join ─ terrain features
SRTM GL1 30 m (optional) ──────┘        │
                                        └─ ridge residual model
                                           ├─ temporal holdout
                                           ├─ spatial holdout
                                           └─ model card + safety gate
```

- Input train: Open-Meteo Historical Forecast API, model `gfs_global` (~13 km).
  `gfs025` đã được thử nhưng bị loại vì nhiều biến bề mặt trả `null` tại các
  điểm Điện Biên; nhánh 0,25° của API chủ yếu phục vụ pressure-level variables.
- Reference: ERA5-Land cho nhiệt độ/độ ẩm; ERA5 cho mưa, gió và cloud vì
  ERA5-Land không trả các biến đó qua Open-Meteo.
- `elevation=nan` tắt statistical downscaling sẵn có của provider, tránh làm
  input bị hiệu chỉnh trước khi train.
- Điểm lấy mẫu được chọn phủ rộng từ 45 centroid xã/phường hiện có trong repo.
- Ranh giới hiện tại là dữ liệu dẫn xuất từ OpenStreetMap, cần attribution ODbL.
- ERA5/ERA5-Land là reanalysis/reference, **không phải ground truth tuyệt đối**.

Nguồn chính thức:

- [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- [USGS SRTM Collection guide](https://lpdaac.usgs.gov/documents/179/SRTM_User_Guide_V3.pdf)
- [OpenStreetMap copyright/ODbL](https://www.openstreetmap.org/copyright)

## Chạy nhanh

Không cần dependency ngoài Python standard library nếu chưa dùng GeoTIFF:

```powershell
cd research/weather_downscaling

# Bản nhỏ để kiểm tra luồng
python download_dataset.py --start-date 2025-01-01 --end-date 2025-03-31 --max-points 10
python train_evaluate.py --temporal-cutoff 2025-02-15
```

Chạy đúng cấu hình nghiên cứu dài hạn:

```powershell
python download_dataset.py --start-date 2023-01-01 --end-date 2025-12-31 --max-points 20
python train_evaluate.py --temporal-cutoff 2025-01-01
```

Cache JSON và CSV lớn nằm dưới `data/` và bị gitignore. Repo chỉ commit manifest,
metrics, model card và model nhỏ trong `artifacts/` để giám khảo kiểm tra nguồn,
split, checksum và kết quả.

## SRTM 30 m (tùy chọn)

Tải trước một GeoTIFF SRTM GL1 đã crop Điện Biên; không commit file raster lớn.
Sau đó:

```powershell
pip install -r requirements-terrain.txt
python extract_srtm_features.py --dem D:\data\dien-bien-srtm-gl1.tif
python download_dataset.py
```

Nếu chưa có GeoTIFF, downloader dùng elevation 90 m của Open-Meteo làm fallback;
slope/aspect/TPI bằng 0 và manifest ghi rõ điều này, nên không có claim giả rằng
SRTM đã được dùng.

## Điều kiện đưa vào runtime

Artifact luôn đặt `accepted_for_runtime=false`. Việc tích hợp chỉ được cân nhắc
khi có đánh giá forecast lead-time trên Previous Runs/Single Runs, kiểm định mùa
mưa, calibration theo trạm đo và phê duyệt nghiệp vụ. Bản demo hiện vẫn dùng dữ
liệu Open-Meteo và ensemble spread minh bạch.
