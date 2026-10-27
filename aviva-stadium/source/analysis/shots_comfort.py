"""Per-frame thermal comfort and accumulated solar energy for the day-sweep shots.

Inputs:  data/shots_frames.json (shots_frames.py) and data/shots/ (shots_exposure.mjs).
Outputs: viewer/public/data/film/
           points.json            sample point positions, kind (0 pitch, 1 stand) and sky view factor
           index.json             shot list, UTCI categories and the colour-scale maxima
           <shot>.json            frame times, sun, weather and the chart series
           <shot>.utci.u8         one byte per point per frame, (UTCI + 50) x 2, frame-major
           <shot>.irr.u16         accumulated horizontal irradiation in Wh/m2 per point per frame, frame-major

Per point and frame, using Ladybug:
  - mean radiant temperature from SolarCal (outdoor_sky_heat_exch), with the sunlit flag as the fraction of the
    body exposed to direct sun, the sky view factor as sky exposure and air temperature as the surface temperature
  - UTCI from air temperature, that radiant temperature, wind speed and relative humidity
  - horizontal irradiance = direct normal x sin(altitude) x sunlit + diffuse horizontal x sky view factor,
    accumulated over the day. Stand points are treated as seated people and pitch points as standing people.

Usage: python shots_comfort.py
"""
import json
import math
from array import array
from bisect import bisect_right
from multiprocessing import Pool, cpu_count
from pathlib import Path

from ladybug_comfort.solarcal import outdoor_sky_heat_exch
from ladybug_comfort.utci import universal_thermal_climate_index

HERE = Path(__file__).resolve().parent
DATA = HERE / 'data'
OUT = HERE.parent / 'viewer' / 'public' / 'data' / 'film'

FLOOR_REFLECTANCE = 0.25
CHUNK = 40  # frames per task
# Upper edges of the UTCI stress categories in degrees C. Index 0 is below -40, index 9 is above 46.
CATEGORY_EDGES = [-40, -27, -13, 0, 9, 26, 32, 38, 46]
CATEGORIES = [
    'Extreme cold stress', 'Very strong cold stress', 'Strong cold stress', 'Moderate cold stress',
    'Slight cold stress', 'No thermal stress', 'Moderate heat stress', 'Strong heat stress',
    'Very strong heat stress', 'Extreme heat stress',
]

_ctx = {}


def init_worker():
    _ctx['frames'] = json.loads((DATA / 'shots_frames.json').read_text())
    _ctx['points'] = json.loads((DATA / 'shots' / 'points.json').read_text())
    _ctx['sunlit'] = {}


def sunlit_for(name):
    if name not in _ctx['sunlit']:
        _ctx['sunlit'][name] = (DATA / 'shots' / f'{name}.sunlit.u8').read_bytes()
    return _ctx['sunlit'][name]


def process_chunk(task):
    shot_idx, start, end = task
    shot = _ctx['frames']['shots'][shot_idx]
    pts = _ctx['points']
    n = len(pts['x'])
    kind, svf = pts['kind'], pts['svf']
    flags = sunlit_for(shot['name'])
    hours_per_frame = _ctx['frames']['minutesPerFrame'] / 60
    utci_out = bytearray()
    inc_out = array('f')
    stats = []
    for f in range(start, end):
        alt = shot['altitude'][f]
        db, rh, wind = shot['db'][f], shot['rh'][f], shot['wind'][f]
        dni, dhi, hir = shot['dni'][f], shot['dhi'][f], shot['hir'][f]
        sin_alt = math.sin(math.radians(alt)) if alt > 0 else 0.0
        base = f * n
        # [pitch, stand] -> category counts, UTCI sum, sunlit count
        counts = [[0] * 10, [0] * 10]
        u_sum = [0.0, 0.0]
        lit_count = [0, 0]
        for i in range(n):
            k = kind[i]
            lit = flags[base + i] if alt > 0 else 0
            mrt = outdoor_sky_heat_exch(db, hir, dhi, dni, alt, svf[i], lit, FLOOR_REFLECTANCE,
                                        'seated' if k == 1 else 'standing', 135)['mrt']
            u = universal_thermal_climate_index(db, mrt, wind, rh)
            utci_out.append(max(0, min(255, round((u + 50) * 2))))
            inc_out.append((dni * sin_alt * lit + dhi * svf[i]) * hours_per_frame)
            counts[k][bisect_right(CATEGORY_EDGES, u)] += 1
            u_sum[k] += u
            lit_count[k] += lit
        stats.append((counts, u_sum, lit_count))
    return shot_idx, start, bytes(utci_out), inc_out.tobytes(), stats


