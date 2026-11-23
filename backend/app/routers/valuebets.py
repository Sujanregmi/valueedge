import threading
import time

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.database import SessionLocal
from app.models import ArbitrageOpportunity
from app.scanner.arbitrage_scanner import (
    scan_for_arbitrage,
    SPORT_CONFIG,
)

# ==================================================
# ROUTER
# ==================================================

router = APIRouter(
    prefix="/value-bets",
    tags=["Value Bets"],
)


# ==================================================
# SPORT TOGGLES
# ==================================================
#
# Which sports the automatic + manual scanner actually loops over.
# Defaults to every sport in SPORT_CONFIG enabled. In-memory for now
# (resets on restart) -- move to a settings table if you need this
# to persist across deploys or survive multiple workers.

SPORT_ENABLED: dict[str, bool] = {sport: True for sport in SPORT_CONFIG}

# Per-sport breakdown from the most recent scan run: scanned/matched
# event counts and how many arbs that sport contributed. Keyed by
# sport, rebuilt on every run_scan() call. Also in-memory only.

sport_breakdown: dict[str, dict] = {}


# ==================================================
# LATEST SCAN STATE
# ==================================================

latest_scan = {
    "status": "idle",
    "scanned_events": 0,
    "matched_events": 0,
    "count": 0,
    "opportunities": [],
    "last_updated": None,
}


# ==================================================
# SCANNER LOCK
# ==================================================

scan_lock = threading.Lock()


# 30 minutes
AUTO_SCAN_INTERVAL_SECONDS = 30 * 60

# How often the automatic-scan loop re-checks whether it's time to
# fire, rather than sleeping the full 30 minutes in one block. This
# is what lets a manual "Scan Markets" click push the next automatic
# scan back by a full 30 min, instead of the two schedules drifting
# out of sync.
LOOP_CHECK_INTERVAL_SECONDS = 5

_auto_scanner_started = False

# --------------------------------------------------
# Set at the very start of every run_scan() call --
# automatic AND manual alike. This is the single
# source of truth the countdown timer is built from:
# "next scan" is always last_scan_started_at + 30 min.
# --------------------------------------------------

last_scan_started_at: datetime | None = None


def get_next_scan_at() -> datetime | None:
    if last_scan_started_at is None:
        return None
    return last_scan_started_at + timedelta(seconds=AUTO_SCAN_INTERVAL_SECONDS)


# ==================================================
# RUN SCAN
# ==================================================


