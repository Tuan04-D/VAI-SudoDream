# Báo cáo kỹ thuật: Trạm Bản
### Nền tảng AI cảnh báo thời tiết và thiên tai theo giọng nói, cho đồng bào vùng cao Điện Biên

---

## Tóm tắt

Trạm Bản là một hệ thống cảnh báo thời tiết và thiên tai theo từng xã, được xây dựng cho tỉnh Điện Biên — một địa bàn miền núi có địa hình chia cắt mạnh, thời tiết cực đoan thay đổi nhanh, và một tỷ lệ đáng kể dân cư là người dân tộc thiểu số không đọc thạo chữ quốc ngữ và không nói được tiếng Việt phổ thông. Điểm khác biệt cốt lõi của Trạm Bản không nằm ở việc vẽ thêm một bản đồ thời tiết đẹp hơn, mà ở việc giải quyết đúng bài toán tiếp cận: dữ liệu cảnh báo thật (Open-Meteo, cảnh báo sạt lở/lũ quét chính thức từ Trung tâm Dự báo Khí tượng Thủy văn Quốc gia — NCHMF) được chuyển hóa thành cảnh báo có thể *nghe được, hiểu được và hành động được ngay* bởi một người chưa từng đọc một bản tin khí tượng nào trong đời — thông qua một trợ lý AI hội thoại hai chiều bằng giọng nói tiếng H'Mông, được xây dựng trên một mô hình nhận dạng tiếng nói (ASR) tự tinh chỉnh riêng cho ngôn ngữ này, cùng với một giao diện thị giác ưu tiên icon, màu sắc và âm thanh thay vì số liệu kỹ thuật.

Đây không phải một bài toán ngách tự nhóm nghĩ ra. Đầu năm 2025, Bộ Khoa học và Công nghệ mở tuyển chọn đơn vị thực hiện một nhiệm vụ thuộc **Chương trình khoa học và công nghệ cấp quốc gia hỗ trợ nghiên cứu, phát triển và ứng dụng công nghệ của công nghiệp 4.0**, với mục tiêu xây dựng kho ngữ liệu đơn ngữ và song ngữ Mông–Việt cùng một ứng dụng dịch Việt–Mông dựa trên AI. Nói cách khác, việc đưa AI đến với tiếng H'Mông đã được xác lập là một ưu tiên khoa học công nghệ ở cấp quốc gia, không phải một ý tưởng bên lề. Trạm Bản tiếp cận đúng bài toán ấy từ một hướng khác — không dừng ở dịch văn bản, mà đi thẳng đến nhu cầu sinh tồn hàng ngày (thời tiết, thiên tai) và một mô hình ASR tiếng H'Mông đã tinh chỉnh, đã chạy được trên dữ liệu thật, ngay tại thời điểm chương trình quốc gia mới đang ở giai đoạn tìm đơn vị triển khai.

