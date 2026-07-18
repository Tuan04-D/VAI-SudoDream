from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from app.tools.landslide import LandslideService


SAMPLE = {
    "source": "test",
    "fetched_at": "2099-01-01T00:00:00+00:00",
    "records": [
        {
            "commune_id_2cap": 1,
            "commune_name_2cap": "Tủa Chùa",
            "commune_name": "Xã Mường Báng",
            "district_name": "Tủa Chùa",
            "provinceName": "Điện Biên",
            "nguycosatlo": "Trung bình",
            "nguycoluquet": "Cao",
            "lat": 21.9,
            "lon": 103.4,
        },
        {
            "commune_id_2cap": 1,
            "commune_name_2cap": "Tủa Chùa",
            "commune_name": "Xã Sính Phình",
            "district_name": "Tủa Chùa",
            "provinceName": "Điện Biên",
            "nguycosatlo": "Rất cao",
            "nguycoluquet": "Cao",
            "lat": 21.95,
            "lon": 103.4,
        },
        {
            "commune_id_2cap": 2,
            "commune_name_2cap": "Sín Chải",
            "commune_name": "Xã Tả Phìn",
            "district_name": "Tủa Chùa",
            "provinceName": "Điện Biên",
            "nguycosatlo": "Cao",
            "nguycoluquet": "Cao",
            "lat": 22.0,
            "lon": 103.5,
        },
    ],
}


class LandslideServiceTests(TestCase):
    def test_match_accent_and_keep_highest_risk(self):
        with TemporaryDirectory() as temp:
            service = LandslideService(Path(temp) / "cache.json")
            with patch.object(service, "refresh", return_value=SAMPLE):
                result = service.get_warnings("Tua Chua")
        self.assertEqual(result["warning_count"], 1)
        self.assertEqual(result["risk_scale"]["level"], 3)
        self.assertEqual(result["warnings"][0]["landslide_risk"], "Rất cao")

    def test_find_coordinates_from_former_commune(self):
        with TemporaryDirectory() as temp:
            service = LandslideService(Path(temp) / "cache.json")
            with patch.object(service, "refresh", return_value=SAMPLE):
                coordinates = service.find_coordinates("Mường Báng")
        self.assertEqual(coordinates, (21.9, 103.4))