def run_scan(
    bookmaker_stake: float = 100,
    commission: float = 0.05,
    min_profit_pct: float = 0.5,
):
    global latest_scan, last_scan_started_at, sport_breakdown

    # Stamp this the instant a scan begins -- whether it was fired
    # by the automatic 30-min loop or a manual "Scan Markets" click.
    # This is what the frontend countdown is computed from, so a
    # manual click genuinely resets the 30-min clock rather than
    # just adding an extra scan alongside an unchanged schedule.
    last_scan_started_at = datetime.now(timezone.utc)

    try:

        # ------------------------------------------
        # RUN ARBITRAGE SCANNER
        # ------------------------------------------
        # Driven by SPORT_ENABLED instead of a hardcoded list, so the
        # Sports page toggle actually controls what gets scanned.
        enabled_sports = [sport for sport, on in SPORT_ENABLED.items() if on]

        all_opportunities = []

        total_scanned_events = 0
        total_matched_events = 0

        # Fresh breakdown every run -- a sport that's toggled off (or
        # was skipped due to an error) simply won't appear, which the
        # Sports page reads as "no data from the last run" rather than
        # a stale count from three scans ago.
        this_run_breakdown: dict[str, dict] = {}

        for sport in enabled_sports:

            print()
            print("=" * 60)
            print(f"STARTING SPORT SCAN: " f"{sport.upper()}")
            print("=" * 60)

            try:
                sport_result = scan_for_arbitrage(
                    sport=sport,
                    bookmaker_stake=bookmaker_stake,
                    commission=commission,
                    min_profit_pct=min_profit_pct,
                    debug_matching=False,
                    event_limit=None,
                )

            except Exception as exc:

                print(
                    f"SPORT SCAN ERROR " f"[{sport}]:",
                    repr(exc),
                )

                this_run_breakdown[sport] = {
                    "status": "error",
                    "error": str(exc),
                    "scanned_events": 0,
                    "matched_events": 0,
                    "opportunities_found": 0,
                }

                # Important:
                # one broken sport does NOT stop
                # the other sports.
                continue

            total_scanned_events += sport_result.get(
                "scanned_events",
                0,
            )

            total_matched_events += sport_result.get(
                "matched_events",
                0,
            )

            sport_opportunities = sport_result.get(
                "opportunities",
                [],
            )

            # Tag every opportunity with its sport.
            for opportunity in sport_opportunities:

                opportunity["sport"] = sport

            all_opportunities.extend(sport_opportunities)

            this_run_breakdown[sport] = {
                "status": "complete",
                "error": None,
                "scanned_events": sport_result.get("scanned_events", 0),
                "matched_events": sport_result.get("matched_events", 0),
                "opportunities_found": len(sport_opportunities),
            }

            print(
                f"{sport.upper()} COMPLETE | "
                f"Scanned: "
                f"{sport_result.get('scanned_events', 0)} | "
                f"Matched: "
                f"{sport_result.get('matched_events', 0)} | "
                f"Arbs: "
                f"{len(sport_opportunities)}"
            )
            time.sleep(3)
        # Build the same result structure
        # the rest of run_scan() already expects.

        sport_breakdown = this_run_breakdown

        result = {
            "scanned_events": total_scanned_events,
            "matched_events": total_matched_events,
            "count": len(all_opportunities),
            "opportunities": all_opportunities,
        }

        # ------------------------------------------
        # SCAN INFORMATION
        # ------------------------------------------

        now_dt = datetime.now(timezone.utc)

        now_iso = now_dt.isoformat()

        scan_id = str(uuid4())

        opportunities = result.get(
            "opportunities",
            [],
        )

        # ------------------------------------------
        # SAVE OPPORTUNITIES TO DATABASE
        # ------------------------------------------

        db = SessionLocal()

        try:
            db.query(ArbitrageOpportunity).delete()

            db.commit()

            for opportunity in opportunities:

                opportunity["found_at"] = now_iso

                raw_start_time = opportunity.get("start_time")

                start_time_dt = (
                    datetime.fromtimestamp(
                        raw_start_time,
                        tz=timezone.utc,
                    )
                    if raw_start_time
                    else None
                )

                is_cross_book = opportunity.get("type") == "CROSS_BOOK_ARBITRAGE"

                if is_cross_book:
                    # No single bookmaker/back_odds/lay_odds/stake_plan
                    # here -- 2-3 legs, each with its own bookmaker,
                    # odds, and stake. Those columns stay NULL for
                    # this row; the real data lives in `legs`.
                    row = ArbitrageOpportunity(
                        scan_id=scan_id,
                        sport=opportunity.get("sport", "unknown"),
                        league=opportunity.get("league"),
                        event=opportunity.get("event", ""),
                        exchange="Multiple Bookmakers",
                        legs=opportunity.get("legs", []),
                        profit_percentage=opportunity.get("profit_percentage", 0),
                        guaranteed_profit=opportunity.get("guaranteed_profit", 0),
                        bookmaker_stake=opportunity.get("total_stake"),
                        start_time=start_time_dt,
                        scanned_at=now_dt,
                    )

                    db.add(row)
                    continue

                stake_plan = opportunity.get(
                    "stake_plan",
                    {},
                )

                row = ArbitrageOpportunity(
                    scan_id=scan_id,
                    sport=opportunity.get(
                        "sport",
                        "unknown",
                    ),
                    league=opportunity.get(
                        "league",
                    ),
                    event=opportunity.get(
                        "event",
                        "",
                    ),
                    selection=opportunity.get(
                        "selection",
                        "",
                    ),
                    start_time=start_time_dt,
                    bookmaker=opportunity.get(
                        "bookmaker",
                        "",
                    ),
                    bookmaker_link=opportunity.get(
                        "bookmaker_link",
                    ),
                    exchange=opportunity.get(
                        "exchange",
                        "Betfair",
                    ),
                    back_odds=opportunity.get(
                        "back_odds",
                        0,
                    ),
                    lay_odds=opportunity.get(
                        "lay_odds",
                        0,
                    ),
                    commission=opportunity.get(
                        "commission",
                        commission,
                    ),
                    profit_percentage=(
                        opportunity.get(
                            "profit_percentage",
                            0,
                        )
                    ),
                    guaranteed_profit=(
                        opportunity.get(
                            "guaranteed_profit",
                            0,
                        )
                    ),
                    bookmaker_stake=(
                        stake_plan.get(
                            "bookmaker_stake",
                            bookmaker_stake,
                        )
                    ),
                    betfair_lay_stake=(
                        stake_plan.get(
                            "betfair_lay_stake",
                            0,
                        )
                    ),
                    lay_liability=(
                        stake_plan.get(
                            "lay_liability",
                            0,
                        )
                    ),
                    total_capital_required=(
                        stake_plan.get(
                            "total_capital_required",
                            0,
                        )
                    ),
                    scanned_at=now_dt,
                )

                db.add(row)

            db.commit()

        except Exception:

            db.rollback()

            raise

        finally:

            db.close()

        # ------------------------------------------
        # UPDATE CURRENT MEMORY STATE
        # ------------------------------------------

        latest_scan = {
            "status": "complete",
            "scan_id": scan_id,
            "scanned_events": result.get(
                "scanned_events",
                0,
            ),
            "matched_events": result.get(
                "matched_events",
                0,
            ),
            "count": len(opportunities),
            "opportunities": opportunities,
            "last_updated": now_iso,
        }

        print()
        print("SCAN SAVED TO DATABASE")
        print(
            "Scan ID:",
            scan_id,
        )
        print(
            "Opportunities saved:",
            len(opportunities),
        )
        print()

    except Exception as exc:

        print(
            "ARBITRAGE SCAN ERROR:",
            repr(exc),
        )

        latest_scan = {
            "status": "error",
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
            "last_updated": None,
            "error": str(exc),
        }

    finally:

        if scan_lock.locked():

            scan_lock.release()


