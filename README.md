# ValueEdge — EdgePulse

ValueEdge is a sports betting analytics platform focused on identifying arbitrage and value opportunities across bookmakers and betting exchanges.

The core scanning engine, **EdgePulse**, compares bookmaker BACK odds with Betfair Exchange LAY odds and identifies opportunities where a position can produce a guaranteed profit after exchange commission.

## Current Features

- Multi-sport arbitrage scanning
- The Odds API bookmaker odds integration
- Betfair Exchange integration
- Bookmaker BACK vs Betfair LAY arbitrage
- Strict fixture matching
- Team/runner name normalization
- Betfair `MATCH_ODDS` market matching
- Exchange commission-aware calculations
- Automatic scheduled scanning
- PostgreSQL persistence
- FastAPI backend
- Next.js frontend
- Current-scan opportunity storage
- Event start-time filtering
- Sport and league metadata

## Supported Sports

EdgePulse is being developed to support:

- Soccer
- Tennis
- Basketball
- Ice Hockey
- Rugby League
- Australian Rules
- Baseball
- American Football

Available competitions depend on the markets currently available from the odds provider and Betfair Exchange.

## Architecture

```text
The Odds API
     │
     │ Bookmaker H2H odds
     ▼
Fixture Normalization
     │
     ▼
MatcherService ◄──────── Betfair Events
     │
     │ Verified fixture
     ▼
Bookmaker BACK Odds
     │
     │
     ├───────────────┐
     │               │
     ▼               ▼
Selection        Betfair
Matching         MATCH_ODDS
                     │
                     ▼
                 LAY Odds
                     │
                     ▼
              Arbitrage Engine
                     │
                     ▼
               Opportunities
                     │
                     ▼
                PostgreSQL
                     │
                     ▼
                 FastAPI
                     │
                     ▼
               Next.js UI
```

## Arbitrage Model

The current EdgePulse scanner searches for:

```text
Bookmaker BACK
      vs
Betfair Exchange LAY
```

For each matched selection, the scanner obtains:

- Best eligible bookmaker BACK price
- Betfair best available LAY price
- Exchange commission
- Back stake
- Required lay stake
- Lay liability
- Profit if the BACK bet wins
- Profit if the LAY bet wins
- Guaranteed profit percentage

Only opportunities meeting the configured minimum profit threshold are returned.

## Scanner Flow

A scan currently follows this pipeline:

```text
1. Select sport
2. Fetch Betfair events
3. Fetch bookmaker odds
4. Normalize fixtures
5. Remove started/near-start events
6. Match bookmaker fixtures to Betfair
7. Find Betfair MATCH_ODDS markets
8. Match bookmaker selections to Betfair runners
9. Read bookmaker BACK prices
10. Read Betfair LAY prices
11. Calculate arbitrage
12. Filter by minimum profit
13. Save latest opportunities to database
14. Serve results to frontend
```

## Project Structure

```text
valueedge/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   │
│   │   ├── routers/
│   │   │   ├── odds.py
│   │   │   └── valuebets.py
│   │   │
│   │   ├── scanner/
│   │   │   └── arbitrage_scanner.py
│   │   │
│   │   └── services/
│   │       ├── betfair_service.py
│   │       ├── matcher_service.py
│   │       └── the_odds_api_service.py
│   │
│   ├── scripts/
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── next.config.ts
│
└── README.md
```

## Backend Setup

Create and activate a Python virtual environment.

On Windows PowerShell:

```powershell
cd C:\path\to\valueedge

python -m venv .venv

.\.venv\Scripts\Activate.ps1
```

If the virtual environment is stored in the project root and you are already inside `backend`:

```powershell
..\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r backend\requirements.txt
```

Start the backend:

```powershell
cd backend

uvicorn app.main:app --reload
```

## Frontend Setup

Open another terminal:

```powershell
cd frontend

npm install
npm run dev
```

Open the local address displayed by Next.js.

## Environment Variables

Backend secrets should be stored in:

```text
backend/.env
```

Do **not** commit this file.

Example configuration:

```env
THE_ODDS_API_KEY=your_key_here

BETFAIR_USERNAME=your_username
BETFAIR_PASSWORD=your_password
BETFAIR_APP_KEY=your_app_key

DATABASE_URL=your_database_connection
```

Additional Betfair certificate configuration may be required depending on the authentication method used by `BetfairService`.

## Security

Never commit:

```text
.env
API keys
Betfair credentials
database passwords
private certificates
virtual environments
```

The repository `.gitignore` should exclude sensitive environment files and local virtual environments.

If an API key is accidentally exposed publicly, rotate it immediately.

## The Odds API

EdgePulse uses The Odds API as the bookmaker odds source.

The scanner uses decimal H2H markets and normalizes provider fixtures before matching them against Betfair.

Because API usage is credit-limited, request efficiency is an important part of the scanner design.

The goal is to retrieve bookmaker prices efficiently and avoid unnecessary repeated requests during a scan.

## Betfair

Betfair Exchange provides the LAY side of the current arbitrage strategy.

The scanner:

```text
Fetches Betfair events
        ↓
Matches external fixtures
        ↓
Finds MATCH_ODDS market
        ↓
Matches selections to runners
        ↓
Fetches market books
        ↓
Reads best available LAY price
```

Market books are fetched in batches where possible to reduce unnecessary API calls.

## Fixture Matching

Bookmaker and Betfair event names frequently differ.

Examples include:

```text
Newcastle United
Newcastle

Nottingham Forest
Nottm Forest

Tottenham Hotspur
Tottenham
```

`MatcherService` handles normalization and fuzzy matching while applying strict checks to reduce false fixture matches.

Matching can consider:

- Participant names
- Normalized event names
- Event date/time
- Sport
- League information
- Match confidence

Strict matching is important because matching odds from different fixtures could produce false arbitrage opportunities.

## Event Safety

The scanner ignores events that have already started.

It also avoids fixtures that are about to begin, reducing the chance of comparing stale pre-match bookmaker prices with changing exchange markets.

## Database

Successful scans are persisted to PostgreSQL.

The current workflow stores the latest scan and its arbitrage opportunities so that the frontend represents the current scanner state rather than indefinitely displaying stale opportunities.

Stored opportunity data can include:

```text
Sport
League
Event
Selection
Bookmaker
Back odds
Betfair lay odds
Back stake
Lay stake
Liability
Guaranteed profit
Profit percentage
Event start time
Scan time
```

## Development Status

ValueEdge is under active development.

The immediate development priority is:

```text
Reliable multi-sport bookmaker data
        ↓
Reliable Betfair fixture matching
        ↓
Correct BACK/LAY calculations
        ↓
Database persistence
        ↓
Frontend presentation
```

Future functionality may include additional arbitrage strategies, expanded bookmaker comparison, portfolio tracking, improved scanner monitoring, and richer analytics.

## Disclaimer

ValueEdge is software for sports betting analysis and research.

Betting markets can move quickly, APIs can return delayed or unavailable data, and displayed opportunities may disappear before bets can be placed.

Always verify current odds, market status, liquidity, stake limits, commission, and settlement rules before placing a wager.