Báo cáo này trình bày toàn bộ hệ thống: từ bài toán xã hội đặt ra và định hướng thiết kế của dự án, đến kiến trúc kỹ thuật chi tiết của từng module — trọng tâm là module agent voice (kiến trúc mô hình, quy trình tinh chỉnh ASR tiếng H'Mông, tổng hợp giọng nói, kiến trúc hội thoại thời gian thực, kho tri thức và các ràng buộc an toàn AI) — cho đến bộ máy đánh giá rủi ro có định lượng bất định thật (ensemble đa mô hình, hiệu chỉnh địa hình), phần mềm backend, frontend, cơ sở dữ liệu, lộ trình khả thi triển khai thực địa, và cách toàn bộ hệ thống được tích hợp thành một sản phẩm hoàn chỉnh, có thể dùng ngay. Báo cáo kết thúc bằng đánh giá trung thực về giới hạn hiện tại và lộ trình mở rộng sang các tỉnh miền núi khác và các ngôn ngữ dân tộc thiểu số khác.

---

# Chương 1: Giới thiệu bài toán và đặt vấn đề

## 1.1. Bối cảnh: Điện Biên và khoảng trống trong cảnh báo thiên tai

Điện Biên là một tỉnh miền núi phía Tây Bắc Việt Nam, có địa hình chia cắt mạnh, độ cao chênh lệch lớn giữa các tiểu vùng chỉ cách nhau vài kilomet, và một khí hậu có thể chuyển từ nắng sang sương mù dày đặc, mưa lớn hoặc rét đậm trong vài giờ. Đây cũng là địa bàn thường xuyên xảy ra sạt lở đất và lũ quét — hai loại hình thiên tai gây thiệt hại nghiêm trọng nhất về người và tài sản ở khu vực này.

Hệ thống cảnh báo hiện tại vận hành chủ yếu ở cấp tỉnh hoặc cấp huyện: một bản tin chung được phát ra cho một địa bàn rộng, không phản ánh đúng mức độ rủi ro cụ thể tại từng xã, từng bản. Với địa hình chia cắt như Điện Biên, một bản tin "có mưa lớn ở khu vực phía Bắc tỉnh" gần như vô nghĩa với một hộ dân cần biết chính xác: xã mình có nguy hiểm không, nguy hiểm vào lúc nào, và cần làm gì ngay bây giờ.

## 1.2. Vấn đề không chỉ là kỹ thuật, mà là ngôn ngữ

Nếu chỉ dừng ở bài toán "làm dự báo chi tiết hơn", đây đã là một bài toán kỹ thuật thú vị. Nhưng thực tế phức tạp hơn: một bản tin cảnh báo — dù chính xác đến từng xã — vẫn hoàn toàn vô dụng nếu người nhận nó không đọc được chữ quốc ngữ, hoặc không hiểu tiếng Việt phổ thông. Điện Biên có tỷ lệ đồng bào dân tộc thiểu số rất cao, trong đó có cộng đồng người H'Mông sinh sống chủ yếu ở các xã vùng cao — đúng những khu vực có địa hình dốc, nguy cơ sạt lở và lũ quét cao nhất. Đây không phải là sự trùng hợp: rủi ro thiên tai và rào cản ngôn ngữ, ở Việt Nam, thường rơi vào cùng một nhóm người.

Một bản tin cảnh báo dạng văn bản tiếng Việt, được gửi qua một ứng dụng đòi hỏi thao tác đọc-hiểu, đơn giản là không tồn tại đối với một bộ phận không nhỏ những người cần nó nhất: người già, phụ nữ lớn tuổi, những người chưa từng đến trường hoặc học hết cấp một ở một ngôi trường mà tiếng Việt là ngôn ngữ thứ hai của chính họ.

## 1.3. Một câu chuyện liên hệ

Một tình huống khá phổ biến ở các gia đình vùng cao có thể minh hoạ rõ vấn đề đang đặt ra: một người mẹ có điện thoại trong tay, nhưng không nghe hiểu được tiếng Việt và không biết cách xem một bản tin dự báo thời tiết. Mỗi khi cần biết trời có mưa hay không, bà đều phải nhờ con cháu xem hộ rồi giải thích lại bằng lời. Đây là một việc rất nhỏ trong đời sống hàng ngày, nhưng nó phản ánh đúng khoảng cách mà rất nhiều hộ gia đình khác ở vùng cao đang gặp phải mỗi ngày, với cả những thứ quan trọng hơn một bản tin thời tiết — từ việc đọc một tờ thông báo chính sách nông nghiệp, đến việc diễn tả triệu chứng bệnh với một cán bộ y tế không nói được tiếng dân tộc.

Điểm chung của những tình huống này không phải là thiếu thiết bị hay thiếu kết nối internet, mà là thông tin đến bằng một ngôn ngữ và một hình thức — chữ viết — mà người nhận không tiếp cận được. Đây chính là góc nhìn định hình hướng tiếp cận của Trạm Bản: giải pháp đúng không phải là làm cho bản tin cảnh báo chi tiết hơn hay đẹp hơn, mà là để người dân nhận được thông tin bằng chính ngôn ngữ và hình thức họ đã quen dùng cả đời — lời nói — thay vì chữ viết.

## 1.4. Vì sao lựa chọn giọng nói tiếng H'Mông làm hướng tiếp cận chính

Các mô hình ngôn ngữ lớn (LLM) ngày nay có thể trả lời gần như mọi câu hỏi bằng hàng chục ngôn ngữ quốc tế — nhưng tiếng H'Mông, một ngôn ngữ khan hiếm dữ liệu số (low-resource) với hệ thống thanh điệu phức tạp và sự phân mảnh phương ngữ sâu sắc, gần như vắng mặt trong những hệ thống ấy. Dịch một bản tin sang chữ viết H'Mông cũng không giải quyết được vấn đề tận gốc, vì bản thân chữ viết là một rào cản khác đối với người không biết chữ.

Vì vậy, Trạm Bản chọn cách tiếp cận trực diện hơn: tự xây dựng một mô hình nhận dạng tiếng nói (ASR) tinh chỉnh riêng cho tiếng H'Mông, kết hợp với một trợ lý hội thoại hai chiều bằng giọng nói, theo nguyên tắc thiết kế **Zero-Literacy Design** (thiết kế phi văn bản): người dùng không cần biết đọc, không cần biết viết, không cần thao tác một giao diện phức tạp — chỉ cần nói bằng tiếng mẹ đẻ của mình, và nhận lại câu trả lời cũng bằng giọng nói ấy.

Thời tiết và cảnh báo thiên tai được chọn làm bài toán đầu tiên để áp dụng hướng tiếp cận này vì ba lý do: (1) đây là nhu cầu có tính sinh tồn, phát sinh hàng ngày, không cần giải thích thêm về giá trị sử dụng; (2) dữ liệu đầu vào — dự báo thời tiết và cảnh báo thiên tai chính thức — đã có sẵn ở dạng cấu trúc, công khai và cập nhật liên tục, cho phép xây dựng một hệ thống *grounded* (bám sát dữ liệu thật, không suy đoán) thay vì một chatbot trả lời chung chung; và (3) địa bàn Điện Biên hội tụ đúng nhóm người cần giải pháp này nhất: đồng bào H'Mông sinh sống ở vùng có rủi ro thiên tai cao nhất tỉnh.

## 1.5. Đúng thời điểm: ưu tiên chính sách quốc gia về AI cho ngôn ngữ dân tộc thiểu số

Lựa chọn tiếng H'Mông không phải là một quyết định biệt lập của một đội thi đấu hackathon — nó trùng khớp với một hướng đi mà chính nhà nước đang chủ động thúc đẩy. Đầu năm 2025, Bộ Khoa học và Công nghệ công bố tuyển chọn đơn vị chủ trì thực hiện một nhiệm vụ thuộc **Chương trình khoa học và công nghệ cấp quốc gia hỗ trợ nghiên cứu, phát triển và ứng dụng công nghệ của công nghiệp 4.0**, với ba mục tiêu cụ thể: (1) xây dựng kho ngữ liệu đơn ngữ tiếng H'Mông và song ngữ H'Mông–Việt; (2) xây dựng kho ngữ liệu âm thanh tổng hợp tiếng H'Mông thu thập từ năm nhóm phương ngữ H'Mông khác nhau; và (3) phát triển một ứng dụng dịch Việt–H'Mông dựa trên AI, chạy được trên điện thoại, máy tính và web. Hồ sơ đăng ký được nhận đến hết tháng 6/2025.

Ba điểm đáng chú ý rút ra từ chương trình này, đặt cạnh những gì Trạm Bản đã làm:

1. **Nhà nước đã xác nhận đây là bài toán khoa học công nghệ quốc gia, không phải một ý tưởng ngách.** Việc một chương trình cấp quốc gia về công nghiệp 4.0 dành hẳn một nhiệm vụ cho riêng tiếng H'Mông cho thấy nhu cầu bình dân hóa AI cho đồng bào dân tộc thiểu số miền núi đã được nhìn nhận ở tầm chiến lược, không chỉ là mối quan tâm của một vài đơn vị nghiên cứu đơn lẻ.
2. **Chương trình quốc gia đang ở giai đoạn xây kho ngữ liệu và tìm đơn vị triển khai; Trạm Bản đã có một mô hình ASR H'Mông tinh chỉnh và một pipeline hội thoại giọng nói chạy được trên dữ liệu thật** (xem 2.2). Đây là bằng chứng khả thi (proof of feasibility) sớm, ở đúng lĩnh vực mà chương trình quốc gia đang tìm kiếm.
3. **Phạm vi chương trình quốc gia là dịch Việt–H'Mông nói chung; Trạm Bản đi theo một hướng hẹp hơn nhưng có sản phẩm cụ thể, gắn với một nhu cầu sinh tồn thật (cảnh báo thiên tai) và một địa bàn thật (Điện Biên)** — hai cách tiếp cận bổ sung cho nhau hơn là cạnh tranh: một bên xây hạ tầng ngôn ngữ nền tảng ở quy mô quốc gia, một bên chứng minh một ứng dụng đầu cuối cụ thể có thể chạy ngay trên hạ tầng ấy.

Nói ngắn gọn: nếu chính phủ đang tìm một minh chứng cho thấy "AI tiếng H'Mông cho miền núi" là khả thi và có giá trị sử dụng thật — chứ không chỉ là một bài toán nghiên cứu — thì Trạm Bản chính là hình hài cụ thể của minh chứng đó, được xây dựng và kiểm chứng độc lập trước khi chương trình quốc gia bước vào giai đoạn triển khai. Hàm ý về khả năng hợp tác/nhân rộng được trình bày chi tiết ở mục 3.4.

## 1.6. Năm câu hỏi hệ thống cần trả lời

Để một cảnh báo thực sự hữu ích, nó phải trả lời được năm câu hỏi cơ bản, theo đúng thứ tự ưu tiên của một người dân đang đứng trước rủi ro thực sự:

1. **Ở đâu** đang hoặc sắp có nguy hiểm?
2. **Khi nào** nguy hiểm có thể xảy ra?
3. **Mức độ** nguy hiểm là bao nhiêu?
4. **Ai** cần nhận cảnh báo này?
5. **Cần làm gì** ngay bây giờ?

Phần lớn các hệ thống cảnh báo hiện tại trả lời tốt câu hỏi (1) và (2) ở mức tỉnh/huyện, nhưng gần như bỏ ngỏ câu hỏi (4) và (5) — không cá nhân hóa theo người nhận, và không kèm hành động cụ thể. Trạm Bản được thiết kế để trả lời đầy đủ cả năm câu hỏi này, cho từng xã, cho từng người dân đã đăng ký, bằng đúng ngôn ngữ họ hiểu.

## 1.7. Mục tiêu và phạm vi dự án

Mục tiêu của Trạm Bản trong giai đoạn hiện tại là chứng minh tính khả thi của mô hình "cảnh báo theo xã + trợ lý giọng nói dân tộc" thông qua một sản phẩm hoạt động thực sự trên dữ liệu thật, chứ không dừng lại ở một bản thiết kế khái niệm. Phạm vi cụ thể bao gồm:

- Dự báo và phân loại mức rủi ro cho toàn bộ 45 xã/phường của tỉnh Điện Biên (theo địa giới hành chính sau sáp nhập), dựa trên dữ liệu thời tiết thật và cảnh báo sạt lở/lũ quét chính thức.
- Một trải nghiệm dành riêng cho người dân: đơn giản, trực quan, không đòi hỏi kỹ năng đọc-hiểu văn bản kỹ thuật, có trợ lý hỏi-đáp bằng giọng nói tiếng Việt hoặc tiếng H'Mông.
- Một trải nghiệm dành riêng cho cán bộ xã: đầy đủ dữ liệu chi tiết để giám sát và ra quyết định, bao gồm khả năng tự phát cảnh báo thủ công khi cần.
- Một quy trình sinh cảnh báo tự động, có kiểm soát: mức độ nguy hiểm cao nhất được tự động phát ngay; mức độ thấp hơn được đưa vào tay cán bộ địa phương để quyết định dựa trên tình hình thực tế — không giao phó hoàn toàn quyết định "có nên sơ tán hay không" cho một mô hình AI.
- Một nền tảng kỹ thuật đủ tổng quát để nhân rộng sang tỉnh khác và ngôn ngữ khác mà không phải viết lại từ đầu.

---

# Chương 2: Giải pháp — Hệ thống Trạm Bản

## 2.1. Tổng quan kiến trúc

Trạm Bản gồm hai kênh vận hành song song, dùng chung một lõi dữ liệu và bộ máy đánh giá rủi ro: một kênh **cảnh báo một chiều** (hệ thống chủ động phát khi phát hiện rủi ro) và một kênh **hội thoại hai chiều** (agent voice — người dân chủ động hỏi bất cứ lúc nào, ví dụ "ngày mai có mưa không", "tôi có nên đưa gia súc vào chuồng không", thay vì chỉ ngồi chờ nhận thông báo). Sơ đồ dưới đây thể hiện toàn bộ luồng dữ liệu từ nguồn thật đến hai giao diện đầu cuối:

```
┌────────────────────────────────────────────────────────────────┐
│  NGUỒN DỮ LIỆU THẬT                                             │
│  Open-Meteo (thời tiết) · NCHMF (sạt lở/lũ quét) · OpenStreetMap │
└──────────────────────────────┬───────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│  BỘ MÁY ĐÁNH GIÁ RỦI RO — 2.3                                     │
│   · Thang rủi ro 0–3 theo ngưỡng thật, tách theo loại hình        │
│   · Ensemble spread ECMWF/GFS/ICON → độ tin cậy dự báo — 2.3.2    │
│   · Hiệu chỉnh địa hình (downscaling) → chi tiết trong nội bộ xã  │
│     — 2.3.3                                                       │
└───────────────┬────────────────────────────────┬──────────────────┘
                │                                │
┌───────────────▼────────────────┐  ┌────────────▼─────────────────┐
│  SINH BẢN TIN AI — 2.4          │  │  AGENT VOICE — 2.2            │
│  LLM grounded, ràng buộc an     │  │  ASR H'Mông tự tinh chỉnh     │
│  toàn → bản tin VI + bản dịch   │  │  → LLM streaming → TTS,       │
│  H'Mông + audio tổng hợp        │  │  hội thoại 2 chiều real-time  │
└───────────────┬──────────────────┘  └────────────┬─────────────────┘
                │                                │
┌───────────────▼────────────────────────────────▼──────────────────┐
│  PHÂN PHỐI — Web (2.6) · SMS (2.8) · Zalo/loa xã (lộ trình — 3.2)  │
└───────────────┬────────────────────────────────┬──────────────────┘
                │                                │
┌───────────────▼─────────────────┐  ┌───────────▼──────────────────┐
│  GIAO DIỆN NGƯỜI DÂN             │  │  GIAO DIỆN CÁN BỘ XÃ          │
│  icon/màu/âm thanh, video minh   │  │  bản đồ toàn tỉnh, chọn biến  │
│  hoạ sạt lở/lũ quét, vị trí cá   │  │  hiển thị + click xem giá     │
│  nhân hoá trong xã               │  │  trị, phát cảnh báo thủ công  │
└──────────────────────────────────┘  └───────────────────────────────┘
```

Hệ thống được chia thành hai trải nghiệm tách biệt hoàn toàn về giao diện nhưng dùng chung một API và một lõi dữ liệu:

- **Người dân**: một giao diện web tối giản, mặc định hiển thị đúng xã mình đã đăng ký, ưu tiên icon/màu/âm thanh hơn số liệu, có trợ lý hỏi-đáp giọng nói nổi trên màn hình.
- **Cán bộ xã**: một giao diện quản trị đầy đủ, với bản đồ rủi ro toàn tỉnh, bản tin AI chi tiết, biểu đồ dự báo nhiều ngày, và quyền tự phát cảnh báo thủ công.

Các phần tiếp theo đi sâu vào từng module.

## 2.2. Module Agent Voice

Đây là module có giá trị khác biệt lớn nhất của Trạm Bản. Mục tiêu của module này không phải là "một chatbot có thêm giọng nói", mà là xây dựng lại toàn bộ trải nghiệm hỏi-đáp theo hướng phi văn bản, cho một ngôn ngữ mà hầu như không có công cụ AI thương mại nào hỗ trợ.

### 2.2.1. Bài toán ASR tiếng H'Mông — vì sao phải tự huấn luyện

Tiếng H'Mông thuộc nhóm ngôn ngữ Hmong-Mien, với khoảng 4–5 triệu người sử dụng trên toàn cầu, đặc trưng bởi hệ thống thanh điệu phong phú (lên đến 8 thanh điệu tuỳ phương ngữ) và sự phân mảnh đáng kể về phương ngữ vùng. Trong các ngôn ngữ có thanh điệu, biến thiên về cao độ cơ bản ($F_0$) mang tính khu biệt ngữ nghĩa: cùng một chuỗi âm vị có thể tạo thành các từ hoàn toàn khác nhau tuỳ theo đường nét thanh điệu. Điều này đặt ra yêu cầu rất cao với bộ mã hoá âm học của một mô hình ASR.

Các mô hình đa ngôn ngữ được huấn luyện trước (pre-trained) theo phương thức zero-shot — kể cả những hệ thống mã nguồn mở tuyên bố hỗ trợ hàng trăm ngôn ngữ — hầu như không nắm bắt được các đặc điểm âm học đặc thù này khi thiếu dữ liệu giám sát tương ứng, vì tiếng H'Mông là một ngôn ngữ khan hiếm tài nguyên số (low-resource language) theo đúng nghĩa: gần như không có bộ dữ liệu ASR có nhãn quy mô lớn nào công khai. Vì vậy, cách tiếp cận khả thi duy nhất là **tinh chỉnh có giám sát (supervised fine-tuning)**: tận dụng trọng số tiền huấn luyện của một mô hình nền tảng đã học được cấu trúc âm thanh-ngôn ngữ tổng quát, rồi thích ứng nó với miền âm học tiếng H'Mông thông qua một tập dữ liệu tự xây dựng.

### 2.2.2. Xây dựng bộ dữ liệu huấn luyện

Do sự khan hiếm của các bộ dữ liệu ASR tiếng H'Mông mã nguồn mở, tập dữ liệu huấn luyện được xây dựng từ đầu. Nguồn dữ liệu là các bản ghi âm tiếng H'Mông cùng văn bản phiên âm tương ứng, thu thập từ các nguồn âm thanh tôn giáo H'Mông công khai trên internet (Kinh Thánh tiếng H'Mông, gồm Cựu Ước và Tân Ước) — nguồn hiếm hoi có cả âm thanh chất lượng tốt lẫn văn bản gốc đi kèm ở quy mô đủ lớn cho việc huấn luyện.

