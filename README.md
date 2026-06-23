# Quant Mini Lab

Quant Mini Lab is a mobile-first Progressive Web App that backtests a simple moving average crossover strategy.

It uses only HTML, CSS, and vanilla JavaScript. There is no backend and no database.

## What the App Does

The app starts with embedded sample price data, so it works right away.

It then:

1. Computes daily returns from closing prices.
2. Computes a short moving average and a long moving average.
3. Invests when the short moving average is above the long moving average.
4. Stays in cash when the short moving average is not above the long moving average.
5. Compares the strategy with Buy & Hold.
6. Shows total return, max drawdown, number of trades, and exposure.
7. Draws both equity curves on a canvas chart.

## Files

- `index.html` is the app screen.
- `styles.css` contains the mobile-first layout and visual design.
- `app.js` contains the sample data, CSV parsing, backtest logic, metrics, and chart drawing.
- `manifest.json` makes the app installable as a PWA.
- `service-worker.js` caches the app files for offline use.
- `icon.svg` is the source app icon.
- `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` are install icons for PWA and iPhone home-screen support.

## Run Locally

Because service workers need a local web server, open the app through a server instead of opening `index.html` directly.

One simple option:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Use Your Own CSV

You can upload a CSV file from inside the app.

The CSV must have these columns:

```csv
Date,Close
2024-01-02,100.25
2024-01-03,101.10
2024-01-04,100.80
```

The app ignores rows where the close price is missing, zero, negative, or not a number.

## Strategy Notes

The app uses yesterday's moving average signal for today's return. This avoids using information from the future.

Example:

- If yesterday's short moving average was above yesterday's long moving average, the strategy is invested today.
- If not, the strategy is in cash today.

This is still a learning tool, not investment advice.
