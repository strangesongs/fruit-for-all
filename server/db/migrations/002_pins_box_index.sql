-- Map views ask for finds inside a lat/lng box. A geography box has great-circle
-- edges (it bulges a little), so the box test runs on the planar geometry, which
-- matches the DynamoDB filter (minLat <= lat <= maxLat, minLng <= lng <= maxLng)
-- exactly. This index is what that query uses; pins_location (geography) stays
-- for distance queries ("nearest", the admin view).
create index pins_location_geom on pins using gist ((location::geometry));
