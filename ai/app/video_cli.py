from __future__ import annotations

import argparse
import json
import sys

from .agent import AgentConfigurationError
from .video_hazard import VideoAnalysisError, VideoHazardAgent, format_report


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Đánh giá dấu hiệu sạt lở và ngập lụt từ một video ngắn."
    )
    parser.add_argument("video", help="Đường dẫn video MP4, MOV hoặc AVI (tối đa 2 phút)")
    parser.add_argument(
        "--location",
        default=None,
        help="Nhãn địa điểm do người vận hành cung cấp (không bắt buộc)",
    )
    output_group = parser.add_mutually_exclusive_group()
    output_group.add_argument(
        "--report",
        action="store_true",
        help="In báo cáo tiếng Việt dễ đọc thay vì JSON mặc định",
    )
    output_group.add_argument(
        "--json",
        action="store_true",
        help="In JSON đánh giá (đây là định dạng mặc định)",
    )
    args = parser.parse_args()

    try:
        result = VideoHazardAgent().analyze(args.video, args.location)
    except (AgentConfigurationError, VideoAnalysisError) as exc:
        print(f"Lỗi: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    except Exception:
        print("Lỗi: Không thể hoàn tất phân tích video. Kiểm tra cấu hình OpenAI.", file=sys.stderr)
        raise SystemExit(1)

    if args.report:
        print(format_report(result))
    else:
        print(json.dumps(result.assessment, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
