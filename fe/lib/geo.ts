type BBox = [number, number, number, number];

function extendBBoxWithRing(bbox: BBox, ring: number[][]) {
  for (const [lon, lat] of ring) {
    if (lon < bbox[0]) bbox[0] = lon;
    if (lat < bbox[1]) bbox[1] = lat;
    if (lon > bbox[2]) bbox[2] = lon;
    if (lat > bbox[3]) bbox[3] = lat;
  }
}

export function featureBBox(feature: GeoJSON.Feature): BBox {
  const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  const geom = feature.geometry;
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) extendBBoxWithRing(bbox, ring as number[][]);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) extendBBoxWithRing(bbox, ring as number[][]);
    }
  }
  return bbox;
}

export function collectionBBox(fc: GeoJSON.FeatureCollection): BBox {
  const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of fc.features) {
    const b = featureBBox(f);
    if (b[0] < bbox[0]) bbox[0] = b[0];
    if (b[1] < bbox[1]) bbox[1] = b[1];
    if (b[2] > bbox[2]) bbox[2] = b[2];
    if (b[3] > bbox[3]) bbox[3] = b[3];
  }
  return bbox;
}

export function bboxToLngLatBounds(bbox: BBox): [[number, number], [number, number]] {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}