def main():
    frames = json.loads((DATA / 'shots_frames.json').read_text())
    pts = json.loads((DATA / 'shots' / 'points.json').read_text())
    n = len(pts['x'])
    n_kind = [pts['kind'].count(0), pts['kind'].count(1)]
    workers = max(1, cpu_count() - 1)
    tasks = [(s, a, min(a + CHUNK, shot['frames']))
             for s, shot in enumerate(frames['shots'])
             for a in range(0, shot['frames'], CHUNK)]
    print(f'{n} points ({n_kind[0]} pitch, {n_kind[1]} stands), {sum(s["frames"] for s in frames["shots"])} frames, '
          f'{len(tasks)} tasks on {workers} workers')

    chunks = {}
    with Pool(workers, initializer=init_worker) as pool:
        for done, (s, start, utci, inc, stats) in enumerate(pool.imap_unordered(process_chunk, tasks), 1):
            chunks[(s, start)] = (utci, inc, stats)
            if done % 10 == 0:
                print(f'  {done} of {len(tasks)}')

    OUT.mkdir(parents=True, exist_ok=True)
    index = {'fps': frames['fps'], 'minutesPerFrame': frames['minutesPerFrame'], 'categories': CATEGORIES,
             'categoryEdges': CATEGORY_EDGES, 'shots': []}
    global_max = 0.0
    for s, shot in enumerate(frames['shots']):
        starts = sorted(a for (si, a) in chunks if si == s)
        utci = b''.join(chunks[(s, a)][0] for a in starts)
        stats = [st for a in starts for st in chunks[(s, a)][2]]
        incs = array('f')
        for a in starts:
            incs.frombytes(chunks[(s, a)][1])

        # Accumulate the irradiation over the day, frame by frame.
        acc = [0.0] * n
        irr = array('H')
        mean_cum = [[], []]
        for f in range(shot['frames']):
            row = incs[f * n:(f + 1) * n]
            sums = [0.0, 0.0]
            for i in range(n):
                acc[i] += row[i]
                sums[pts['kind'][i]] += acc[i]
            irr.extend(min(65535, round(v)) for v in acc)
            for k in (0, 1):
                mean_cum[k].append(round(sums[k] / n_kind[k] / 1000, 3))
        global_max = max(global_max, max(acc))

        series = {
            'categoryPct': {name: [[round(100 * c / n_kind[k], 2) for c in st[0][k]] for st in stats]
                            for k, name in enumerate(['pitch', 'stands'])},
            'meanUtci': {name: [round(st[1][k] / n_kind[k], 2) for st in stats]
                         for k, name in enumerate(['pitch', 'stands'])},
            'sunlitPct': {name: [round(100 * st[2][k] / n_kind[k], 2) for st in stats]
                          for k, name in enumerate(['pitch', 'stands'])},
            'meanCumKwh': {'pitch': mean_cum[0], 'stands': mean_cum[1]},
        }
        meta = {key: shot[key] for key in ['name', 'title', 'dateLabel', 'nominalLabel', 'dayIndex', 'sunrise',
                                           'sunset', 'ghiKwhM2', 'frames', 'minutes', 'altitude', 'azimuth',
                                           'db', 'rh', 'wind', 'dni', 'dhi']}
        meta['series'] = series
        meta['maxCumWhM2'] = round(max(acc))
        (OUT / f"{shot['name']}.json").write_text(json.dumps(meta, separators=(',', ':')))
        (OUT / f"{shot['name']}.utci.u8").write_bytes(utci)
        (OUT / f"{shot['name']}.irr.u16").write_bytes(irr.tobytes() if irr.itemsize == 2 else b'')
        index['shots'].append({k: shot[k] for k in ['name', 'title', 'dateLabel', 'nominalLabel', 'frames',
                                                     'sunrise', 'sunset', 'ghiKwhM2']})
        print(f"{shot['name']:8} max accumulated {max(acc) / 1000:.2f} kWh/m2, "
              f"mean UTCI stands {min(series['meanUtci']['stands']):.1f} to {max(series['meanUtci']['stands']):.1f} C")

    index['maxCumWhM2'] = round(global_max)
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    (OUT / 'points.json').write_text(json.dumps({
        'n': n, 'nPitch': n_kind[0], 'pitchCell': pts['pitchCell'], 'standCell': pts['standCell'],
        'kind': pts['kind'], 'x': pts['x'], 'y': pts['y'], 'z': pts['z'], 'svf': pts['svf'],
        'northBearingOfPlusZ': pts['northBearingOfPlusZ'],
    }, separators=(',', ':')))
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
