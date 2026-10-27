"""Frame schedule for the three day-sweep shots.

One frame is one simulated minute, so 60 fps plays one simulated hour per second. Each shot runs from
15 minutes before sunrise to 15 minutes after sunset. Sun positions come from Ladybug at each frame.
Weather comes from the typical-year EPW, interpolated linearly between hours (an hourly value describes
the hour around its half-hour mark).

The nominal solstice and equinox days in a typical year are overcast, so each shot uses the clearest day
within a week of its date, which keeps temperature, wind, sky infrared and sun consistent with each other.

Output: data/shots_frames.json
"""
import json
from pathlib import Path

from ladybug.dt import DateTime
from ladybug.epw import EPW
from ladybug.location import Location
from ladybug.sunpath import Sunpath

HERE = Path(__file__).resolve().parent
EPW_PATH = HERE / 'weather' / 'IRL_EM_Dublin.AP.039690_TMYx.2011-2025.epw'
SUN_JSON = HERE.parent / 'viewer' / 'public' / 'data' / 'sun.json'
OUT = HERE / 'data' / 'shots_frames.json'

MINUTES_PER_FRAME = 1.0
MARGIN_MIN = 15
# name, title, nominal day index (0 = 1 Jan), window of days either side to search for the clearest day
SHOTS = [
    ('summer', 'Summer solstice', 171),
    ('equinox', 'Spring equinox', 79),
    ('winter', 'Winter solstice', 354),
]
SEARCH_DAYS = 7

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

site = json.loads(SUN_JSON.read_text())
location = Location('Aviva Stadium', 'IRL', latitude=site['latitude'], longitude=site['longitude'],
                    time_zone=site['timeZone'], elevation=5)
sunpath = Sunpath.from_location(location)
epw = EPW(str(EPW_PATH))
series = {
    'db': list(epw.dry_bulb_temperature.values),
    'rh': list(epw.relative_humidity.values),
    'wind': list(epw.wind_speed.values),
    'dni': list(epw.direct_normal_radiation.values),
    'dhi': list(epw.diffuse_horizontal_radiation.values),
    'hir': list(epw.horizontal_infrared_radiation_intensity.values),
}
ghi = list(epw.global_horizontal_radiation.values)


def interpolate(values, day, minute):
    """Hourly value at a clock time; hour h is centred on h + 0.5."""
    pos = min(max(day * 24 + minute / 60 - 0.5, 0), len(values) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (pos - lo)


shots = []
for name, title, nominal in SHOTS:
    day = max(range(nominal - SEARCH_DAYS, nominal + SEARCH_DAYS + 1),
              key=lambda d: sum(ghi[d * 24:d * 24 + 24]))
    dt = DateTime.from_hoy(day * 24)
    sun_times = sunpath.calculate_sunrise_sunset(dt.month, dt.day)
    rise = sun_times['sunrise'].hour * 60 + sun_times['sunrise'].minute
    set_ = sun_times['sunset'].hour * 60 + sun_times['sunset'].minute
    start = rise - MARGIN_MIN
    count = int((set_ + MARGIN_MIN - start) / MINUTES_PER_FRAME) + 1
    minutes = [start + k * MINUTES_PER_FRAME for k in range(count)]
    alt, az = [], []
    for m in minutes:
        sun = sunpath.calculate_sun_from_hoy(day * 24 + m / 60)
        alt.append(round(sun.altitude, 3))
        az.append(round(sun.azimuth, 3))
    shot = {
        'name': name,
        'title': title,
        'dayIndex': day,
        'month': dt.month,
        'day': dt.day,
        'dateLabel': f'{dt.day} {MONTHS[dt.month - 1]}',
        'nominalLabel': f'{DateTime.from_hoy(nominal * 24).day} {MONTHS[DateTime.from_hoy(nominal * 24).month - 1]}',
        'sunrise': rise, 'sunset': set_,
        'ghiKwhM2': round(sum(ghi[day * 24:day * 24 + 24]) / 1000, 2),
        'frames': count,
        'minutes': minutes,
        'altitude': alt,
        'azimuth': az,
    }
    for key, values in series.items():
        shot[key] = [round(interpolate(values, day, m), 2) for m in minutes]
    shots.append(shot)
    print(f"{name:8} {shot['dateLabel']:7} (nominal {shot['nominalLabel']}) sunrise {rise // 60:02d}:{rise % 60:02d} "
          f"sunset {set_ // 60:02d}:{set_ % 60:02d}  {count} frames  GHI {shot['ghiKwhM2']} kWh/m2")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({'fps': 60, 'minutesPerFrame': MINUTES_PER_FRAME, 'shots': shots}, separators=(',', ':')))
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB), {sum(s['frames'] for s in shots)} frames in total")
