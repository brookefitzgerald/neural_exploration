#!/usr/bin/env python3
"""Export the JSON that the static site in public/ loads.

This replaces the Django + Postgres API that used to live under /spike/.
It repeats what the data migrations (0002_load_zhang_data, 0004_bin_zhang_data)
and the API views did, and writes the responses to files:

    public/data/raster/<n>.json   was /spike/data/<n+1>     (display neuron only)
    public/data/binned/<n>.json   was /spike/bin/2/<n+1>    (display neuron only)
    public/data/binned/all.json   was /spike/bin/2/
    public/data/anova.json        was /spike/anova/2

<n> is the zero-based position of the neuron when the .mat files are sorted by
name. The old site numbered neurons in whatever order the server's filesystem
listed the files, so the numbers differ, but the neurons are the same.

Usage (needs numpy and scipy):

    python utility/export_static_data.py
"""
import json
import warnings
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.stats import f_oneway

ROOT = Path(__file__).resolve().parent.parent
MAT_DIR = ROOT / "neural_exploration" / "visualize" / "migrations" / "zhang_data"
OUT_DIR = ROOT / "public" / "data"

# The page only ever requests the 100 ms bins stepped by 30 ms (bin_id 2).
BIN_NAME = "bin_100_30"
BIN_SIZE = 100
STEP_SIZE = 30

# The two neurons the story calls "neuron A" and "neuron B". A is also the
# neuron shown in the single-neuron sections, so it is the only one whose raw
# spike raster is exported. project.js must use the indices printed below.
NEURON_A_FILE = "bp1014spk_03A_raster_data.mat"
NEURON_B_FILE = "bp1020spk_02A_raster_data.mat"

EXPERIMENT = {
    "id": 1,
    "slug": "zhang",
    "name": "Zhang-Desimone 7 Object Spike Data",
    "description": (
        "The Zhang-Desimone 7 Object dataset was collected by Ying Zhang in "
        "Bob Desimone's lab at the McGovern Institute at MIT. The data "
        "consists of single unit recordings from 132 neurons in the inferior "
        "temporal cortex (IT). Seven objects were shown to the monkey in one "
        "of three locations, and were presented approximately 20 times at "
        "each location."
    ),
    "index_stimulus_shown": 501,
}


def load_site(path):
    mat = loadmat(str(path))
    labels = mat["raster_labels"][0][0]
    return {
        "slug": path.name[2:6] + "_" + path.name[10:12],
        "data": mat["raster_data"],
        "labels_one": [str(x[0]) for x in labels[0][0]],
        "labels_two": [str(x[0]) for x in labels[1][0]],
        "labels_three": [str(x[0]) for x in labels[2][0]],
    }


def bin_data(data, bin_size, step_size):
    """Same binning as migration 0004: mean spike count per sliding window."""
    num_time_steps = data.shape[1]
    starts = np.arange(0, num_time_steps, step_size)
    ends = starts + bin_size
    keep = ends <= num_time_steps
    starts, ends = starts[keep], ends[keep]
    ends[-1] = num_time_steps
    binned = np.transpose(
        [np.mean(data[:, s:e], axis=1) for s, e in zip(starts, ends)]
    )
    # The database column kept 10 decimal places.
    return np.round(binned, 10), [[int(s), int(e)] for s, e in zip(starts, ends)]


def anova_p_values(binned, labels):
    """Same as BinnedData.compute_ANOVA: one-way ANOVA across stimuli per bin."""
    labels = np.array(labels)
    groups = [binned[labels == label] for label in dict.fromkeys(labels.tolist())]
    return [
        float(f_oneway(*[g[:, t] for g in groups])[1])
        for t in range(binned.shape[1])
    ]


def compact(value):
    """Write whole numbers without a trailing .0 to keep the files small."""
    return int(value) if value == int(value) else value


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))
    print("wrote %s (%.1f kB)" % (path.relative_to(ROOT), path.stat().st_size / 1e3))


def main():
    files = sorted(MAT_DIR.glob("*.mat"))
    names = [f.name for f in files]
    neuron_a = names.index(NEURON_A_FILE)
    neuron_b = names.index(NEURON_B_FILE)

    all_binned = []
    all_anova = []
    for i, path in enumerate(files):
        site = load_site(path)
        binned, extents = bin_data(site["data"], BIN_SIZE, STEP_SIZE)
        with warnings.catch_warnings():
            warnings.simplefilter("error")  # a constant bin would give NaN
            all_anova.append(anova_p_values(binned, site["labels_one"]))
        binned_payload = {
            BIN_NAME: [[compact(v) for v in trial] for trial in binned.tolist()],
            BIN_NAME + "_extents": extents,
            "labels": site["labels_one"],
        }
        all_binned.append(binned_payload)

        if i == neuron_a:
            write_json(OUT_DIR / "binned" / ("%d.json" % i), binned_payload)
            write_json(OUT_DIR / "raster" / ("%d.json" % i), {
                "experiment": EXPERIMENT,
                "slug": site["slug"],
                "labels_one": site["labels_one"],
                "labels_two": site["labels_two"],
                "labels_three": site["labels_three"],
                "labels_four": None,
                "data": site["data"].tolist(),
            })

    write_json(OUT_DIR / "binned" / "all.json", all_binned)
    write_json(OUT_DIR / "anova.json", all_anova)
    print("%d neurons; neuron A is index %d, neuron B is index %d"
          % (len(files), neuron_a, neuron_b))


if __name__ == "__main__":
    main()