# ==================================================
# START SCAN IF AVAILABLE
# ==================================================


def start_scan_if_available():
    global latest_scan

    if not scan_lock.acquire(blocking=False):

        return False

    latest_scan = {
        **latest_scan,
        "status": "scanning",
    }

    scan_thread = threading.Thread(
        target=run_scan,
        daemon=True,
    )

    scan_thread.start()

    return True


# ==================================================
# AUTOMATIC SCANNER LOOP
# ==================================================


def automatic_scanner_loop():
    # Kick off an initial scan immediately on startup so
    # last_scan_started_at (and therefore next_scan_at) is set
    # right away instead of staying None until the first 30-min
    # mark.
    start_scan_if_available()

    while True:
        target = get_next_scan_at()

        if target is None:
            time.sleep(LOOP_CHECK_INTERVAL_SECONDS)
            continue

        now = datetime.now(timezone.utc)

        if now >= target:
            # Time's up. If a scan is already running (e.g. a manual
            # click landed right at this moment), this is a no-op --
            # scan_lock just returns False and we loop back around,
            # picking up the new last_scan_started_at that run_scan()
            # will have stamped.
            start_scan_if_available()
        else:
            time.sleep(min(LOOP_CHECK_INTERVAL_SECONDS, (target - now).total_seconds()))


