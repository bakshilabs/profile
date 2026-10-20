"""Export Ladybug sun positions for the viewer.

Sun altitude and azimuth for every 10 minutes of a non-leap year at the stadium, in local
standard time (Dublin is UTC+0, no daylight saving). Values are in tenths of a degree.
"""
import json
from pathlib import Path

from ladybug.location import Location
from ladybug.sunpath import Sunpath

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'viewer' / 'public' / 'data' / 'sun.json'
STEP_MIN = 10

location = Location('Aviva Stadium', 'IRL', latitude=53.3352, longitude=-6.2284,
                    time_zone=0, elevation=5)
sunpath = Sunpath.from_location(location)

alt, az = [], []
for day in range(365):
    for minute in range(0, 24 * 60, STEP_MIN):
        sun = sunpath.calculate_sun_from_hoy(day * 24 + minute / 60)
        alt.append(round(sun.altitude * 10))
        az.append(round(sun.azimuth * 10) % 3600)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    'latitude': location.latitude,
    'longitude': location.longitude,
    'timeZone': location.time_zone,
    'stepMinutes': STEP_MIN,
    'unit': 'tenths of a degree',
    'altitude': alt,
    'azimuth': az,
}, separators=(',', ':')))
print(f'wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB), {len(alt)} samples')
