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

## What is Buy & Hold?

Buy & Hold is the simplest comparison strategy in this app.

It means:

1. Buy the asset at the beginning of the test period.
2. Keep holding it the whole time.
3. Do not move in and out based on signals.

In Quant Mini Lab, Buy & Hold is useful because it gives the moving average strategy a baseline. If the moving average strategy earns less than Buy & Hold, then the extra trading did not help for that data set.

Buy & Hold can still lose money. It stays invested during both good periods and bad periods.

## What is Maximum Drawdown?

Maximum drawdown measures the largest drop from a previous high point.

For example, imagine a portfolio grows to `$1,000`, then falls to `$700`, and later recovers. The drawdown from `$1,000` to `$700` is `30%`.

Maximum drawdown is the worst drawdown during the whole test.

This metric helps answer a different question than total return:

- Total return asks, "How much did the strategy make or lose overall?"
- Maximum drawdown asks, "How painful was the biggest drop along the way?"

A strategy can have a good total return and still have a large maximum drawdown.

## What is a Progressive Web App (PWA)?

A Progressive Web App, or PWA, is a website that can behave more like an app.

For this project, that means Quant Mini Lab can:

- Load in a mobile browser.
- Be added to a phone home screen.
- Use app icons from the project files.
- Cache its core files with a service worker so it can keep working after the first load.

There is still no app store involved. The app is just a small website with extra files that make it installable and more resilient.

## How this project is deployed with GitHub Pages

This project can be deployed with GitHub Pages because it is a static app.

Static means the browser only needs files like:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`
- icon files

There is no server-side code to run.

With GitHub Pages, GitHub hosts these files directly from the repository. When someone visits the GitHub Pages URL, their browser downloads the files and runs the app locally.

A typical deployment flow is:

1. Push the project files to a GitHub repository.
2. Open the repository settings on GitHub.
3. Enable GitHub Pages.
4. Choose the branch and folder to publish, often the `main` branch and the repository root.
5. Visit the GitHub Pages URL that GitHub provides.

After deployment, updates are made by changing the files, committing them, and pushing the changes to GitHub.

## How to install the app on an iPhone home screen

On iPhone, PWAs are installed from Safari.

To add Quant Mini Lab to the home screen:

1. Open the deployed app URL in Safari.
2. Tap the Share button.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the app name.
5. Tap **Add**.

The app icon will appear on the iPhone home screen. Opening it from there makes it feel more like a regular app, even though it is still powered by the website files.