# ==================================================
# START AUTOMATIC SCANNER
# ==================================================


def start_automatic_scanner():
    global _auto_scanner_started

    if _auto_scanner_started:

        return

    _auto_scanner_started = True

    thread = threading.Thread(
        target=automatic_scanner_loop,
        daemon=True,
    )

    thread.start()


# ==================================================
# STATUS ENDPOINT
# ==================================================


@router.get("/")
def value_bets_status():

    return {
        "status": "ok",
        "message": "EdgePulse value-bets API is running",
    }


# ==================================================
# GET LATEST ARBITRAGE
# DATABASE-BACKED
# ==================================================


@router.get("/arbitrage")
def get_latest_arbitrage():
    """
    Return latest arbitrage opportunities.

    If a scan is currently running, return the
    scanning state.

    Otherwise load the latest saved scan from
    the database.

    This means restarting FastAPI will not
    automatically wipe the displayed arb table.
    """

    # ------------------------------------------
    # SCAN CURRENTLY RUNNING
    # ------------------------------------------

    if latest_scan.get("status") == "scanning":

        next_scan_at = get_next_scan_at()

        return {
            **latest_scan,
            "next_scan_at": next_scan_at.isoformat() if next_scan_at else None,
        }

    db = SessionLocal()

    try:

        # ------------------------------------------
        # FIND LATEST SAVED OPPORTUNITY
        # ------------------------------------------

        latest_row = (
            db.query(ArbitrageOpportunity)
            .order_by(ArbitrageOpportunity.scanned_at.desc())
            .first()
        )

        # ------------------------------------------
        # NOTHING SAVED YET
        # ------------------------------------------

        if latest_row is None:

            next_scan_at = get_next_scan_at()

            return {
                **latest_scan,
                "next_scan_at": next_scan_at.isoformat() if next_scan_at else None,
            }

        latest_scan_id = latest_row.scan_id

        # ------------------------------------------
        # LOAD ALL OPPORTUNITIES
        # FROM THAT SAME SCAN
        # ------------------------------------------

        rows = (
            db.query(ArbitrageOpportunity)
            .filter(ArbitrageOpportunity.scan_id == latest_scan_id)
            .order_by(ArbitrageOpportunity.profit_percentage.desc())
            .all()
        )

        # ------------------------------------------
        # CONVERT DATABASE ROWS
        # TO FRONTEND FORMAT
        # ------------------------------------------

        opportunities = []

        for row in rows:

            is_cross_book = row.legs is not None

            opportunity = {
                "sport": row.sport,
                "league": row.league,
                "event": row.event,
                "selection": row.selection,
                "start_time": (row.start_time.isoformat() if row.start_time else None),
                "bookmaker": row.bookmaker,
                "bookmaker_link": row.bookmaker_link,
                "exchange": row.exchange,
                "type": (
                    "CROSS_BOOK_ARBITRAGE" if is_cross_book else "BACK_LAY_ARBITRAGE"
                ),
                "back_odds": row.back_odds,
                "lay_odds": row.lay_odds,
                "commission": row.commission,
                "profit_percentage": row.profit_percentage,
                "guaranteed_profit": row.guaranteed_profit,
                "legs": row.legs,  # populated for cross-book, null for back-lay
                "stake_plan": {
                    "bookmaker_stake": row.bookmaker_stake,
                    "betfair_lay_stake": row.betfair_lay_stake,
                    "lay_liability": row.lay_liability,
                    "total_capital_required": row.total_capital_required,
                },
                "found_at": row.scanned_at.isoformat(),
            }

            opportunities.append(opportunity)

        # ------------------------------------------
        # PRESERVE REAL SCAN COUNTS
        # WHEN THIS IS THE CURRENT SCAN
        # ------------------------------------------

        scanned_events = 0
        matched_events = 0

        if latest_scan.get("scan_id") == latest_scan_id:

            scanned_events = latest_scan.get(
                "scanned_events",
                0,
            )

            matched_events = latest_scan.get(
                "matched_events",
                0,
            )

        # ------------------------------------------
        # RESPONSE
        # ------------------------------------------

        next_scan_at = get_next_scan_at()

        return {
            "status": "complete",
            "scan_id": latest_scan_id,
            "scanned_events": scanned_events,
            "matched_events": matched_events,
            "count": len(opportunities),
            "opportunities": opportunities,
            "last_updated": latest_row.scanned_at.isoformat(),
            "next_scan_at": next_scan_at.isoformat() if next_scan_at else None,
        }

    except Exception as exc:

        print(
            "DATABASE ARBITRAGE READ ERROR:",
            repr(exc),
        )

        next_scan_at = get_next_scan_at()

        return {
            "status": "error",
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
            "last_updated": None,
            "next_scan_at": next_scan_at.isoformat() if next_scan_at else None,
            "error": str(exc),
        }

    finally:

        db.close()


