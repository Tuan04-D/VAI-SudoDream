# Model card — Điện Biên weather residual correction

> Trạng thái: **nghiên cứu offline, chưa kết nối runtime và không dùng để phát cảnh báo**.

## Mục tiêu

Mô hình ridge tuyến tính dự đoán residual giữa GFS Global và dữ liệu tham chiếu. Nó là proof-of-concept hậu xử lý tại các centroid xã, không phải mô hình dự báo thiên tai, không phải nội suy thời tiết 30 m và không thay thế bản tin cơ quan chuyên môn.

## Dữ liệu và tách tập

- Khoảng dữ liệu: `2025-01-01` đến `2025-03-31`; 21,600 dòng giờ.
- Số điểm: 10; spatial holdout: 2 điểm chưa xuất hiện khi fit.
- Temporal cutoff: `2025-02-15T00:00:00+00:00`; dữ liệu từ mốc này không dùng để fit.
- Terrain artifact dùng trong lần chạy này: `open_meteo_elevation_90m_fallback`.
- Nhiệt độ/độ ẩm tham chiếu ERA5-Land; mưa/gió/cloud ERA5 chỉ để đối chiếu vì ERA5-Land không cung cấp các biến đó qua API.
- `elevation=nan` và `cell_selection=nearest` được dùng để tắt statistical downscaling của provider ở input/target.

## Kết quả

| Biến | Tập | n | MAE GFS gốc | MAE hiệu chỉnh | Skill MAE |
|---|---:|---:|---:|---:|---:|
| temperature_2m | train_fit | 8,640 | 1.8596 | 1.0595 | 43.03% |
| temperature_2m | temporal_holdout | 8,640 | 2.1510 | 2.0465 | 4.86% |
| temperature_2m | spatial_holdout_all | 4,320 | 2.1481 | 1.4260 | 33.62% |
| temperature_2m | spatiotemporal_holdout | 2,160 | 2.3369 | 1.7777 | 23.93% |
| relative_humidity_2m | train_fit | 8,640 | 9.8926 | 5.6077 | 43.31% |
| relative_humidity_2m | temporal_holdout | 8,640 | 15.8980 | 11.1172 | 30.07% |
| relative_humidity_2m | spatial_holdout_all | 4,320 | 14.1891 | 9.0889 | 35.94% |
| relative_humidity_2m | spatiotemporal_holdout | 2,160 | 17.6273 | 12.3062 | 30.19% |

## Giới hạn và safety gate

- ERA5-Land là reanalysis/reference, không phải quan trắc trạm hay ground truth tuyệt đối.
- Chưa có SRTM thì elevation fallback 90 m không có slope/aspect/TPI thật; các cột đó bằng 0.
- Không đánh giá forecast lead-time: cần Previous Runs/Single Runs API trước khi tuyên bố cải thiện dự báo vận hành.
- Artifact luôn ghi `accepted_for_runtime=false`; chỉ được tích hợp sau kiểm định mùa mưa, calibration và phê duyệt nghiệp vụ.
- Cảnh báo production hiện vẫn dùng Open-Meteo multi-model và rule minh bạch, không dùng model này.

## Tái lập

Xem `research/weather_downscaling/README.md`. Dataset lớn và cache API không commit; manifest có SHA-256 để đối chiếu.
