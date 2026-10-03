"""
Build the time-zone table: every IANA zone's UTC offset from 1800 to 2100, each change to
the second.

    python packages/birth/scripts/build-zones.py

Writes packages/birth/data/zones.json from the IANA tzdb as compiled by zic into TZif
files, shipped in the Python `tzdata` package (pinned below by version and SHA-256 and
downloaded from PyPI, so no installed copy is used). Zone and link names come from the
IANA source of the same release (data.iana.org). test/zones.test.ts checks the table
against Node's ICU, a separate compilation (scripts/icu-reference.mjs).

Up to 2037 the TZif table lists every transition; after that zoneinfo applies the file's
POSIX rule, so changes there are found by sampling daily and bisecting to the second.
Changes of abbreviation or DST flag alone, with the same offset, are dropped: the table
holds offsets only.
"""
import hashlib
import io
import json
import pathlib
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
import zoneinfo
from datetime import datetime, timedelta, timezone

TZDATA = "2026.5"  # IANA 2026e
TZDATA_SHA256 = "b683bd1b6659ddcd810ff02ad09ba821d4bf1065072805063eb35c49617905ac"
WHEEL = f"https://files.pythonhosted.org/packages/py2.py3/t/tzdata/tzdata-{TZDATA}-py2.py3-none-any.whl"
REGIONS = ["africa", "antarctica", "asia", "australasia", "europe", "northamerica", "southamerica", "etcetera", "backward"]

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "zones.json"
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
START = int((datetime(1800, 1, 1, tzinfo=timezone.utc) - EPOCH).total_seconds())
END = int((datetime(2100, 1, 1, tzinfo=timezone.utc) - EPOCH).total_seconds())
DAY = 86400


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "aletheia-build"})) as r:
        return r.read()


wheel = fetch(WHEEL)
if hashlib.sha256(wheel).hexdigest() != TZDATA_SHA256:
    sys.exit(f"tzdata {TZDATA}: SHA-256 mismatch")
whl = zipfile.ZipFile(io.BytesIO(wheel))
iana = whl.read("tzdata/__init__.py").decode()
version = iana.split('IANA_VERSION = "')[1].split('"')[0]

source = tarfile.open(fileobj=io.BytesIO(fetch(f"https://data.iana.org/time-zones/releases/tzdata{version}.tar.gz")))
if source.extractfile("version").read().decode().strip() != version:
    sys.exit("IANA source version mismatch")
zones, links = [], {}
for region in REGIONS:
    for line in source.extractfile(region).read().decode().splitlines():
        f = line.split("#")[0].split()
        if f and f[0] == "Zone":
            zones.append(f[1])
        elif f and f[0] == "Link":
            links[f[2]] = f[1]
zones.sort()


def offsets(name):
    zi = zoneinfo.ZoneInfo.from_file(io.BytesIO(whl.read(f"tzdata/zoneinfo/{name}")), key=name)
    # Not datetime.fromtimestamp: it rejects times before 1970 on Windows.
    off = lambda t: int((EPOCH + timedelta(seconds=t)).astimezone(zi).utcoffset().total_seconds())
    cand = [t for t in getattr(zi, "_trans_utc", []) if START < t <= END]
    t0 = cand[-1] if cand else START
    o0 = off(t0)
    t = t0 + DAY
    while t <= END:
        o1 = off(t)
        if o1 != o0:
            lo, hi = t0, t
            while hi - lo > 1:
                mid = (lo + hi) // 2
                if off(mid) == o0:
                    lo = mid
                else:
                    hi = mid
            cand.append(hi)
            o0 = o1
        t0 = t
        t += DAY
    seq = [off(START)]
    for t in sorted(set(cand)):
        if off(t) != off(t - 1):
            seq += [t, off(t)]
    return seq


table = {name: offsets(name) for name in zones}
OUT.write_text(
    json.dumps(
        {
            "source": f"IANA tzdb {version}, compiled by zic (Python tzdata {TZDATA}, SHA-256 {TZDATA_SHA256[:16]}…)",
            "tzdb": version,
            "generated": datetime.now(timezone.utc).date().isoformat(),
            "range": [START, END],
            "format": "zone: [offset at range start (s), then pairs of (Unix time in s of a change, offset from then)]",
            "zones": table,
            "links": dict(sorted(links.items())),
        },
        separators=(",", ":"),
    )
    + "\n",
    encoding="utf-8",
)
print(f"{len(table)} zones, {len(links)} links, tzdb {version} -> {OUT}")