# ==================================================
# MANUAL SCAN ENDPOINT
# ==================================================


@router.post("/scan")
def start_arbitrage_scan(
    bookmaker_stake: float = Query(
        default=100,
        gt=0,
    ),
    commission: float = Query(
        default=0.05,
        ge=0,
        lt=1,
    ),
    min_profit_pct: float = Query(
        default=0.5,
        ge=0,
    ),
):
    global latest_scan

    # ------------------------------------------
    # PREVENT MULTIPLE SIMULTANEOUS SCANS
    # ------------------------------------------

    if not scan_lock.acquire(blocking=False):

        return {
            "status": "scanning",
            "message": "A scan is already running",
        }

    # ------------------------------------------
    # UPDATE STATE
    # ------------------------------------------

    latest_scan = {
        **latest_scan,
        "status": "scanning",
    }

    # ------------------------------------------
    # BACKGROUND THREAD
    # ------------------------------------------

    scan_thread = threading.Thread(
        target=run_scan,
        args=(
            bookmaker_stake,
            commission,
            min_profit_pct,
        ),
        daemon=True,
    )

    scan_thread.start()

    return {
        "status": "started",
        "message": "Arbitrage scan started",
    }


# ==================================================
# SPORTS: LIST + TOGGLE
# ==================================================


@router.get("/sports")
def list_sports():
    """
    One row per configured sport: whether it's currently enabled for
    scanning, live opportunity count (real, from the database), and
    the last scan's breakdown for that sport (in-memory, resets on
    restart -- see sport_breakdown above).
    """

    db = SessionLocal()

    try:
        live_counts_by_sport: dict[str, int] = {}

        rows = (
            db.query(
                ArbitrageOpportunity.sport,
                func.count(ArbitrageOpportunity.id),
            )
            .group_by(ArbitrageOpportunity.sport)
            .all()
        )

        for sport_name, count in rows:
            live_counts_by_sport[sport_name] = count

    except Exception as exc:

        print("SPORTS LIVE COUNT ERROR:", repr(exc))
        live_counts_by_sport = {}

    finally:
        db.close()

    sports = []

    for sport, config in SPORT_CONFIG.items():

        breakdown = sport_breakdown.get(sport)

        sports.append(
            {
                "sport": sport,
                "name": config.get("name", sport.title()),
                "enabled": SPORT_ENABLED.get(sport, True),
                "live_opportunities": live_counts_by_sport.get(sport, 0),
                "last_run": breakdown,
            }
        )

    return {"sports": sports}


@router.post("/sports/{sport}/toggle")
def toggle_sport(sport: str):
    """
    Flip whether a sport is included in the next scan (automatic or
    manual). Does not affect a scan already in progress.
    """

    if sport not in SPORT_CONFIG:
        return {"error": f"Unknown sport: {sport}"}

    SPORT_ENABLED[sport] = not SPORT_ENABLED.get(sport, True)

    return {
        "sport": sport,
        "enabled": SPORT_ENABLED[sport],
    }