Quá trình thu thập được thực hiện tự động qua script crawling có cơ chế theo dõi tiến độ để hỗ trợ khởi động lại khi gặp lỗi mạng. Dữ liệu thô ở dạng file âm thanh MP3 dài (từ vài phút đến hàng chục phút mỗi file) đi kèm văn bản transcript theo từng chương mục, được chuyển đổi sang WAV 16.000 Hz, kênh đơn (mono) bằng `ffmpeg`.

Vì mô hình Whisper-small chỉ nhận đầu vào tối đa 30 giây âm thanh, các file dài phải được phân đoạn thành các đoạn ngắn hơn với nhãn văn bản tương ứng. Thay vì cắt tuỳ tiện theo độ dài cố định — có thể cắt ngang câu hoặc từ — nhóm sử dụng kỹ thuật **giống hàng cưỡng bức (forced alignment)**: dùng chính một mô hình Whisper-large để xác định chính xác vị trí thời gian của từng từ trong transcript, sau đó tích luỹ các từ liền kề thành từng đoạn (chunk), mỗi đoạn mới bắt đầu khi đạt ngưỡng 25 giây hoặc khi từ hiện tại kết thúc bằng dấu câu — đảm bảo mỗi đoạn không vượt giới hạn 30 giây của mô hình trong khi vẫn giữ trọn vẹn ngữ nghĩa.

Kết quả là một tập dữ liệu gồm **36.065 phát ngôn**, tổng cộng **48,70 giờ âm thanh**, **445.124 từ** (8.788 từ độc lập), được chia ngẫu nhiên theo tỷ lệ 80/10/10 thành tập huấn luyện (28.852 phát ngôn, ≈38,96 giờ), tập xác thực (3.607 phát ngôn, ≈4,87 giờ) và tập kiểm thử nội bộ (3.606 phát ngôn, ≈4,87 giờ).

Một điểm cần lưu ý khi diễn giải kết quả: toàn bộ dữ liệu này xuất phát từ một miền duy nhất — âm thanh tôn giáo đọc văn bản, với chất lượng thu âm tương đối đồng nhất và phong cách đọc chậm, rõ ràng. Điều này có tác động trực tiếp đến khoảng cách hiệu năng giữa môi trường huấn luyện và môi trường sử dụng thực tế, được phân tích ở phần 2.2.4.

### 2.2.3. Kiến trúc mô hình và quy trình tinh chỉnh Whisper-small

