"""
Standalone debug run for a single sport, with debug_matching=True.

Doesn't touch your production valuebet.py / run_scan() at all --
just calls the scanner directly so you can see REJECT/MATCH reasons
for every fixture without going through the full 8-sport API flow.

Run from your project root (venv activated):
    python debug_scan.py baseball
    python debug_scan.py "american football"
"""

import sys

from app.scanner.arbitrage_scanner import scan_for_arbitrage

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python debug_scan.py "<sport name>"')
        print('e.g.:  python debug_scan.py baseball')
        print('       python debug_scan.py "american football"')
        sys.exit(1)

    sport = sys.argv[1]

    result = scan_for_arbitrage(
        sport=sport,
        debug_matching=True,
    )

    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("Scanned:", result["scanned_events"])
    print("Matched:", result["matched_events"])
    print("Opportunities:", result["count"])