from __future__ import annotations

import argparse
import json
import sys

from .agent import DienBienWeatherAgent


def main() -> None:
    # PowerShell/Windows co the mac dinh CP1258, khong ma hoa duoc day du tieng Viet.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Agent canh bao thoi tiet Dien Bien")
    parser.add_argument("commune", help="Ten xa/phuong tai Dien Bien")
    parser.add_argument("--days", type=int, default=3, choices=range(1, 8))
    parser.add_argument("--question", default=None)
    parser.add_argument("--latitude", type=float, default=None)
    parser.add_argument("--longitude", type=float, default=None)
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Chi goi nguon du lieu, khong goi OpenAI (dung de kiem thu)",
    )
    args = parser.parse_args()
    agent = DienBienWeatherAgent()
    if args.raw:
        result = agent.raw_context(
            args.commune, args.days, args.latitude, args.longitude
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    result = agent.run(
        args.commune,
        args.question,
        args.days,
        args.latitude,
        args.longitude,
    )
    print(result.answer)


if __name__ == "__main__":
    main()
