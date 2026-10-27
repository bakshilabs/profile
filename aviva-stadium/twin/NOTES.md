# Digital twin notes

The digital twin page is `../twin.html`. Layers, sun and shadows, four camera views and a north compass are on the page.

## Georeference fit (OpenStreetMap outline against the model footprint)

Model frame: metres, Y up, footprint centre at the origin. The east and north position of a model point is
`east = -x cos(b) + z sin(b) + te` and `north = x sin(b) + z cos(b) + tn`, with `b` the compass bearing of +Z.

| Quantity | Result |
|---|---|
| Bearing of +Z | 343.6 degrees (the viewer uses 345) |
| Spread between fits | 343.4 to 344.3 degrees (outer ring only, pitch ring only, both together) |
| Other cues | OSM inner ring long axis gives 342.9. The two OSM pitch rectangles give 344.5 and 338.9 |
| Bearing uncertainty | about 2 degrees. The profile of fit error against bearing is flat within about 342 to 345 |
| Model origin | 53.33509, -6.22822 (11.7 m east and 11.8 m south of the point used before) |
| Outer outline error | RMS 6.1 m, median 5.5 m, 90th percentile 8.8 m |
| Pitch outline error | RMS 4.3 m, median 2.0 m |
| Overlap of filled outlines | 0.90 intersection over union |

How to read this. The OSM ring and the model silhouette have the same area (35.0 and 35.3 thousand square metres), but the ring is wider across the pitch and shorter along it, so a few metres of mismatch remain at the outline. The outline alone is nearly square and cannot fix the rotation: on its own it prefers 73 degrees, which is 90 degrees away from the pitch axis. The elongated inner ring (the playing area) fixes the rotation, and its offset from the outer centroid fixes the direction of the pitch axis, so the joint fit is used. The position is good to about 3 m. The bearing of 343.6 agrees with the 345 used in the analysis page within the quoted uncertainty, so the analysis was not changed. Script: `source/twin/scripts/fit_osm.mjs`.

## Context

1,134 buildings within 420 m of the model centre, extruded from OSM footprints. Heights: 0 buildings carry a `height` tag in range, 219 carry `building:levels` (3 m per storey), 915 use the default of 2 storeys (6 m), or 1 storey for sheds and garages, or 3 storeys for apartments, offices, retail and similar types. The tallest is 12 m, so the default heights are probably too low in places. Also included: 442 road and path segments, 16 railway segments, 8 platforms, 44 green areas and 8 water features. Output: `context.glb` (1.8 MB) in this folder.

## Effect of the context buildings on winter-solstice sun (21 December)

Method: ray tracing at 10 minute steps from 778 pitch points and 674 stand points at 1.2 m above the surface, using the stadium model and, as a second set of blockers, the extruded context. Sun positions use the NOAA formulas at 53.3352 N, rotated into the model frame with the fitted bearing. Roof panels are treated as opaque, as in the existing analysis. Script: `source/twin/scripts/shade_context.mjs`.

| Case | Pitch, mean hours of direct sun | Stands, mean hours of direct sun |
|---|---|---|
| No obstruction (daylight) | 7.3 | 7.3 |
| Context only, no stadium | 6.6 | 7.0 |
| Stadium only | 0.10 | 0.27 |
| Stadium and context | 0.10 | 0.27 |
| Stadium and context 1.5 times taller | 0.10 | 0.27 |

On 21 December the sun reaches 13 degrees at noon. The stadium alone blocks almost all direct sun on the pitch. Adding the context changes no pitch point, and with all context heights raised by half, 7 of 778 pitch points lose at most 0.17 hours. The context on its own would remove about 10 per cent of the possible sun on the pitch, but the stadium already shades those hours. The 10 minute step makes the daylight figure 7.3 hours against a true 7.2 hours. The result applies to the heights above and to this solstice only, and it does not include trees.
