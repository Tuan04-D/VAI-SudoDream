import re
import unicodedata

import torch
from pytorch_lightning import seed_everything


def seed_all(seed: int) -> None:
    seed_everything(seed, workers=True)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def normalize_text(text: str) -> str:
    lowered = text.lower()
    no_punct = "".join(
        ch for ch in lowered if not unicodedata.category(ch).startswith("P")
    )
    normalized = re.sub(r"\s+", " ", no_punct).strip()
    return normalized
