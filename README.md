# Quant Mini Lab

Quant Mini Lab is a beginner-friendly Progressive Web App for testing a simple moving average crossover strategy.

It runs entirely in the browser with HTML, CSS, and vanilla JavaScript. There is no backend, no database, and no build step.

## What You Can Learn

- How closing prices become daily returns.
- How short and long moving averages create a basic trading signal.
- How a strategy can be compared with Buy & Hold.
- Why total return and maximum drawdown tell different parts of the story.
- How a small static web app can work offline as a PWA.

## Important Warning

This project is for education only. It is not investment advice.

Past performance does not predict future performance. A strategy that worked on one data set can fail on new data. This app also leaves out real-world frictions such as trading costs, bid/ask spreads, taxes, slippage, liquidity limits, and delayed order execution.

## How the Strategy Works

The app uses two moving averages:

- **Short average:** reacts faster to recent prices.
- **Long average:** reacts more slowly and represents the broader trend.

The rule is simple:

1. If yesterday's short average was above yesterday's long average, the strategy is invested today.
2. If yesterday's short average was not above yesterday's long average, the strategy is in cash today.

Using yesterday's signal for today's return avoids using future information.

## What the App Shows

Quant Mini Lab starts with embedded sample prices, so it works immediately after loading.

The app displays:

- Strategy return.
- Buy & Hold return.
- Difference between the two returns.
- Maximum drawdown.
- Number of trades.
- Exposure, meaning the percent of return-generating days spent invested.
- Best and worst daily strategy returns.
- An equity curve chart showing the growth of `$1.00`.
- A plain-English interpretation of the result.
- A short history of the most recent strategy settings you tried.

## What is Buy & Hold?

Buy & Hold means buying at the beginning of the test period and staying invested until the end.

It is useful as a baseline. If the moving average strategy earns less than Buy & Hold, the extra trading did not help on that data set. Buy & Hold can still lose money because it stays invested through both good and bad periods.

## What is Maximum Drawdown?

Maximum drawdown measures the largest drop from a previous high point.

For example, if a portfolio grows to `$1,000`, falls to `$700`, and later recovers, the drawdown from `$1,000` to `$700` is `30%`.

Total return asks, "How much did the strategy make or lose overall?"

Maximum drawdown asks, "How painful was the biggest drop along the way?"

A strategy can have a good total return and still have a large maximum drawdown.

## Use Your Own CSV

You can upload a CSV file inside the app.

The CSV must include `Date` and `Close` columns:

```csv
Date,Close
2024-01-02,100.25
2024-01-03,101.10
2024-01-04,100.80
```

The app ignores rows where the close price is missing, zero, negative, or not a number.

## Run Locally

Because service workers need a local web server, open the app through a server instead of opening `index.html` directly.

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Files

- `index.html` defines the app screen.
- `styles.css` contains the mobile-first layout and visual design.
- `app.js` contains the sample data, CSV parsing, backtest logic, metrics, chart drawing, and beginner comments.
- `manifest.json` makes the app installable as a PWA.
- `service-worker.js` caches the app files for offline use.
- `icon.svg` is the source app icon.
- `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` are install icons.

## Install on an iPhone Home Screen

On iPhone, PWAs are installed from Safari.

1. Open the deployed app URL in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Confirm the app name.
5. Tap **Add**.

The app icon will appear on the iPhone home screen. Opening it from there makes it feel more like a regular app, even though it is still a small website.

## Deploy with GitHub Pages

This project can be deployed with GitHub Pages because it is a static app.

A typical flow is:

1. Push the project files to a GitHub repository.
2. Open the repository settings on GitHub.
3. Enable GitHub Pages.
4. Choose the branch and folder to publish, often the `main` branch and the repository root.
5. Visit the GitHub Pages URL that GitHub provides.

After deployment, updates are made by changing the files, committing them, and pushing the changes to GitHub.
