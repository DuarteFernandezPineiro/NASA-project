"""Structure BASS-II outcomes from the observations in NASA/TM-20210011385.

The IDs below were reviewed against Appendix A. Ignition includes a brief
flame. Spread means the flame traveled beyond the ignition region. Extinction
describes the observed event or test condition, rather than a physical model.
A null value means the observation does not establish that outcome.
"""

import argparse
import json
from pathlib import Path

# Membership is based on the observation text. Gas readings, fan settings
# alone and attempts to ignite or blow out a flame do not prove an outcome.
IGNITED = frozenset("""
    B1 B3 B6 B8 B9 B10 B11 B12 B13 B14 B15 B16 B17 B18 B19 B20 B21 B22
    F1 F3 F4
    M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15 M16 M17 M18 M19 M20
    O1 O2 O3a O3b O4 O5a O5b O7 O8a O8b O9 O10 O11 O12 O13a O13b
    O14 O15a O15b O16 O17 O18 O19
    P1 P2 P3a P3b P4 P5 P6 P8 P9 P10 P12 P13a P13b P14 P15 P16 P17 P18
    P19 P20 P21a P22a P22b P23 P24 P25
    T2 T3 T4 T5 T6 T7 T9 T10 T11 T12 T13 T14 T16 T18 T19 T20
    T21 T22 T24 T25 T26 T27 T28a T28b T29
""".split())

NO_IGNITION = {"T23"}
SPREAD = frozenset("""
    B1 B6 B8 B10 B11 B13 B15 B20 B21 M1 M2 M6 M7 M10 M14 M15
    P3a P3b P12 P13a T11 T16 T18 T24
""".split())
NO_SPREAD = {"F1", "T9", "T10"} | NO_IGNITION

EXTINCTION_GROUPS = {
    "flow_cutoff": "B1 M1 M17 P2 P4 P5 P6 P13a",
    "flow_reduced": """
        B9 B10 B11 B13 B16 B17 B21 B22 F4 M4 M5 M8 M13 M15 M18 M20
        O3a O4 O14 O15a O15b O19 P1 P9 P10 P12 P13b
        P17 P18 P19 P20 P22b P23 P24 T4 T7 T14 T20 T22
    """,
    "blowoff": "B18 B19 O5a O7 O8b O9 O10 O11 T21",
    "self_extinguished": "M2 M10 M14 M19 O13a P21a",
    "fuel_consumed": "B6 T27",
    "igniter_removed": "O12",
    "igniter_still_on": "F1",
    "transient_flame": "B14 F3 O16 T3 T9 T10 T28a T28b",
    "method_unspecified": "M3 M9 M11 O8a O17 O18 P3a P14 P16 P22a P25 T12 T13 T18 T29",
    "not_extinguished": "T6",
    "not_applicable": "T23",
}
EXTINCTION = {}
for method, ids in EXTINCTION_GROUPS.items():
    for test_id in ids.split():
        if test_id in EXTINCTION:
            raise ValueError(f"Multiple extinction labels for {test_id}")
        EXTINCTION[test_id] = method


def extract_outcomes(test_id, report):
    """Return ignition and spread as booleans or None, and an extinction label."""
    outcomes = {"ignited": None, "spread": None, "extinction": None}
    if not report or not report.get("observation"):
        return outcomes

    if test_id in IGNITED:
        outcomes["ignited"] = True
    elif test_id in NO_IGNITION:
        outcomes["ignited"] = False
    if test_id in SPREAD:
        outcomes["spread"] = True
    elif test_id in NO_SPREAD:
        outcomes["spread"] = False
    outcomes["extinction"] = EXTINCTION.get(test_id)
    return outcomes


def main():
    parser = argparse.ArgumentParser(
        description="Read trials.json and emit trials enriched with BASS-II outcomes."
    )
    parser.add_argument(
        "trials",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parents[1] / "dist" / "trials.json",
    )
    args = parser.parse_args()
    trials = json.loads(args.trials.read_text(encoding="utf-8"))
    for trial in trials:
        trial.update(extract_outcomes(trial["id"], trial.get("report")))
    print(json.dumps(trials, separators=(",", ":")))


if __name__ == "__main__":
    main()