**Kiến trúc nền tảng.** Mô hình được chọn làm điểm khởi đầu là **Whisper-small** của OpenAI — một Transformer Encoder-Decoder thuần (không có thành phần hồi quy hay tích chập sâu ngoài lớp trích đặc trưng đầu vào), huấn luyện trước trên 680.000 giờ audio đa ngôn ngữ. Lý do chọn biến thể "small" thay vì "base"/"tiny" hay "large": đây là điểm cân bằng hợp lý giữa năng lực biểu diễn (đủ lớn để học được đặc trưng thanh điệu phức tạp của tiếng H'Mông sau tinh chỉnh) và chi phí suy luận (đủ nhỏ để chạy thời gian thực trên một GPU đơn lẻ trong pipeline hội thoại — xem RTF ở 2.2.4), trong khi "large" tuy mạnh hơn nhưng chi phí suy luận và huấn luyện không phù hợp với ràng buộc phần cứng của một dự án hackathon.

| Thành phần | Thông số |
|---|---|
| Số tham số | ≈ 244 triệu |
| Đặc trưng đầu vào | Log-Mel Spectrogram, 80 dải lọc Mel |
| Số lớp Encoder / Decoder | 12 / 12 |
| Chiều biểu diễn ẩn (d_model) | 768 |
| Số đầu attention (mỗi khối) | 12 |
| Độ dài ngữ cảnh audio tối đa | 30 giây (1.500 khung sau downsample) |
| Kích thước từ vựng (tokenizer) | 51.865 token (đa ngôn ngữ, byte-level BPE) |

Luồng xử lý một lượt suy luận:

```
 Âm thanh 16kHz
      │
      ▼
 Log-Mel Spectrogram (80 kênh)
      │
      ▼
┌─────────────────────────┐
│   ENCODER (12 lớp)       │   Conv1D stem → Positional
│   Self-Attention +       │   Encoding → 12× khối
│   Feed-Forward           │   [Self-Attention, FFN]
└────────────┬─────────────┘
             │  biểu diễn ẩn (1.500 × 768)
             ▼
┌─────────────────────────┐
│   DECODER (12 lớp)       │   Tự hồi quy: mỗi bước dự
│   Self-Attention (masked)│   đoán 1 token, dựa trên
│   + Cross-Attention với  │   token đã sinh (self-attn)
│   biểu diễn Encoder      │   và toàn bộ audio (cross-
│   + Feed-Forward         │   attention với Encoder)
└────────────┬─────────────┘
             │
             ▼
   Chuỗi token văn bản (BPE) → chuỗi ký tự tiếng H'Mông (RPA)
```

Cơ chế cross-attention ở decoder là điểm mấu chốt cho một ngôn ngữ có thanh điệu: ở mỗi bước sinh token, decoder "nhìn lại" toàn bộ 1.500 khung biểu diễn âm học từ encoder (không chỉ trạng thái ẩn cuối cùng như kiến trúc RNN encoder-decoder cũ), cho phép mô hình truy hồi đúng đoạn tín hiệu tần số cơ bản ($F_0$) tương ứng với từng âm tiết khi cần phân biệt các từ đồng âm khác thanh điệu.

**Vì sao full fine-tuning thay vì LoRA/adapter.** Với một miền mục tiêu khác biệt sâu sắc về mặt âm học và ngôn ngữ học so với dữ liệu tiền huấn luyện (một ngôn ngữ thanh điệu, gần như không xuất hiện trong 680.000 giờ dữ liệu gốc của Whisper), các kỹ thuật tinh chỉnh tiết kiệm tham số như LoRA — vốn hiệu quả khi miền đích gần với phân phối tiền huấn luyện — có nguy cơ không đủ sức biểu diễn để mô hình học lại từ đầu cách mã hoá thanh điệu. Với quy mô tập dữ liệu ở mức vừa phải (≈49 giờ, 36.065 phát ngôn — đủ lớn để full fine-tuning không bị overfit nghiêm trọng nhưng không quá lớn để chi phí tính toán trở thành rào cản), full fine-tuning được chọn để tối đa hoá khả năng thích ứng của toàn bộ Encoder lẫn Decoder.

**Không mở rộng tokenizer.** Tiếng H'Mông trong dự án được phiên âm theo hệ chữ **RPA (Romanized Popular Alphabet)** — dùng bảng chữ cái Latin (có một số phụ âm ghép và ký tự cuối từ biểu thị thanh điệu, ví dụ `-s`, `-v`, `-j`) chứ không phải một hệ chữ viết riêng biệt như Lào hay Thái. Vì vậy, bộ tokenizer byte-level BPE đa ngôn ngữ sẵn có của Whisper (51.865 token, đã bao phủ toàn bộ không gian ký tự Latin cơ bản) được giữ nguyên, không cần huấn luyện lại hoặc mở rộng từ vựng — chỉ có trọng số attention và feed-forward mới cần thích ứng để "học" cách các tổ hợp token này biểu diễn đúng ngữ nghĩa tiếng H'Mông, không phải xây lại tầng biểu diễn ký tự từ đầu.

Toàn bộ tham số mô hình được cập nhật, tối ưu theo hàm mất mát cross-entropy chuỗi (dự đoán token tiếp theo, teacher forcing), với các siêu tham số chính:

| Siêu tham số | Giá trị |
|---|---|
| Bộ tối ưu | AdamW |
| Tốc độ học tối đa | 1×10⁻⁵, warmup tuyến tính 500 bước rồi giảm tuyến tính |
| Kích thước batch hiệu dụng | 64 (batch 16 × tích luỹ gradient 4 bước) |
| Độ chính xác tính toán | bf16-mixed |
| Số epoch tối đa / patience | 500 / dừng sớm sau 10 epoch không cải thiện val WER |

Toàn bộ quá trình huấn luyện được thực hiện bằng framework PyTorch Lightning, theo dõi qua TensorBoard, với checkpoint tốt nhất được lưu theo tiêu chí Word Error Rate (WER) trên tập xác thực.

### 2.2.4. Kết quả và phân tích

Mô hình tốt nhất, thu được tại epoch 21, đạt kết quả sau trên hai tập kiểm thử độc lập:

| Thang đo | Tập kiểm thử nội bộ | Tập kiểm thử thực tế |
|---|---|---|
| Word Error Rate (WER) | **12,35%** | **26,60%** |
| Character Error Rate (CER) | 8,68% | 12,02% |
| Real-Time Factor (RTF) | 0,0232 (nhanh hơn thời gian thực ~43 lần) | 0,0125 (~80 lần) |

Tập kiểm thử nội bộ được lấy ngẫu nhiên từ cùng phân phối nguồn với dữ liệu huấn luyện (âm thanh tôn giáo), trong khi tập kiểm thử thực tế gồm các đoạn âm thanh tự thu trong môi trường không kiểm soát — có tiếng ồn nền, đặc tính thiết bị thu âm và phong cách phát âm khác biệt hoàn toàn. Khoảng cách WER 14,25 điểm phần trăm giữa hai tập là biểu hiện điển hình của hiện tượng **dịch chuyển miền dữ liệu (domain shift)**, với ba nguyên nhân chính đã được xác định:

1. **Biến thiên âm học**: dữ liệu huấn luyện có chất lượng âm thanh tương đối đồng nhất; dữ liệu thực tế có nhiễu nền, âm vang phòng và đáp ứng tần số thiết bị hoàn toàn khác.
2. **Phong cách phát âm và tốc độ nói**: âm thanh tôn giáo đọc chậm, rõ ràng, nhịp điệu ổn định; giọng nói tự nhiên trong thực tế biến đổi mạnh, có ngập ngừng.
3. **Từ vựng ngoài tập huấn luyện (OOV)**: WER tăng mạnh (14,25 điểm) trong khi CER chỉ tăng 3,34 điểm — cho thấy mô hình vẫn nhận dạng đúng phần lớn đơn vị âm học cơ bản (ký tự, âm tiết) nhưng gặp khó khi ghép chúng thành đúng từ, đặc biệt với từ vựng chưa xuất hiện trong dữ liệu huấn luyện.

Ở mức tốc độ, RTF ở cả hai tập kiểm thử đều rất thấp, xác nhận Whisper-small hoàn toàn đáp ứng yêu cầu thời gian thực cho một ứng dụng hội thoại — điểm nghẽn hiện tại là độ chính xác trong điều kiện thực tế, không phải tốc độ xử lý.

### 2.2.5. Tổng hợp giọng nói (TTS)

Trạm Bản dùng hai mô hình TTS khác nhau tuỳ theo ngôn ngữ, phản ánh đúng chiến lược đầu tư nguồn lực hợp lý cho từng bài toán:

- **Tiếng Việt**: dùng dịch vụ TTS thần kinh của Microsoft (`edge-tts`, giọng `vi-VN-HoaiMyNeural`) — chất lượng cao, độ trễ thấp, luôn sẵn sàng vì chạy ngay trong tiến trình backend chính, không phụ thuộc vào một máy chủ GPU riêng.
- **Tiếng H'Mông**: tích hợp một mô hình TTS thần kinh kiến trúc VITS (`SynthesizerTrn`, huấn luyện với thuật toán căn chỉnh đơn điệu — monotonic alignment) đã được tinh chỉnh sẵn cho tiếng H'Mông bởi một dự án mã nguồn mở, chạy trên máy chủ mô hình GPU riêng. Khác với ASR — nơi bài toán dữ liệu và mô hình được nhóm tự giải quyết từ đầu (2.2.1–2.2.4) vì đây là thành phần quyết định cả hệ thống có "nghe hiểu" được tiếng H'Mông hay không — với TTS, nhóm chủ động lựa chọn tích hợp một mô hình đã có sẵn và đã được kiểm chứng chất lượng trong cộng đồng nguồn mở, để tập trung phần lớn công sức nghiên cứu vào khâu khó và quan trọng hơn.

Vì bộ ký tự của mô hình TTS tiếng H'Mông không hỗ trợ đầy đủ chữ số và dấu tiếng Việt, hệ thống có hai lớp xử lý văn bản trước khi đưa vào TTS: (1) một bước dịch bằng LLM chuyển toàn bộ số liệu trong bản tin (nhiệt độ, lượng mưa...) thành chữ viết ra, và (2) một bước chuẩn hoá loại bỏ dấu tiếng Việt còn sót lại trong các danh từ riêng (ví dụ tên xã) về dạng Latin thuần, tránh làm mô hình TTS gặp ký tự ngoài từ vựng và trả lỗi.

Kết hợp mô hình ASR tự tinh chỉnh với mô hình TTS tích hợp, Trạm Bản có đủ một vòng lặp giọng nói trọn vẹn cho tiếng H'Mông — nghe hiểu được người dùng nói gì, và trả lời lại bằng đúng giọng nói ấy — hiện thực hoá đúng triết lý **Zero-Literacy Design** đặt ra từ đầu dự án (mục 1.4): người dùng không cần biết đọc, không cần biết viết, chỉ cần nói bằng tiếng mẹ đẻ và nghe câu trả lời bằng chính ngôn ngữ đó.

### 2.2.6. Kiến trúc agent voice thời gian thực

Khác với một chatbot dạng hỏi-đáp từng lượt qua HTTP, trợ lý giọng nói của Trạm Bản được thiết kế như một **pipeline hội thoại thời gian thực** trên kết nối WebSocket bền vững, nhằm tối thiểu hoá độ trễ cảm nhận được — yếu tố sống còn với một giao diện giọng nói, nơi vài giây im lặng khó chịu hơn nhiều so với một trang web tải chậm.

Luồng xử lý cho mỗi lượt hội thoại:

```
[Client: phát hiện giọng nói bằng VAD]
        ↓ (đoạn âm thanh)
[WebSocket] → [ASR] → [LLM sinh câu trả lời, streaming] → [TTS theo từng câu] → [audio chunks] → [WebSocket] → [Client: hàng đợi phát audio]
```

Các đặc điểm kỹ thuật đáng chú ý:

- **Phát hiện giọng nói phía client (Voice Activity Detection)**: trình duyệt tự phân tích năng lượng tín hiệu micro theo thời gian thực để xác định khi nào người dùng bắt đầu và kết thúc nói (dựa trên ngưỡng RMS, thời gian im lặng tối thiểu để coi là kết thúc câu, và thời lượng nói tối thiểu để coi là một câu hợp lệ), thay vì bắt người dùng phải bấm giữ nút nói — gần với trải nghiệm hội thoại tự nhiên hơn.
- **TTS theo từng câu (sentence-level streaming)**: hệ thống không chờ LLM sinh xong toàn bộ câu trả lời rồi mới tổng hợp giọng nói. Ngay khi LLM hoàn thành một câu (phát hiện qua dấu câu kết thúc), câu đó được gửi đi tổng hợp giọng nói ngay lập tức, song song với việc LLM tiếp tục sinh câu tiếp theo. Âm thanh được phát theo đúng thứ tự sinh ra, bất kể câu nào tổng hợp xong trước.
- **Ngắt lời (barge-in/interrupt)**: người dùng có thể ngắt lời trợ lý bất cứ lúc nào bằng cách nói tiếp — hệ thống huỷ ngay pipeline đang chạy (kể cả khi đang phát audio) và bắt đầu lượt mới, giống một cuộc hội thoại người-người thực sự thay vì phải chờ "trợ lý nói xong" một cách máy móc.
- **Xử lý song song không chặn nhau**: việc sửa lỗi chính tả bản ghi ASR (dùng để lưu lịch sử hội thoại sạch hơn) chạy song song với việc LLM sinh câu trả lời, không làm chậm phản hồi cho người dùng.
- **Lọc ảo giác ASR**: đầu ra của mô hình ASR được kiểm tra bằng một số quy tắc heuristic đơn giản (tỷ lệ từ lặp lại bất thường, cụm từ lặp liên tiếp nhiều lần) để loại bỏ hiện tượng "ảo giác" thường gặp ở các mô hình Whisper khi gặp đoạn âm thanh quá ngắn, im lặng hoặc nhiễu — tránh đưa văn bản rác vào LLM.
- **Chế độ văn bản song song**: bên cạnh chế độ giọng nói, toàn bộ tính năng hỏi-đáp cũng có ở dạng văn bản (gõ câu hỏi, nhận câu trả lời dạng chữ có thể đọc lại), cho những người dùng thích gõ hoặc trong môi trường không tiện dùng giọng nói — cùng một lõi LLM và cùng một bộ ràng buộc, chỉ khác lớp vào/ra.

### 2.2.7. Kho tri thức và grounding

Trợ lý không trả lời từ kiến thức "bẩm sinh" chung chung của LLM. Trước mỗi lượt hội thoại, hệ thống nạp vào ngữ cảnh của mô hình một khối dữ liệu thật, gồm: mức rủi ro tổng quát hiện tại của xã đang được chọn, điều kiện thời tiết hiện tại (nhiệt độ, độ ẩm, gió...), và dự báo chi tiết từng ngày trong khoảng thời gian tới — kèm cờ đánh dấu rõ ràng ngày nào có cảnh báo sạt lở/lũ quét *chính thức* từ NCHMF, phân biệt với các tín hiệu rủi ro do hệ thống tự sàng lọc từ dữ liệu dự báo.

Mô hình được yêu cầu **chỉ được dùng đúng số liệu có trong khối dữ liệu này** — nếu người dùng hỏi về một ngày hoặc một địa điểm không có trong dữ liệu, trợ lý phải nói rõ là chưa có dữ liệu thay vì suy đoán. Đây là ràng buộc chống ảo giác (anti-hallucination) mang tính bắt buộc, không phải một gợi ý tuỳ chọn trong prompt.

### 2.2.8. Ràng buộc và AI Safety

Vì đây là một hệ thống liên quan trực tiếp đến an toàn tính mạng, các ràng buộc sau được áp dụng cứng trong toàn bộ tầng sinh nội dung (cả bản tin cảnh báo tự động lẫn agent voice hội thoại):

- **Không khẳng định chắc chắn** một thiên tai sẽ xảy ra — chỉ được diễn đạt theo đúng mức rủi ro/cảnh báo có trong dữ liệu nguồn.
- **Không tự bịa** địa điểm sơ tán, số điện thoại liên hệ, hay bất kỳ hướng dẫn nào không có căn cứ; không được đưa ra hướng dẫn trái với cảnh báo chính thức của NCHMF khi cảnh báo đó tồn tại trong dữ liệu.
- **Giới hạn phạm vi trả lời** chặt chẽ: chỉ trả lời các câu hỏi về thời tiết/rủi ro của xã đang xem, mùa vụ và chăn nuôi bị ảnh hưởng bởi thời tiết đó, và các việc cần làm để phòng tránh thiên tai. Với câu hỏi ngoài phạm vi này (ví dụ y tế khẩn cấp, hoặc hoàn toàn không liên quan), trợ lý trả lời ngắn gọn rằng câu hỏi nằm ngoài phạm vi hỗ trợ, nêu rõ mình hỗ trợ được gì — thay vì cố trả lời sai lĩnh vực.
- **Không thay thế quyết định của chính quyền địa phương**: mọi bản tin đều có disclaimer nhắc người dân đối chiếu với hướng dẫn chính thức và quan sát thực tế tại chỗ.
- **Nội dung phát ra không chứa markdown, icon hay ký hiệu trang trí** khi ở chế độ giọng nói — vì các ký tự này khi đọc thành lời (hoặc bị đọc nhầm bởi TTS) gây khó hiểu; toàn bộ định dạng markdown, emoji được lọc sạch trước khi đưa vào bước tổng hợp giọng nói.
- **Chính sách phát cảnh báo tự động có giới hạn rõ ràng**: chỉ mức rủi ro cao nhất (mức 3/3) được hệ thống tự động phát mà không cần con người phê duyệt. Các mức thấp hơn luôn được đẩy tới cán bộ xã để quyết định — AI không được trao toàn quyền quyết định "phát cảnh báo hay không" trong các tình huống còn mơ hồ.


## 2.3. Module dữ liệu và bộ máy đánh giá rủi ro

### 2.3.1. Nguồn dữ liệu thật và thang rủi ro

Trạm Bản không dùng dữ liệu mô phỏng cho phần thời tiết và cảnh báo — đây là điểm khác biệt quan trọng so với nhiều bản demo chỉ minh hoạ giao diện. Ba nguồn dữ liệu thật được tích hợp:

- **Open-Meteo**: dữ liệu dự báo thời tiết theo toạ độ (nhiệt độ, lượng mưa, gió, độ ẩm, mã điều kiện thời tiết), lấy riêng cho toạ độ trung tâm của từng xã.
- **NCHMF**: cảnh báo sạt lở đất và lũ quét chính thức, cập nhật theo chu kỳ vài giờ, là nguồn cảnh báo chuyên ngành duy nhất được hệ thống coi là "chính thức" (official warning) — phân biệt rõ với các tín hiệu rủi ro do hệ thống tự suy ra từ dữ liệu thời tiết thô.
- **OpenStreetMap**: ranh giới hành chính thật của 45 xã/phường thuộc tỉnh Điện Biên sau sáp nhập, dùng để vẽ bản đồ và xác định vị trí mô phỏng của người dân đăng ký (xem 2.7).

Từ dữ liệu thô, hệ thống tính một **mức rủi ro tổng hợp theo thang 0–3** (Bình thường / Chú ý / Nguy hiểm / Rất nguy hiểm) cho từng xã, từng ngày, dựa trên ngưỡng cụ thể của lượng mưa tích luỹ, nhiệt độ thấp nhất, tốc độ gió giật và mã điều kiện thời tiết (dông, dông kèm mưa đá...), đồng thời gắn riêng từng loại hình thái nguy hiểm đã kích hoạt (sạt lở, lũ quét, mưa lớn, sương giá, gió mạnh, dông) — không chỉ một con số duy nhất — để tầng giao diện có thể hiển thị đúng loại nguy cơ bằng icon (và, với riêng sạt lở/lũ quét, một đoạn video minh hoạ trực quan — xem 2.6.1) tương ứng thay vì một cảnh báo chung chung "có rủi ro".

Toàn bộ dữ liệu được lưu đệm (cache) theo tầng, phù hợp với chi phí thực tế của từng nguồn: cảnh báo NCHMF (một lệnh gọi cho cả tỉnh) được làm mới thường xuyên hơn dữ liệu thời tiết theo từng xã, và cả hai được làm mới thường xuyên hơn nhiều so với bản tin AI (tốn kém nhất vì phải gọi LLM) — bản tin AI chỉ được sinh lại khi có người thực sự xem đến xã đó, không sinh sẵn cho toàn bộ 45 xã mỗi lần.

### 2.3.2. Định lượng bất định bằng ensemble spread đa mô hình NWP

Một dự báo thời tiết chỉ có một con số (ví dụ "22°C") không nói cho người dùng biết con số đó đáng tin đến mức nào. Thay vì hiển thị một giá trị "chắc nịch" giả tạo, Trạm Bản tính thêm một **điểm tin cậy (confidence)** cho từng ngày dự báo của từng xã, dựa trên mức độ đồng thuận giữa nhiều mô hình dự báo số trị (NWP) độc lập — một tín hiệu bất định kiểu epistemic (model disagreement), khác với và bổ sung cho thang rủi ro ở 2.3.1.

Quy trình: với cùng một toạ độ, hệ thống gọi thêm Open-Meteo ở chế độ đa mô hình (`models=ecmwf_ifs025,gfs_seamless,icon_seamless` — ba trung tâm dự báo toàn cầu ECMWF, GFS và ICON), lấy nhiệt độ cao nhất và lượng mưa dự báo riêng của từng mô hình cho từng ngày, rồi tính độ lệch chuẩn (spread) giữa chúng. Spread càng lớn — nghĩa là các mô hình càng "cãi nhau" — độ tin cậy hiển thị càng thấp, độc lập với sai số của riêng mô hình mặc định. Spread nhiệt độ và spread lượng mưa được chuẩn hoá tương đối rồi lấy giá trị lớn hơn (bất lợi hơn) trong hai đại lượng, ánh xạ sang ba mức: **Tin cậy cao / Tin cậy trung bình / Cần theo dõi thêm**.

Lệnh gọi đa mô hình này được thực hiện độc lập, không phá vỡ luồng dự báo chính nếu Open-Meteo tạm thời không phản hồi (suy giảm nhẹ nhàng — graceful degradation: thiếu tín hiệu tin cậy chứ không mất cả dự báo). Điểm tin cậy được gắn vào từng ngày dự báo và hiển thị trực tiếp trên giao diện (một dòng ghi chú kèm số liệu spread cụ thể, ví dụ "chênh lệch mô hình 8,1mm mưa"), đồng thời được nạp vào ngữ cảnh của agent sinh bản tin (2.4): khi độ tin cậy ở mức trung bình hoặc thấp, mô hình được yêu cầu bắt buộc nêu rõ lý do bằng đúng số liệu spread thay vì chỉ lặp lại nhãn suông — biến một con số thống kê thành một câu giải thích con người đọc hiểu được.

### 2.3.3. Hiệu chỉnh theo địa hình (downscaling) và bài học từ một thất bại có kiểm soát

Dữ liệu thời tiết thô — kể cả từ Open-Meteo — vẫn là một giá trị đại diện cho cả một vùng lưới rộng, trong khi thực tế một xã ở Điện Biên có thể có chênh lệch độ cao hàng trăm mét giữa trung tâm xã và các bản xa. Trạm Bản xây dựng một lớp hiệu chỉnh riêng (terrain correction), tận dụng chính phần dữ liệu **có ground-truth thật** để huấn luyện và đánh giá — không suy đoán.

**Thu thập dữ liệu.** Với cả 45 xã/phường, hệ thống lấy 1 năm dữ liệu lịch sử (Open-Meteo Historical Weather API) song song hai chuỗi: giá trị mô hình mặc định của Open-Meteo ("raw") và một nguồn tái phân tích (reanalysis) độc lập làm ground-truth — ERA5-Land (~9km) cho nhiệt độ. Khi thử áp dụng quy trình tương tự cho lượng mưa, nhóm phát hiện bằng thực nghiệm rằng **ERA5-Land không cung cấp `precipitation_sum` trên Open-Meteo** (luôn trả về rỗng, cả theo ngày lẫn theo giờ); ground-truth cho mưa vì vậy phải chuyển sang ERA5 thường (~25–31km, thô hơn), một khác biệt về độ phân giải được ghi nhận công khai thay vì che giấu. Độ cao thật của từng xã lấy qua Open-Meteo Elevation API.

**Huấn luyện.** Với dữ liệu dạng `[độ cao, tháng] → phần dư (residual = ground-truth − raw)`, một mô hình hồi quy tuyến tính (OLS, tháng mã hoá dạng chu kỳ sin/cos) được huấn luyện — quan hệ nhiệt độ/độ cao vốn gần tuyến tính (lapse rate), không cần một mô hình phức tạp hơn.

**Kiểm định — vòng lặp thất bại rồi sửa đúng cách.** Lần thử đầu tiên chọn tay 10 xã có độ cao trải đều (8 xã huấn luyện, 2 xã giữ lại kiểm tra hoàn toàn tách biệt về mặt không gian — spatial holdout). Kết quả: MAE trên tập huấn luyện cải thiện, nhưng trên 2 xã chưa từng thấy, hiệu chỉnh lại **làm dự báo tệ đi** — bằng chứng cho thấy 10 điểm là quá ít để học một hệ số tổng quát hoá được, và một phép kiểm tra ngẫu nhiên theo thời gian (thay vì theo vị trí) đáng lẽ sẽ che giấu mất vấn đề này. Nhóm mở rộng dữ liệu huấn luyện ra toàn bộ 45 xã (36 xã huấn luyện, 9 xã giữ lại kiểm tra, chọn hệ thống theo từng bậc độ cao), thu được kết quả tổng quát hoá tốt:

| Tập | MAE trước hiệu chỉnh | MAE sau hiệu chỉnh |
|---|---|---|
| Huấn luyện (36 xã) | 0,654°C | 0,598°C |
| Kiểm tra (9 xã, chưa từng huấn luyện) | 0,759°C | **0,681°C (giảm 10,3%)** |

Với lượng mưa, cùng quy trình cho kết quả **âm tính rõ ràng**: hệ số độ cao gần như bằng 0 và MAE sau hiệu chỉnh tệ hơn trước hiệu chỉnh ở cả tập huấn luyện lẫn toàn bộ 9/9 xã kiểm tra — phản ánh đúng bản chất vật lý (mưa mang tính đối lưu/cục bộ, không tuân theo quy luật độ cao rõ ràng như nhiệt độ) và việc ground-truth mưa vốn đã thô hơn. Theo đúng nguyên tắc AI Safety xuyên suốt dự án, nhóm **quyết định không đưa hiệu chỉnh mưa vào sản phẩm** — bản đồ lượng mưa vẫn hiển thị nhưng gắn nhãn rõ là giá trị gốc, chưa hiệu chỉnh địa hình, thay vì gắn cho nó một độ chính xác không có thật.

**Triển khai.** Vì chỉ có 4 hệ số hồi quy, mô hình được đưa thẳng vào mã nguồn dưới dạng hằng số (không cần thêm phụ thuộc runtime như scikit-learn). Độ cao của 45 tâm xã và một lưới khoảng 27 điểm/xã bên trong ranh giới hành chính thật (tổng 1.209 điểm) được tính trước một lần (offline) và lưu tĩnh, để đường dẫn xử lý mỗi request không phụ thuộc thêm một lệnh gọi Elevation API nào. Phép hiệu chỉnh được áp dụng dạng **chênh lệch (delta)** giữa hai điểm cùng chia sẻ một giá trị dự báo gốc, không cộng thẳng vào giá trị thô — vì Open-Meteo tự đã áp một lapse-rate chung khi trả kết quả cho một toạ độ cụ thể; phần mô hình của Trạm Bản đóng góp thêm là **phần dư cục bộ đặc thù địa hình Điện Biên** học được từ dữ liệu thật, không phải phát minh lại quy luật lapse-rate sẵn có.

Kết quả được khai thác ở hai nơi trên giao diện: (1) bản đồ nhiệt độ dạng lưới nội suy cho cán bộ xã, hiển thị mức chênh lệch trong nội bộ một xã thay vì một giá trị đồng nhất (2.6.2); và (2) một giá trị nhiệt độ hiệu chỉnh riêng cho đúng toạ độ của người dân — toạ độ thật (GPS điện thoại) hoặc toạ độ mô phỏng hợp lệ trong ranh giới xã đã chọn (2.6.1) — thay vì chỉ hiển thị con số chung của cả xã.

## 2.4. Module sinh nội dung cảnh báo bằng AI

Khi một xã đạt mức rủi ro cần cảnh báo, một agent LLM (có khả năng gọi công cụ để lấy lại dữ liệu thời tiết/cảnh báo nếu cần) sinh ra một bản tin bằng tiếng Việt tự nhiên, có cấu trúc: mức cảnh báo, thời gian và địa điểm hiệu lực, diễn biến chính, một danh sách 3–5 hành động cụ thể cho người dân và cán bộ bản, và nguồn/thời điểm dữ liệu — toàn bộ được ràng buộc chỉ dùng đúng số liệu đã nạp vào ngữ cảnh, không được tự bịa thêm bất kỳ con số nào. Bản tin được định dạng markdown (tiêu đề, in đậm, danh sách có thứ tự) để hiển thị có cấu trúc trên giao diện cán bộ xã, và **không được chứa emoji hay ký hiệu trang trí** — giao diện đã có sẵn icon và màu sắc thật để thể hiện mức độ nguy hiểm, nội dung do AI sinh ra không cần (và không nên) tự vẽ thêm biểu tượng.

Song song, bản tin rút gọn (dùng cho SMS và cho phần audio) được dịch sang tiếng H'Mông qua một bước LLM riêng, với ràng buộc: không thêm bớt thông tin so với bản gốc, viết mọi con số thành chữ (vì bộ TTS không đọc được chữ số), giữ ngắn gọn 2–3 câu để phù hợp nghe qua loa hoặc điện thoại.

**Chính sách phát cảnh báo**: mức rủi ro 3 (Rất nguy hiểm) được hệ thống **tự động sinh và phát ngay**, không cần chờ phê duyệt thủ công — đây là mức mà tốc độ quan trọng hơn việc chờ một quy trình hành chính. Các mức 0–2 chỉ được hiển thị cho cán bộ xã dưới dạng tín hiệu cần theo dõi; cán bộ toàn quyền quyết định có phát cảnh báo thủ công hay không dựa trên quan sát thực tế tại địa bàn — kết hợp tốc độ xử lý dữ liệu của AI với phán đoán của người hiểu địa bàn, thay vì để một bên quyết định hoàn toàn. Hệ thống cũng có cơ chế chống gửi trùng: không phát lại một cảnh báo giống hệt (cùng loại hình, cùng mức độ) trong cùng một ngày, nhưng luôn phát lại ngay khi mức độ rủi ro tăng lên.

## 2.5. Module Backend

Backend là một tiến trình FastAPI duy nhất (Python), gói gọn toàn bộ nghiệp vụ: quản lý danh mục xã, lấy và chuẩn hoá dữ liệu dự báo/cảnh báo, sinh bản tin AI, quản lý tài khoản, lưu lịch sử hội thoại, và điều phối gửi cảnh báo đa kênh. Thiết kế đơn tiến trình được chọn có chủ đích cho quy mô hiện tại của dự án: giảm độ phức tạp vận hành so với kiến trúc vi dịch vụ (microservices) trong khi vẫn tách bạch rõ ràng theo module ở cấp mã nguồn (dữ liệu thời tiết, chatbot/voice, cơ sở dữ liệu, sinh nội dung... là các module Python riêng biệt, có thể tách thành dịch vụ độc lập sau này nếu cần mở rộng quy mô).

Về xác thực: người dân và cán bộ xã đăng ký/đăng nhập bằng số điện thoại và mật khẩu thật (mật khẩu được băm bằng PBKDF2 kèm salt riêng cho mỗi tài khoản, không lưu dạng thô). Đây là xác thực ở mức đủ dùng cho một bản demo/thử nghiệm thực địa — chưa có OTP, phiên đăng nhập (session/JWT) hay giới hạn tốc độ đăng nhập, và việc phân biệt vai trò người dân/cán bộ hiện chỉ nằm ở tầng giao diện, chưa có kiểm soát quyền truy cập ở tầng máy chủ. Đây là hạn chế được ghi nhận rõ ràng, cần hoàn thiện trước khi triển khai một hệ thống thật (xem Chương 4).

## 2.6. Module Frontend và trải nghiệm người dùng

Frontend được xây dựng bằng Next.js (App Router), chia thành hai trải nghiệm tách biệt hoàn toàn về giao diện dù dùng chung một API.

### 2.6.1. Trải nghiệm người dân

Đây là nơi nguyên tắc **Zero-Literacy Design** được áp dụng trực tiếp vào bài toán cảnh báo thiên tai. Thay vì một trang tổng hợp nhiều biểu đồ số liệu, trang người dân chỉ có đúng một nội dung trọng tâm: xã của mình đang có nguy cơ gì, mức độ ra sao, và cần làm gì — thể hiện bằng icon lớn, màu sắc theo đúng thang rủi ro (xanh/vàng/cam/đỏ), và một dòng hành động cụ thể duy nhất cho mỗi loại nguy cơ, thay vì bảng số liệu kỹ thuật (lượng mưa bao nhiêu mm, gió bao nhiêu km/h...). Trang mở đầu bằng một hình nền video toàn màn hình (cảnh núi rừng Điện Biên), giữ đúng tinh thần "công cụ an toàn xem nhanh ngoài trời" thay vì một khối văn bản kỹ thuật. Riêng hai loại nguy cơ nghiêm trọng nhất — sạt lở đất và lũ quét — được minh hoạ bằng một đoạn **video ngắn thay cho icon tĩnh**, giúp người xem hình dung trực quan mức độ nguy hiểm thực tế mà không cần đọc chữ; khi cả hai cùng xuất hiện, hai video được xếp cạnh nhau thành hai cột để so sánh trực tiếp. Khi có một cảnh báo mới xuất hiện trong lúc đang mở trang, hệ thống phát một **âm thanh tổng hợp riêng cho từng loại thiên tai** (tiếng ầm trầm cho sạt lở, tiếng nước dâng cho lũ quét, tiếng sấm cho dông...) — để ngay cả kênh âm thanh cũng mang thông tin, không chỉ là một tiếng "beep" chung chung.

Người dân có thể bấm **"Lấy vị trí của tôi"** để xem dự báo chi tiết hơn mức trung bình toàn xã: hệ thống lấy toạ độ (mô phỏng một điểm hợp lệ nằm trong đúng ranh giới xã đang chọn, đứng thay cho một lần đọc GPS điện thoại thật) rồi trả về nhiệt độ đã hiệu chỉnh theo địa hình tại đúng điểm đó (2.3.3), kèm mức chênh lệch so với trung tâm xã. Giao diện ghi chú rõ ràng rằng cảnh báo thiên tai (sạt lở, lũ quét) vẫn áp dụng chung cho cả xã — vì dữ liệu NCHMF chỉ có ở độ phân giải cấp xã — tránh gây hiểu lầm rằng toàn bộ nội dung trên trang đều đã được cá nhân hoá đến từng toạ độ.

Trợ lý agent voice xuất hiện dưới dạng một cửa sổ nhỏ nổi trên màn hình, luôn sẵn sàng, không chiếm diện tích chính của trang — người dân có thể mở ra hỏi bất cứ lúc nào, bằng giọng nói hoặc gõ chữ, bằng tiếng Việt hoặc tiếng H'Mông.

### 2.6.2. Trải nghiệm cán bộ xã

Cán bộ xã, ngược lại, cần đầy đủ thông tin để giám sát và ra quyết định: bản tin AI đầy đủ (không rút gọn), biểu đồ xu hướng 5 ngày, và danh sách toàn bộ cảnh báo đã phát — kèm nút tự phát cảnh báo thủ công cho xã mình quản lý, dùng được ngay cả khi mức rủi ro chưa đạt ngưỡng tự động, đúng theo nguyên tắc "AI hỗ trợ quyết định, con người ra quyết định cuối cùng". Toàn bộ các thành phần này — bản tin, panel cảnh báo, bản đồ — luôn phản ánh đúng ngày đang được chọn trên thanh dự báo 5 ngày, chứ không cố định vào "hôm nay": chọn "ngày mai" hay "3 ngày tới" sẽ cập nhật đồng bộ mọi nơi trên trang.

Bản đồ dành cho cán bộ hiển thị **toàn tỉnh**, kéo/thả và phóng to/thu nhỏ tự do — chỉ riêng xã đang được xem có màu (lớp nhiệt hiệu chỉnh theo địa hình, nội suy mượt trong đúng ranh giới xã), các xã còn lại chỉ hiện đường viền để giữ bối cảnh toàn tỉnh mà không gây rối mắt. Một ô chọn biến cho phép chuyển giữa nhiệt độ (đã hiệu chỉnh địa hình) và lượng mưa (giá trị gốc, gắn nhãn rõ chưa hiệu chỉnh — theo đúng phát hiện ở 2.3.3); bấm vào bất kỳ điểm nào trong xã đang xem sẽ hiện ngay giá trị nội suy tại đúng điểm đó, cho phép cán bộ "dò" trực quan mức chênh lệch trong nội bộ địa bàn mình quản lý thay vì chỉ nhìn một con số đại diện.

### 2.6.3. Nguyên tắc thiết kế xuyên suốt

Một nguyên tắc được giữ nhất quán trong toàn bộ giao diện người dân: **không có nội dung nào chỉ tồn tại dưới dạng số liệu hoặc chữ viết thuần tuý mà không có một kênh hình ảnh/màu sắc/âm thanh đi kèm để truyền tải cùng thông tin đó**. Đây không phải là một lựa chọn thẩm mỹ, mà là điều kiện bắt buộc để sản phẩm thực sự dùng được bởi đúng nhóm người mà dự án hướng đến.

## 2.7. Cơ sở dữ liệu

Dữ liệu được lưu trong SQLite, với các bảng chính: tài khoản người dân (số điện thoại, mật khẩu đã băm, tên, xã, và một toạ độ — hiện đang mô phỏng ngẫu nhiên nhưng nằm đúng trong ranh giới hành chính thật của xã đã chọn, thay cho vị trí GPS thật của thiết bị, để phục vụ minh hoạ các tính năng có yếu tố vị trí trong giai đoạn thử nghiệm); tài khoản cán bộ xã (gắn với đúng một xã quản lý); lịch sử hội thoại văn bản (chỉ lưu với người dân đã đăng nhập); và toàn bộ các đợt cảnh báo đã phát (tự động hoặc do cán bộ phát thủ công), kèm trạng thái và người/hệ thống đã phát.

## 2.8. Kênh phân phối đa dạng

Đúng với tinh thần "cảnh báo phải đến đúng nơi bằng đúng cách", Trạm Bản không giới hạn ở một kênh phân phối duy nhất:

- **Web**: kênh chính, đã hoàn thiện đầy đủ — dùng được ngay trên điện thoại phổ thông lẫn smartphone cấu hình thấp, không yêu cầu cài đặt ứng dụng.
- **SMS**: kênh gửi cảnh báo rút gọn qua tin nhắn, đã hoàn thiện — đảm bảo cảnh báo vẫn đến được với những hộ dân không có kết nối internet ổn định hoặc không dùng smartphone, vốn là một tỷ lệ đáng kể ở các xã vùng cao.
- **Zalo và loa truyền thanh xã**: nằm trong lộ trình mở rộng tiếp theo, tận dụng đúng kênh thông tin mà cộng đồng đã quen dùng, đặc biệt với nhóm không có điện thoại thông minh.

## 2.9. Tích hợp toàn hệ thống — một kịch bản thực tế

Để hình dung cách toàn bộ các module trên phối hợp với nhau, hãy hình dung một kịch bản cụ thể: 21 giờ tối, mưa bắt đầu tích luỹ nhanh tại một xã có địa hình dốc, nơi nhiều hộ dân sống gần khe suối.

1. Dữ liệu Open-Meteo cập nhật cho thấy lượng mưa tích luỹ vượt ngưỡng; đồng thời NCHMF phát cảnh báo lũ quét chính thức cho khu vực này.
2. Bộ máy đánh giá rủi ro (2.3) xác định mức rủi ro tổng hợp của xã là mức 3, gắn đúng loại hình "lũ quét" và "sạt lở" (nếu có) vào ngày hôm đó.
3. Vì đạt mức cao nhất, hệ thống tự động kích hoạt module sinh nội dung (2.4): một bản tin tiếng Việt được sinh ra, kèm bản dịch tiếng H'Mông và audio tổng hợp giọng nói.
4. Bản tin được phát ngay qua web (hiển thị icon lũ quét lớn, màu đỏ, kèm âm thanh cảnh báo lũ quét) và SMS tới các số điện thoại đã đăng ký tại xã đó — không cần chờ cán bộ phê duyệt.
5. Một người dân trong xã, sau khi nghe âm thanh cảnh báo, mở trợ lý agent voice và hỏi bằng tiếng H'Mông: "Tôi có nên đưa gia súc ra khỏi chuồng gần suối không?" — trợ lý trả lời bằng giọng nói, dựa đúng trên cảnh báo lũ quét đang hiệu lực cho xã của người đó, đưa ra hành động cụ thể (di chuyển gia súc và người lên vị trí cao, không đi qua suối).
6. Cán bộ xã, thông qua giao diện quản trị, thấy ngay cảnh báo đã được tự động phát, xem chi tiết bản tin AI đầy đủ, và có thể chủ động thông báo thêm qua loa truyền thanh nếu thấy cần thiết dựa trên quan sát thực địa.

Toàn bộ chuỗi này — từ lúc dữ liệu cho thấy rủi ro đến lúc người dân đầu tiên nhận được cảnh báo bằng đúng ngôn ngữ và có thể hỏi thêm bằng giọng nói — diễn ra trong vài phút, không phải hàng giờ.

---

# Chương 3: Khả thi triển khai và lộ trình thí điểm

Một hệ thống chạy tốt trên dữ liệu thật vẫn cần một con đường cụ thể để đến được tay người dùng cuối. Chương này trình bày Trạm Bản không chỉ như một sản phẩm kỹ thuật, mà như một kế hoạch triển khai có thể bắt đầu ngay ở quy mô nhỏ và mở rộng dần theo bằng chứng thực địa.

## 3.1. Mô hình triển khai và đối tác tại địa bàn

Trạm Bản không cần người dân hay cán bộ xã cài đặt bất kỳ phần mềm chuyên dụng nào — toàn bộ chạy trên trình duyệt web (giao diện đã tối ưu cho điện thoại phổ thông) và kênh SMS vốn đã quen thuộc. Điều này loại bỏ rào cản triển khai lớn nhất của nhiều giải pháp công nghệ nông thôn: chi phí và thời gian đào tạo sử dụng thiết bị/phần mềm mới. Ba nhóm đối tác tự nhiên tại địa bàn:

- **Ban Chỉ huy Phòng chống thiên tai và Tìm kiếm cứu nạn tỉnh/huyện** — đơn vị đang trực tiếp sử dụng dữ liệu NCHMF, là nơi Trạm Bản có thể cắm thẳng vào quy trình vận hành hiện có thay vì tạo thêm một kênh cảnh báo cạnh tranh.
- **Uỷ ban nhân dân xã và cán bộ phụ trách phòng chống thiên tai cấp xã** — người dùng trực tiếp của giao diện quản trị (2.6.2), đồng thời là người xác nhận tính đúng đắn của cảnh báo tại thực địa trước khi thông tin lan rộng hơn.
- **Đài truyền thanh xã/bản** — kênh phân phối "chặng cuối" cho nhóm không có smartphone hoặc không có kết nối dữ liệu ổn định, tận dụng đúng hạ tầng loa phát thanh đã có sẵn ở hầu hết các xã miền núi (xem 2.8, lộ trình tích hợp).

## 3.2. Lộ trình thí điểm ba giai đoạn

| Giai đoạn | Phạm vi | Mục tiêu chính | Tiêu chí để tiến sang giai đoạn sau |
|---|---|---|---|
| 1 — Thí điểm | 2–3 xã vùng cao Điện Biên có đông đồng bào H'Mông và lịch sử sạt lở/lũ quét | Kiểm chứng với người dùng thật: độ chính xác ASR trong điều kiện thực địa, tỷ lệ người dân dùng agent voice, phản hồi của cán bộ xã về giao diện quản trị | Tối thiểu một mùa mưa vận hành liên tục, thu thập được phản hồi định tính từ cả người dân và cán bộ |
| 2 — Mở rộng | Toàn bộ 45 xã/phường tỉnh Điện Biên | Tích hợp kênh Zalo và loa truyền thanh xã (2.8); hoàn thiện xác thực người dùng ở mức sản xuất (3.5, 4.2) | Vận hành ổn định toàn tỉnh, có số liệu định lượng về thời gian cảnh báo đến người dân so với kênh truyền thống |
| 3 — Nhân rộng | Các tỉnh miền núi khác cùng đối diện rào cản địa hình/ngôn ngữ tương tự (Sơn La, Lào Cai, Hà Giang, Cao Bằng — xem 4.3) | Tái sử dụng kiến trúc dữ liệu/rủi ro nguyên vẹn; thay thế cặp mô hình ASR/TTS theo ngôn ngữ dân tộc chiếm đa số tại từng tỉnh | Có tối thiểu một tỉnh thí điểm giai đoạn 2 hoàn tất, cùng một đối tác địa phương mới sẵn sàng đồng hành |

Cách tiếp cận theo giai đoạn này có chủ đích tránh đúng sai lầm phổ biến của các dự án công nghệ cho nông thôn: triển khai đại trà trước khi kiểm chứng được sản phẩm thực sự dùng được trong điều kiện thực địa (mạng yếu, thiết bị cũ, người dùng lớn tuổi) — thay vào đó, giai đoạn 1 được thiết kế đủ nhỏ để sai số ASR, độ trễ mạng hay bất kỳ vấn đề thực địa nào khác đều có thể quan sát và sửa được trước khi nhân rộng.

## 3.3. Chi phí vận hành và tính bền vững

Cấu trúc chi phí của Trạm Bản được thiết kế để rẻ hơn đáng kể so với việc duy trì một đội ngũ trực cảnh báo thủ công theo từng xã, và rẻ hơn nhiều lần so với thiệt hại một đợt sạt lở/lũ quét không được cảnh báo kịp thời:

- **Dữ liệu nguồn** (Open-Meteo, NCHMF, OpenStreetMap): miễn phí ở quy mô sử dụng hiện tại — không có chi phí license.
- **LLM sinh bản tin/dịch thuật/hội thoại**: tính theo lượt gọi thực tế, không phải theo xã hay theo người dùng đăng ký — kiến trúc cache theo tầng (2.3.1) giữ chi phí này tỷ lệ với mức độ sử dụng thật, không phải với quy mô danh bạ.
- **Suy luận ASR/TTS tiếng H'Mông**: hiện chạy trên GPU miễn phí (Kaggle) cho giai đoạn chứng minh khái niệm; khi vào giai đoạn 2 cần chuyển sang một máy chủ GPU thuê ổn định — đây là khoản chi phí cận biên chính khi mở rộng quy mô, và cũng là động lực trực tiếp cho hướng tối ưu hoá chạy tại biên (Edge AI) ở mục 4.3.
- **SMS**: chi phí trên mỗi tin nhắn theo nhà mạng, chỉ phát sinh khi có cảnh báo thật (không phải bản tin định kỳ) — chi phí biến đổi theo đúng tần suất thiên tai thực tế của mùa vụ.

So với mô hình hiện tại (cán bộ xã theo dõi thủ công nhiều nguồn tin rồi tự soạn thông báo, phát qua loa hoặc gọi điện từng hộ), Trạm Bản không thay thế con người trong vòng lặp quyết định (2.4) mà giảm tải phần tốn thời gian nhất — tổng hợp dữ liệu, soạn bản tin đúng ngôn ngữ, và phân phối đa kênh — để cán bộ dành thời gian cho việc chỉ con người mới làm được: quan sát thực địa và quyết định cuối cùng.

## 3.4. Phù hợp chiến lược quốc gia và cơ hội hợp tác

Như đã trình bày ở mục 1.5, việc phát triển AI cho tiếng H'Mông hiện là một nhiệm vụ thuộc Chương trình khoa học và công nghệ cấp quốc gia hỗ trợ công nghiệp 4.0 do Bộ Khoa học và Công nghệ chủ trì. Đặt trong bối cảnh khả thi triển khai, sự trùng khớp này có ba hàm ý cụ thể:

- **Tính thời điểm.** Chương trình quốc gia hiện đang ở giai đoạn xây dựng kho ngữ liệu và tuyển chọn đơn vị triển khai ứng dụng dịch; Trạm Bản đã có sẵn một mô hình ASR H'Mông tinh chỉnh, một kho dữ liệu huấn luyện tự xây dựng (2.2.2), và một pipeline hội thoại giọng nói chạy thật trên một bài toán ứng dụng cụ thể (cảnh báo thiên tai) — một vị thế thuận lợi để trở thành đối tác kỹ thuật hoặc đơn vị tham chiếu khi chương trình bước vào giai đoạn ứng dụng thực địa.
- **Bổ sung, không trùng lặp.** Mục tiêu của chương trình quốc gia là hạ tầng ngôn ngữ nền tảng (kho ngữ liệu, ứng dụng dịch thuật đa mục đích); Trạm Bản là một ứng dụng đầu-cuối gắn với một nhu cầu sinh tồn cụ thể. Hai hướng có thể phối hợp: kho ngữ liệu H'Mông–Việt của chương trình quốc gia, khi hoàn thiện, có thể trực tiếp cải thiện chất lượng ASR/dịch thuật của Trạm Bản (xem hướng cải thiện 4.3); ngược lại, quy trình thu thập dữ liệu bằng forced alignment và kinh nghiệm tinh chỉnh Whisper của nhóm (2.2.2–2.2.3) là tài sản kỹ thuật có thể đóng góp ngược lại cho chương trình.
- **Câu chuyện chính sách rộng hơn.** Việc đưa AI đến phục vụ đồng bào dân tộc thiểu số và miền núi — thay vì chỉ phục vụ nhóm người dùng đô thị đã có sẵn mọi điều kiện tiếp cận công nghệ — đúng với định hướng "bình dân hóa AI" mà nhiều chương trình chuyển đổi số quốc gia đang theo đuổi. Trạm Bản là một minh chứng cụ thể, đo lường được (WER, MAE, tỷ lệ cảnh báo đến đúng thời gian), rằng định hướng này khả thi về mặt kỹ thuật ngay ở hiện tại, không phải một mục tiêu dài hạn trừu tượng.

## 3.5. Rủi ro triển khai và biện pháp giảm thiểu

| Rủi ro | Biện pháp giảm thiểu hiện có / dự kiến |
|---|---|
| Vùng sâu, vùng xa không có sóng 3G/4G ổn định | Kênh SMS đã hoàn thiện làm phương án dự phòng (2.8); hướng Edge AI (4.3) giải quyết tận gốc cho giai đoạn dài hạn |
| Độ chính xác ASR giảm trong điều kiện thu âm thực tế (domain shift, 2.2.4) | Đã đo lường và công khai khoảng cách hiệu năng thay vì che giấu; lộ trình cải thiện cụ thể ở 4.3; chế độ văn bản song song (2.2.6) làm phương án thay thế khi giọng nói chưa đủ tin cậy |
| Người dùng lớn tuổi e ngại thiết bị/công nghệ mới | Zero-Literacy Design loại bỏ thao tác đọc-hiểu văn bản (2.6.3); tương tác chính là nói chuyện — hành vi đã quen thuộc, không phải kỹ năng mới cần học |
| Phụ thuộc một nhà cung cấp LLM/hạ tầng suy luận duy nhất | Lớp gọi LLM được trừu tượng hoá theo provider (đổi được giữa DeepSeek/OpenAI mà không sửa logic nghiệp vụ — 2.5); tương tự cho lựa chọn hạ tầng GPU khi chuyển từ Kaggle sang máy chủ thuê ở giai đoạn 2 |
| Sai lệch giữa cảnh báo AI và đánh giá thực địa của cán bộ | Theo đúng nguyên tắc xuyên suốt ở 2.4: AI không tự quyết định thay con người ở các mức rủi ro chưa rõ ràng — cán bộ luôn có quyền override dựa trên quan sát tại chỗ |

---

# Chương 4: Kết luận và hướng phát triển

## 4.1. Những gì đã đạt được

Trạm Bản đã chứng minh được tính khả thi của một mô hình cảnh báo thiên tai kết hợp ba yếu tố hiếm khi xuất hiện cùng nhau trong một sản phẩm duy nhất: (1) dữ liệu thật, có độ chi tiết đến từng xã, không phải dữ liệu mô phỏng để minh hoạ; (2) một trợ lý AI hội thoại giọng nói tiếng H'Mông xây dựng trên một mô hình ASR tự tinh chỉnh cho chính ngôn ngữ đó, thay vì phụ thuộc vào các API dịch thuật đa ngôn ngữ thương mại không hỗ trợ tiếng dân tộc; và (3) một quy trình ra quyết định rõ ràng, phân định đúng ranh giới giữa việc để AI tự động hành động (khi rủi ro đã đủ rõ ràng) và việc giữ con người trong vòng lặp quyết định (khi tình huống còn cần phán đoán tại chỗ).

Về mặt nghiên cứu, quy trình xây dựng dữ liệu và tinh chỉnh ASR tiếng H'Mông (Whisper-small, WER 12,35% trên tập nội bộ) là một đóng góp có thể tái sử dụng độc lập với riêng bài toán thời tiết, và đã được ghi nhận đầy đủ về phương pháp luận lẫn giới hạn để làm nền tảng cho các cải tiến tiếp theo. Cùng hướng nghiêm túc về phương pháp luận đó, hai bộ máy được kiểm định thực nghiệm bằng dữ liệu thật đã được bổ sung: một cơ chế định lượng độ tin cậy dự báo dựa trên ensemble spread giữa ba mô hình NWP độc lập (2.3.2), và một mô hình hiệu chỉnh nhiệt độ theo địa hình được huấn luyện và kiểm định bằng spatial holdout nghiêm ngặt trên toàn bộ 45 xã, cải thiện MAE 10,3% trên các xã hoàn toàn chưa từng huấn luyện (2.3.3) — bao gồm cả việc công khai thừa nhận và loại bỏ một nhánh hiệu chỉnh (lượng mưa) sau khi đo được nó làm dự báo tệ đi, thay vì âm thầm bỏ qua bước kiểm định.

## 4.2. Hướng phát triển

**Mở rộng vùng địa lý.** Kiến trúc dữ liệu và quy trình đánh giá rủi ro của Trạm Bản không gắn cứng với Điện Biên — miễn có dữ liệu ranh giới hành chính và dữ liệu thời tiết/cảnh báo thiên tai tương ứng, hệ thống có thể nhân rộng sang các tỉnh miền núi khác cùng đối diện rào cản địa hình và ngôn ngữ tương tự, như Sơn La, Lào Cai, Hà Giang, Cao Bằng.

**Mở rộng ngôn ngữ dân tộc thiểu số.** Khung kiến trúc agent voice (ASR → LLM → TTS, cộng với lớp ràng buộc grounding/an toàn) được thiết kế theo dạng module, không phụ thuộc vào một ngôn ngữ cụ thể. Khi mở rộng sang một tỉnh có cộng đồng dân tộc khác chiếm đa số (Thái, Tày, Nùng, Ê-đê...), phần cần thay thế chỉ là cặp mô hình ASR/TTS tương ứng — quy trình thu thập dữ liệu bằng forced alignment, tinh chỉnh Whisper và kiến trúc pipeline hội thoại có thể tái sử dụng gần như nguyên vẹn.

**Cải thiện ASR/TTS.** Theo đúng phân tích ở mục 2.2.4, các hướng cải thiện cụ thể gồm: áp dụng tăng cường dữ liệu âm thanh (SpecAugment, thêm nhiễu tổng hợp, biến đổi tốc độ nói) để giảm khoảng cách domain shift; thu thập thêm dữ liệu từ nhiều miền và phương ngữ H'Mông khác nhau, không chỉ riêng âm thanh tôn giáo; và tích hợp một mô hình ngôn ngữ ở giai đoạn giải mã để cải thiện khả năng xử lý từ vựng ngoài tập huấn luyện (OOV).

**Hiệu chỉnh địa hình cho lượng mưa.** Kết quả âm tính ở mục 2.3.3 không đóng lại hướng đi này, chỉ cho thấy cách tiếp cận tuyến tính đơn giản trên độ cao là chưa đủ. Các hướng khả thi tiếp theo: dùng đặc trưng địa hình phong phú hơn (độ dốc, hướng phơi, chỉ số vị trí địa hình TPI thay vì chỉ độ cao tuyệt đối), log-biến đổi lượng mưa trước khi hồi quy (do phân phối lệch mạnh, nhiều ngày giá trị 0), và mở rộng ground-truth sang một nguồn tái phân tích có độ phân giải cao hơn ERA5 khi Open-Meteo hỗ trợ.

**Kho tri thức chuyên sâu (RAG).** Hiện tại, kiến thức về mùa vụ và khuyến nghị nông nghiệp của trợ lý đến từ khả năng suy luận chung của LLM nền tảng. Một hướng cải thiện tự nhiên là xây dựng một kho tri thức chuyên biệt về nông nghiệp và ứng phó thiên tai tại Điện Biên, kết hợp kiến trúc truy hồi tăng cường sinh (RAG) với một cơ sở dữ liệu vector, để câu trả lời không chỉ đúng về mặt ngôn ngữ mà còn chính xác tuyệt đối về khuyến nghị chuyên môn.

**Tối ưu hoá để chạy tại biên (Edge AI).** Nhiều bản, thôn ở vùng cao không có sóng 3G/4G ổn định. Việc lượng tử hoá (quantization) toàn bộ pipeline ASR + LLM cỡ nhỏ + TTS để chạy offline trên một thiết bị di động phổ thông sẽ là điều kiện tiên quyết để Trạm Bản thực sự đến được với những hộ dân xa nhất, nơi vấn đề còn nghiêm trọng hơn cả rào cản ngôn ngữ.

## 4.3. Đối chiếu với tiêu chí đánh giá

Để tiện tra cứu, bảng dưới đây đối chiếu trực tiếp nội dung báo cáo với sáu tiêu chí chấm điểm của cuộc thi:

| Tiêu chí | Nội dung liên quan trong báo cáo | Bằng chứng cụ thể |
|---|---|---|
| **Technical Implementation & Engineering Depth** | 2.2.3 (kiến trúc Whisper, fine-tuning), 2.2.2 (forced alignment), 2.3.2–2.3.3 (ensemble, downscaling), 2.5 (backend) | Bảng thông số kiến trúc mô hình, hyperparameter đầy đủ, spatial-holdout thật với số liệu MAE trước/sau |
| **AI-Native Architecture & Innovation** | 2.2.6 (pipeline hội thoại real-time, barge-in, sentence-level TTS streaming), 2.3.2 (confidence từ ensemble NWP), 2.3.3 (delta correction theo địa hình) | Không phải "gọi API rồi hiển thị" — có tầng xử lý AI thật giữa dữ liệu thô và người dùng cuối, kiểm chứng bằng thực nghiệm |
| **Business Viability & Pilot Pathway** | Chương 3 trọn vẹn | Lộ trình 3 giai đoạn, đối tác cụ thể, cấu trúc chi phí, liên hệ chương trình khoa học công nghệ quốc gia (1.5, 3.4) |
| **AI-Native UX & Design Thinking** | 2.6 (Zero-Literacy Design), 2.6.1 (video minh hoạ, vị trí cá nhân hoá), 2.6.2 (bản đồ tương tác) | Thiết kế phi văn bản xuyên suốt, không chỉ ở lớp giọng nói mà cả icon/màu/video/âm thanh |
| **AI Safety, Grounding & Trust** | 2.2.7–2.2.8 (grounding + ràng buộc), 2.3.3 (từ chối triển khai hiệu chỉnh mưa sau khi đo được nó làm tệ đi), 2.4 (constrained generation, chính sách phát cảnh báo) | Nhiều quyết định kỹ thuật ưu tiên an toàn hơn "ấn tượng" — công khai cả kết quả âm tính |

## 4.4. Lời kết

Trạm Bản bắt đầu từ một quan sát rất nhỏ — một người mẹ không thể tự xem dự báo thời tiết trên chính chiếc điện thoại của mình — nhưng đặt ra một câu hỏi lớn hơn nhiều: điều gì sẽ xảy ra nếu những tiến bộ AI nhanh nhất hiện nay chỉ được thiết kế cho những người đã sẵn có mọi thứ — biết đọc, biết viết, thông thạo một ngôn ngữ phổ thông — trong khi những cộng đồng cần công nghệ nhất lại là những người bị nó bỏ quên đầu tiên?

Câu trả lời mà dự án theo đuổi không phải là "dịch AI sang tiếng dân tộc" như một tính năng phụ, mà là thiết kế lại từ gốc để giọng nói bản địa trở thành cách tương tác chính, không phải một lựa chọn thay thế. Cảnh báo thiên tai là bài toán đầu tiên, vì nó là nơi khoảng cách giữa "có thông tin" và "hiểu và hành động được" rõ ràng nhất và có giá trị cao nhất — nhưng nó không phải là điểm dừng. Nếu một người dân H'Mông ở Điện Biên, lần đầu tiên trong đời, có thể hỏi một cỗ máy bằng đúng tiếng mẹ đẻ của mình rằng "ngày mai trời có mưa to không" và nhận được câu trả lời đúng, rõ ràng, bằng chính giọng nói ấy — thì đó là bằng chứng sống rằng công nghệ có thể được xây dựng để không bỏ ai lại phía sau, chứ không chỉ là một khẩu hiệu.
