"""Solar radiation and UTCI at every sample point, using Ladybug.

Inputs:  data/points.json and data/sunlit.u8 from exposure.mjs, and the Dublin EPW file.
Outputs: viewer/public/data/analysis.json (per-point metrics) and utci.u8 (hourly UTCI for the year).

For each point and hour:
  - horizontal irradiance = direct normal x sin(sun altitude) x sunlit  +  diffuse horizontal x sky view factor
  - mean radiant temperature from Ladybug's SolarCal (outdoor_sky_heat_exch), with the sunlit flag as the
    fraction of the body exposed to direct sun, the sky view factor as sky exposure, and air temperature as
    the temperature of the surrounding surfaces
  - UTCI from the air temperature, that radiant temperature, the EPW wind speed and the relative humidity

Sun positions are at the half hour, as Ladybug does for hourly EPW data, matching exposure.mjs.

Usage: python comfort.py [--limit N]
"""
import json
import math
import sys
from multiprocessing import Pool, cpu_count
from pathlib import Path

from ladybug.epw import EPW
from ladybug.location import Location
from ladybug.sunpath import Sunpath
from ladybug_comfort.solarcal import outdoor_sky_heat_exch
from ladybug_comfort.utci import universal_thermal_climate_index

HERE = Path(__file__).resolve().parent
EPW_PATH = HERE / 'weather' / 'IRL_EM_Dublin.AP.039690_TMYx.2011-2025.epw'
DATA = HERE / 'data'
OUT = HERE.parent / 'viewer' / 'public' / 'data'

HOURS = 8760
FLOOR_REFLECTANCE = 0.25      # grass and dry ground default in SolarCal; also used for the stands
DAY_HOURS = range(8, 20)      # 08:00 to 20:00 local standard time
SUMMER_DAYS = range(151, 243)  # 1 Jun to 31 Aug
WINTER_DAYS = list(range(334, 365)) + list(range(0, 59))  # 1 Dec to 28 Feb
NO_STRESS = (9, 26)           # UTCI band with no thermal stress


def utci_code(value):
    """UTCI in degrees C stored as one byte: (value + 50) x 2, so 0.5 degree steps from -50 to 77."""
    return max(0, min(255, round((value + 50) * 2)))


_ctx = {}


def init_worker():
    sun = json.loads((OUT / 'sun.json').read_text())
    location = Location('Aviva Stadium', 'IRL', latitude=sun['latitude'], longitude=sun['longitude'],
                        time_zone=sun['timeZone'], elevation=5)
    sunpath = Sunpath.from_location(location)
    epw = EPW(str(EPW_PATH))
    _ctx['alt'] = [sunpath.calculate_sun_from_hoy(h + 0.5).altitude for h in range(HOURS)]
    _ctx['db'] = list(epw.dry_bulb_temperature.values)
    _ctx['rh'] = list(epw.relative_humidity.values)
    _ctx['wind'] = list(epw.wind_speed.values)
    _ctx['dni'] = list(epw.direct_normal_radiation.values)
    _ctx['dhi'] = list(epw.diffuse_horizontal_radiation.values)
    _ctx['hir'] = list(epw.horizontal_infrared_radiation_intensity.values)
    _ctx['sunlit'] = (DATA / 'sunlit.u8').read_bytes()
    pts = json.loads((DATA / 'points.json').read_text())
    _ctx['kind'] = pts['kind']
    _ctx['svf'] = pts['svf']


def process_point(i):
    c = _ctx
    flags = c['sunlit'][i * HOURS:(i + 1) * HOURS]
    svf = c['svf'][i]
    posture = 'seated' if c['kind'][i] == 1 else 'standing'
    utci_bytes = bytearray(HOURS)
    irradiation = 0.0
    sun_year = sun_summer = sun_winter = 0
    day_total = day_comfortable = day_heat = day_cold = 0
    for h in range(HOURS):
        alt = c['alt'][h]
        lit = flags[h] if alt > 0 else 0
        sin_alt = math.sin(math.radians(alt)) if alt > 0 else 0.0
        irradiation += c['dni'][h] * sin_alt * lit + c['dhi'][h] * svf
        mrt = outdoor_sky_heat_exch(c['db'][h], c['hir'][h], c['dhi'][h], c['dni'][h], alt,
                                    svf, lit, FLOOR_REFLECTANCE, posture)['mrt']
        u = universal_thermal_climate_index(c['db'][h], mrt, c['wind'][h], c['rh'][h])
        utci_bytes[h] = utci_code(u)
        day, hour = divmod(h, 24)
        if lit:
            sun_year += 1
            if day in SUMMER_DAYS:
                sun_summer += 1
            if day in WINTER_DAYS:
                sun_winter += 1
        if hour in DAY_HOURS:
            day_total += 1
            if u > NO_STRESS[1]:
                day_heat += 1
            elif u < NO_STRESS[0]:
                day_cold += 1
            else:
                day_comfortable += 1
    return {
        'i': i, 'utci': bytes(utci_bytes),
        'sunHoursYear': sun_year, 'sunHoursSummer': sun_summer, 'sunHoursWinter': sun_winter,
        'irradiationYear': irradiation / 1000,
        'comfortablePct': 100 * day_comfortable / day_total,
        'heatStressPct': 100 * day_heat / day_total,
        'coldStressPct': 100 * day_cold / day_total,
    }


def main():
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    pts = json.loads((DATA / 'points.json').read_text())
    n = len(pts['x']) if limit is None else min(limit, len(pts['x']))
    workers = max(1, cpu_count() - 1)
    print(f'{n} points, {workers} workers')

    results = [None] * n
    with Pool(workers, initializer=init_worker) as pool:
        for done, r in enumerate(pool.imap_unordered(process_point, range(n), chunksize=4), 1):
            results[r['i']] = r
            if done % 200 == 0:
                print(f'  {done} of {n}')

    # Open-sky reference for a horizontal plane, from the same hours.
    init_worker()
    c = _ctx
    open_sky = sum(c['dni'][h] * math.sin(math.radians(c['alt'][h])) + c['dhi'][h]
                   for h in range(HOURS) if c['alt'][h] > 0) / 1000
    daylight = sum(1 for a in c['alt'] if a > 0)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'utci.u8').write_bytes(b''.join(r['utci'] for r in results))
    keys = ['sunHoursYear', 'sunHoursSummer', 'sunHoursWinter', 'irradiationYear',
            'comfortablePct', 'heatStressPct', 'coldStressPct']
    (OUT / 'analysis.json').write_text(json.dumps({
        'n': n,
        'hours': HOURS,
        'northBearingOfPlusZ': pts['northBearingOfPlusZ'],
        'pitchCell': pts['pitchCell'],
        'standCell': pts['standCell'],
        'kind': pts['kind'][:n],
        'x': pts['x'][:n], 'y': pts['y'][:n], 'z': pts['z'][:n],
        'svf': pts['svf'][:n],
        'utciEncoding': '(value + 50) * 2, one byte per point per hour, point-major',
        'daylightHours': daylight,
        'openSkyIrradiationYear': round(open_sky, 1),
        'dayHours': [DAY_HOURS.start, DAY_HOURS.stop],
        **{k: [round(r[k], 2) for r in results] for k in keys},
    }, separators=(',', ':')))

    for k in keys:
        vals = [r[k] for r in results]
        print(f'{k:18} min {min(vals):8.1f}  mean {sum(vals) / n:8.1f}  max {max(vals):8.1f}')
    print(f'open-sky horizontal irradiation {open_sky:.0f} kWh/m2, {daylight} daylight hours')


if __name__ == '__main__':
    main()
