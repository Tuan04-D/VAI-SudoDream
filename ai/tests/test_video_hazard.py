import asyncio
import json
import sys
import tempfile
from io import BytesIO, StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from fastapi import UploadFile
from fastapi.testclient import TestClient

from app.api import analyze_video_hazard, app
from app.config import Settings
from app.video_hazard import (
    VideoAnalysisError,
    VideoHazardAgent,
    extract_video_frames,
    format_report,
)
from app import video_cli


class FakeBuffer:
    def __init__(self, value: bytes):
        self.value = value

    def tobytes(self) -> bytes:
        return self.value


class FakeCapture:
    def __init__(self, *, fps: float, frame_count: int):
        self.fps = fps
        self.frame_count = frame_count
        self.position = 0
        self.released = False

    def isOpened(self) -> bool:
        return True

    def get(self, property_id: int) -> float:
        return {
            FakeCV2.CAP_PROP_FPS: self.fps,
            FakeCV2.CAP_PROP_FRAME_COUNT: self.frame_count,
            FakeCV2.CAP_PROP_FRAME_WIDTH: 1920,
            FakeCV2.CAP_PROP_FRAME_HEIGHT: 1080,
        }[property_id]

    def set(self, property_id: int, value: int) -> None:
        if property_id == FakeCV2.CAP_PROP_POS_FRAMES:
            self.position = int(value)

    def read(self):
        return self.position < self.frame_count, bytes([self.position])

    def release(self) -> None:
        self.released = True


class FakeCV2:
    CAP_PROP_FPS = 1
    CAP_PROP_FRAME_COUNT = 2
    CAP_PROP_FRAME_WIDTH = 3
    CAP_PROP_FRAME_HEIGHT = 4
    CAP_PROP_POS_FRAMES = 5

    def __init__(self, *, fps: float, frame_count: int):
        self.capture = FakeCapture(fps=fps, frame_count=frame_count)

    def VideoCapture(self, _: str) -> FakeCapture:
        return self.capture

    @staticmethod
    def imencode(_: str, image: bytes):
        return True, FakeBuffer(b"jpeg-" + image)


class FakeResponses:
    def __init__(self, output_text: str):
        self.output_text = output_text
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.output_text)


class VideoHazardTests(TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.video_path = Path(self.temp_directory.name) / "slope.mp4"
        self.video_path.touch()

    def tearDown(self):
        self.temp_directory.cleanup()

    def test_extracts_at_most_twelve_evenly_spaced_frames(self):
        fake_cv2 = FakeCV2(fps=12, frame_count=24)
        with patch.dict(sys.modules, {"cv2": fake_cv2}):
            metadata, frames = extract_video_frames(self.video_path)

        self.assertEqual(metadata.duration_seconds, 2)
        self.assertEqual(len(frames), 12)
        self.assertEqual(frames[0].timestamp_seconds, 0)
        self.assertEqual(frames[-1].timestamp_seconds, 1.92)
        self.assertTrue(fake_cv2.capture.released)

    def test_rejects_video_over_two_minutes_before_reading_frames(self):
        fake_cv2 = FakeCV2(fps=1, frame_count=121)
        with patch.dict(sys.modules, {"cv2": fake_cv2}):
            with self.assertRaisesRegex(VideoAnalysisError, "giới hạn"):
                extract_video_frames(self.video_path)

    def test_agent_submits_timestamped_images_and_normalizes_assessment(self):
        fake_cv2 = FakeCV2(fps=2, frame_count=2)
        responses = FakeResponses(
            json.dumps(
                {
                    "landslide_risk": "high",
                    "flood_risk": "not-a-level",
                    "observed_hazards": [
                        {
                            "hazard": "Đất đá trôi",
                            "evidence": "Bùn đất che một phần đường.",
                            "frame_timestamps_seconds": [0, "0.5"],
                        }
                    ],
                    "limitations": ["Video bị rung."],
                    "recommended_actions": ["Tránh đi vào khu vực dốc."],
                    "advisory": "Cần kiểm tra hiện trường ngay.",
                },
                ensure_ascii=False,
            )
        )
        settings = Settings(
            openai_api_key="test",
            openai_model="test-vision-model",
            landslide_refresh_hours=6,
            http_timeout_seconds=30,
            landslide_cache_path=Path("unused.json"),
        )
        agent = VideoHazardAgent(
            settings=settings, client=SimpleNamespace(responses=responses)
        )

        with patch.dict(sys.modules, {"cv2": fake_cv2}):
            result = agent.analyze(self.video_path, "  Suối Lư  ")

        content = responses.calls[0]["input"][0]["content"]
        images = [item for item in content if item["type"] == "input_image"]
        self.assertEqual(len(images), 2)
        self.assertTrue(images[0]["image_url"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(result.location, "Suối Lư")
        self.assertEqual(result.assessment["landslide_risk"], "high")
        self.assertEqual(result.assessment["flood_risk"], "indeterminate")
        self.assertIn("Nguy cơ sạt lở", format_report(result))
        self.assertEqual(result.to_dict()["model"], "test-vision-model")

    def test_cli_prints_only_assessment_json_by_default(self):
        assessment = {
            "landslide_risk": "moderate",
            "flood_risk": "low",
            "observed_hazards": [],
            "limitations": ["Khung hình bị mờ."],
            "recommended_actions": ["Kiểm tra thực địa."],
            "advisory": "Cần thận trọng.",
        }
        result = SimpleNamespace(assessment=assessment)
        output = StringIO()
        with (
            patch("app.video_cli.VideoHazardAgent") as agent_class,
            patch.object(sys, "argv", ["video_cli.py", "test.mp4"]),
            patch("sys.stdout", output),
        ):
            agent_class.return_value.analyze.return_value = result
            video_cli.main()

        self.assertEqual(json.loads(output.getvalue()), assessment)

    def test_api_returns_assessment_json_and_removes_uploaded_video(self):
        assessment = {
            "landslide_risk": "high",
            "flood_risk": "low",
            "observed_hazards": [],
            "limitations": [],
            "recommended_actions": ["Tránh khu vực nguy hiểm."],
            "advisory": "Cần kiểm tra hiện trường.",
        }
        uploaded_video = UploadFile(filename="clip.mp4", file=BytesIO(b"video-bytes"))
        captured_paths = []

        def analyze(path, location):
            captured_paths.append(Path(path))
            self.assertTrue(captured_paths[0].is_file())
            self.assertEqual(location, "Tủa Chùa")
            return SimpleNamespace(assessment=assessment)

        with patch("app.api.video_hazard_agent.analyze", side_effect=analyze):
            response = asyncio.run(analyze_video_hazard(uploaded_video, "Tủa Chùa"))

        self.assertEqual(response, assessment)
        self.assertFalse(captured_paths[0].exists())

    def test_api_endpoint_accepts_multipart_video_and_returns_assessment(self):
        assessment = {
            "landslide_risk": "low",
            "flood_risk": "moderate",
            "observed_hazards": [],
            "limitations": ["Video ngắn."],
            "recommended_actions": [],
            "advisory": "Theo dõi thêm.",
        }
        client = TestClient(app)
        try:
            with patch("app.api.video_hazard_agent.analyze") as analyze:
                analyze.return_value = SimpleNamespace(assessment=assessment)
                response = client.post(
                    "/api/v1/video-hazard",
                    files={"video": ("clip.mp4", b"video-bytes", "video/mp4")},
                    data={"location": "Tủa Chùa"},
                )
        finally:
            client.close()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), assessment)
