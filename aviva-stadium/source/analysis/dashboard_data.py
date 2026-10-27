"""Data for the interactive analysis page.

Inputs:  data/annual/points.json and sunlit.bits (annual_exposure.mjs) and the Dublin EPW file.
Outputs: viewer/public/data/dash/
           points.json    sample points: position, kind (0 pitch, 1 stand), sky view factor, stand section
           weather.json   hourly weather and sun position for the typical year
           sunlit.bits    packed sun and shade flags, hour-major (copied)
           utci.u8        UTCI per point per hour, one byte, hour-major: (UTCI + 50) x 2

Per point and hour, with the same method as the film:
  - mean radiant temperature from SolarCal (outdoor_sky_heat_exch), with the sunlit flag as the fraction of the
    body exposed to direct sun, the sky view factor as sky exposure and air temperature as the temperature of
    the surrounding surfaces
  - UTCI from air temperature, that radiant temperature, wind speed and relative humidity
Stand points are treated as seated people and pitch points as standing people. Sun positions are at the half
hour, as Ladybug does for hourly EPW data.

Usage: python dashboard_data.py
"""
import json
import math
import shutil
from multiprocessing import Pool, cpu_count
from pathlib import Path

from ladybug.epw import EPW
from ladybug.location import Location
from ladybug.sunpath import Sunpath
from ladybug_comfort.solarcal import outdoor_sky_heat_exch
from ladybug_comfort.utci import universal_thermal_climate_index

HERE = Path(__file__).resolve().parent
EPW_PATH = HERE / 'weather' / 'IRL_EM_Dublin.AP.039690_TMYx.2011-2025.epw'
DATA = HERE / 'data' / 'annual'
OUT = HERE.parent / 'viewer' / 'public' / 'data' / 'dash'
SUN_JSON = HERE.parent / 'viewer' / 'public' / 'data' / 'sun.json'

HOURS = 8760
CHUNK = 24
FLOOR_REFLECTANCE = 0.25
SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

_ctx = {}


def load_weather():
    sun = json.loads(SUN_JSON.read_text())
    location = Location('Aviva Stadium', 'IRL', latitude=sun['latitude'], longitude=sun['longitude'],
                        time_zone=sun['timeZone'], elevation=5)
    sunpath = Sunpath.from_location(location)
    epw = EPW(str(EPW_PATH))
    suns = [sunpath.calculate_sun_from_hoy(h + 0.5) for h in range(HOURS)]
    return epw, {
        'alt': [s.altitude for s in suns],
        'az': [s.azimuth for s in suns],
        'db': list(epw.dry_bulb_temperature.values),
        'rh': list(epw.relative_humidity.values),
        'wind': list(epw.wind_speed.values),
        'dni': list(epw.direct_normal_radiation.values),
        'dhi': list(epw.diffuse_horizontal_radiation.values),
        'ghi': list(epw.global_horizontal_radiation.values),
        'hir': list(epw.horizontal_infrared_radiation_intensity.values),
    }


def init_worker():
    _, _ctx['w'] = load_weather()
    pts = json.loads((DATA / 'points.json').read_text())
    _ctx['kind'], _ctx['svf'] = pts['kind'], pts['svf']
    _ctx['bph'] = pts['bytesPerHour']
    _ctx['bits'] = (DATA / 'sunlit.bits').read_bytes()


def process_chunk(task):
    h0, h1 = task
    w, kind, svf, bph, bits = _ctx['w'], _ctx['kind'], _ctx['svf'], _ctx['bph'], _ctx['bits']
    n = len(kind)
    out = bytearray()
    for h in range(h0, h1):
        alt, db, rh, wind, dni, dhi, hir = (w['alt'][h], w['db'][h], w['rh'][h], w['wind'][h],
                                            w['dni'][h], w['dhi'][h], w['hir'][h])
        base = h * bph
        for i in range(n):
            lit = (bits[base + (i >> 3)] >> (i & 7)) & 1 if alt > 0 else 0
            mrt = outdoor_sky_heat_exch(db, hir, dhi, dni, alt, svf[i], lit, FLOOR_REFLECTANCE,
                                        'seated' if kind[i] == 1 else 'standing', 135)['mrt']
            u = universal_thermal_climate_index(db, mrt, wind, rh)
            out.append(max(0, min(255, round((u + 50) * 2))))
    return h0, bytes(out)


def main():
    pts = json.loads((DATA / 'points.json').read_text())
    n = len(pts['x'])
    workers = max(1, cpu_count() - 1)
    tasks = [(h, min(h + CHUNK, HOURS)) for h in range(0, HOURS, CHUNK)]
    print(f'{n} points, {HOURS} hours, {len(tasks)} tasks on {workers} workers')

    chunks = {}
    with Pool(workers, initializer=init_worker) as pool:
        for done, (h0, data) in enumerate(pool.imap_unordered(process_chunk, tasks), 1):
            chunks[h0] = data
            if done % 60 == 0:
                print(f'  {done} of {len(tasks)}')

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'utci.u8').write_bytes(b''.join(chunks[h0] for h0, _ in tasks))
    shutil.copyfile(DATA / 'sunlit.bits', OUT / 'sunlit.bits')

    # Stand sections by compass bearing from the pitch centre, in 45 degree sectors centred on N, NE, E, ...
    pitch = [i for i in range(n) if pts['kind'][i] == 0]
    cx = sum(pts['x'][i] for i in pitch) / len(pitch)
    cz = sum(pts['z'][i] for i in pitch) / len(pitch)
    north = pts['northBearingOfPlusZ']
    sector = []
    for i in range(n):
        if pts['kind'][i] == 0:
            sector.append(-1)
            continue
        delta = math.degrees(math.atan2(-(pts['x'][i] - cx), pts['z'][i] - cz))
        bearing = (north + delta) % 360
        sector.append(int(((bearing + 22.5) % 360) // 45))
    (OUT / 'points.json').write_text(json.dumps({
        'n': n, 'nPitch': len(pitch), 'pitchCell': pts['pitchCell'], 'standCell': pts['standCell'],
        'pointHeight': pts['pointHeight'], 'bytesPerHour': pts['bytesPerHour'], 'hours': HOURS,
        'northBearingOfPlusZ': north, 'pitchCentre': [round(cx, 2), round(cz, 2)],
        'sectors': SECTORS, 'kind': pts['kind'], 'sector': sector,
        'x': pts['x'], 'y': pts['y'], 'z': pts['z'], 'svf': pts['svf'],
    }, separators=(',', ':')))

    epw, w = load_weather()
    loc = epw.location
    (OUT / 'weather.json').write_text(json.dumps({
        'station': {'name': 'Dublin Airport', 'latitude': loc.latitude, 'longitude': loc.longitude,
                    'elevation': loc.elevation, 'period': 'Typical year from 2011 to 2025'},
        **{k: [round(v, 3 if k in ('alt', 'az') else 2) for v in vals] for k, vals in w.items()},
    }, separators=(',', ':')))
    print(f'wrote {OUT}: utci.u8 {(OUT / "utci.u8").stat().st_size / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
