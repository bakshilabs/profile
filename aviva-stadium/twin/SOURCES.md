# Digital twin: data sources and licences

## Data used

| Source | What | Size |
|---|---|---|
| OpenStreetMap, Overpass API | Buildings, railway, highways, water, leisure and landuse features within 650 m of 53.3352, -6.2284, with geometry. Fetched 20 October 2026 (database timestamp 2026-10-20T21:10:10Z). | 3.4 MB |
| Copernicus Sentinel-2 L2A | A 236 by 236 pixel window (10 m pixels) of the true-colour image. The whole file is 299 MB and was not downloaded. | 2.3 MB |

No account, key or token was used. The raw downloads are not included here. The scripts in `source/twin/scripts` fetch them again.

## Map data

- Source: OpenStreetMap contributors, through the Overpass API.
- Licence: Open Database Licence 1.0 (ODbL). The Overpass response states this itself. The OpenStreetMap copyright page says to credit OpenStreetMap by displaying its attribution notice and to make clear that the data is available under the ODbL.
- Attribution used on the twin page: "Map data © OpenStreetMap contributors, available under the Open Database Licence".
- Use here: the stadium outline for georeferencing, building footprints for extrusion, roads, railway, platforms, green space and water. The context model (`context.glb`) is a produced work built from this data. The underlying footprints are not published as data.

## Ground imagery

- Source: Copernicus Sentinel-2, product `S2B_T29UPV_20260708T114435_L2A` (Collection 1, Level-2A), tile T29UPV, true-colour image band.
- Acquired: 8 July 2026, 11:44 UTC. Scene cloud cover 0.55 per cent. The window around the stadium is cloud free.
- Resolution: 10 m per pixel. The stadium is about 20 pixels across, so this is a coarse backdrop. It shows roads, rivers, parks and the railway cutting but no building detail. A few small coloured smudges are aircraft that were caught at slightly different moments by the sensor's colour bands.
- Access: the public Sentinel-2 archive, through its STAC catalogue, with no key. Only the small window was read.
- Licence: the Copernicus Sentinel data licence (revision 1), published at https://ads.atmosphere.copernicus.eu/licences/ec-sentinel. It allows reproduction, distribution, communication to the public, and adaptation, modification and combination with other data.
- Required attribution: "Contains modified Copernicus Sentinel data 2026". The page uses "Imagery: contains modified Copernicus Sentinel data 2026".
- Processing: resampled with a bicubic filter from UTM zone 29N onto a true-north grid of 1,600 m by 1,600 m (2,048 pixels, 0.78 m per output pixel, which does not add detail), then made slightly brighter and less saturated for the page. File: `ground_web.jpg`. Script: `source/twin/scripts/fetch_sentinel.mjs`.

## Imagery that was considered and not used

- No openly licensed aerial imagery sharper than about 1 m was found for the stadium. Sentinel-2 at 10 m is the best open option found. The twin therefore adds crisp roads, rail, water and green areas from OpenStreetMap on top of the coarse imagery.
- Imagery from commercial map services was not used, because their terms do not allow it to be saved and reused.
- National mapping agency aerial imagery at 15 cm to 25 cm exists for Dublin, but it is supplied under licence only.
- One open aerial survey (CC BY 4.0) appears to cover an area about 2 km west of the stadium, so it was not used.

## Model credit

Stadium model by S.Gandini, CC BY 4.0. See the link in the project README.
