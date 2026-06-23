"use strict";

// Quant Mini Lab keeps every calculation in this file so beginners can follow the full flow.
const DEFAULT_SHORT_WINDOW = 20;
const DEFAULT_LONG_WINDOW = 50;

const elements = {
  shortWindow: document.querySelector("#shortWindow"),
  longWindow: document.querySelector("#longWindow"),
  csvFile: document.querySelector("#csvFile"),
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  strategyReturn: document.querySelector("#strategyReturn"),
  buyHoldReturn: document.querySelector("#buyHoldReturn"),
  maxDrawdown: document.querySelector("#maxDrawdown"),
  tradeCount: document.querySelector("#tradeCount"),
  exposure: document.querySelector("#exposure"),
  chart: document.querySelector("#equityChart"),
  latestSignal: document.querySelector("#latestSignal"),
  latestDate: document.querySelector("#latestDate"),
  dataSummary: document.querySelector("#dataSummary"),
  installStatus: document.querySelector("#installStatus"),
  settingsError: document.querySelector("#settingsError")
};

let priceData = buildEmbeddedSampleData();
let latestBacktest = null;

// Embedded data means the app works immediately, even with no internet and no uploaded file.
function buildEmbeddedSampleData() {
  const rows = [];
  const startDate = new Date("2024-01-02T00:00:00");
  let price = 100;

  for (let day = 0; rows.length < 260; day += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day);

    // Skip weekends so the sample acts more like real market data.
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    // This deterministic wave creates rallies, pullbacks, and sideways periods.
    const drift = 0.00045;
    const cycle = Math.sin(rows.length / 13) * 0.009;
    const slowerCycle = Math.cos(rows.length / 41) * 0.005;
    const eventShock = rows.length === 86 ? -0.052 : rows.length === 173 ? 0.047 : 0;
    price = price * (1 + drift + cycle + slowerCycle + eventShock);

    rows.push({
      date: date.toISOString().slice(0, 10),
      close: Number(price.toFixed(2))
    });
  }

  return rows;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map((header) => header.trim().toLowerCase());
  const dateIndex = headers.indexOf("date");
  const closeIndex = headers.indexOf("close");

  if (dateIndex === -1 || closeIndex === -1) {
    throw new Error("CSV needs Date and Close columns.");
  }

  return lines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return {
      date: cells[dateIndex],
      close: Number(cells[closeIndex])
    };
  }).filter((row) => row.date && Number.isFinite(row.close) && row.close > 0);
}

function simpleMovingAverage(values, windowSize) {
  const averages = [];
  let runningTotal = 0;

  values.forEach((value, index) => {
    runningTotal += value;

    if (index >= windowSize) {
      runningTotal -= values[index - windowSize];
    }

    // A moving average only exists after enough prices are available.
    averages.push(index >= windowSize - 1 ? runningTotal / windowSize : null);
  });

  return averages;
}

function calculateBacktest(data, shortWindow, longWindow) {
  const closes = data.map((row) => row.close);
  const shortAverage = simpleMovingAverage(closes, shortWindow);
  const longAverage = simpleMovingAverage(closes, longWindow);
  const strategyEquity = [1];
  const buyHoldEquity = [1];
  const positions = [0];
  let trades = 0;
  let investedDays = 0;

  for (let index = 1; index < data.length; index += 1) {
    const dailyReturn = closes[index] / closes[index - 1] - 1;

    // Use yesterday's signal for today's return to avoid using future information.
    const yesterday = index - 1;
    const invested = shortAverage[yesterday] !== null &&
      longAverage[yesterday] !== null &&
      shortAverage[yesterday] > longAverage[yesterday] ? 1 : 0;

    const previousPosition = positions[index - 1];
    if (invested !== previousPosition) {
      trades += 1;
    }

    investedDays += invested;
    positions.push(invested);
    strategyEquity.push(strategyEquity[index - 1] * (1 + dailyReturn * invested));
    buyHoldEquity.push(buyHoldEquity[index - 1] * (1 + dailyReturn));
  }

  return {
    dates: data.map((row) => row.date),
    shortAverage,
    longAverage,
    strategyEquity,
    buyHoldEquity,
    positions,
    strategyReturn: strategyEquity.at(-1) - 1,
    buyHoldReturn: buyHoldEquity.at(-1) - 1,
    maxDrawdown: calculateMaxDrawdown(strategyEquity),
    trades,
    exposure: investedDays / Math.max(1, data.length - 1)
  };
}

function calculateMaxDrawdown(equityCurve) {
  let peak = equityCurve[0];
  let worstDrawdown = 0;

  equityCurve.forEach((value) => {
    peak = Math.max(peak, value);
    worstDrawdown = Math.min(worstDrawdown, value / peak - 1);
  });

  return worstDrawdown;
}

function formatPercent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

function readWindowInputs() {
  return {
    shortWindow: Number(elements.shortWindow.value),
    longWindow: Number(elements.longWindow.value)
  };
}

function setSettingsError(message) {
  elements.settingsError.textContent = message;
  elements.shortWindow.classList.toggle("is-invalid", Boolean(message));
  elements.longWindow.classList.toggle("is-invalid", Boolean(message));
  elements.shortWindow.setAttribute("aria-invalid", String(Boolean(message)));
  elements.longWindow.setAttribute("aria-invalid", String(Boolean(message)));
}

function validateWindows() {
  const { shortWindow, longWindow } = readWindowInputs();

  if (!Number.isInteger(shortWindow) || !Number.isInteger(longWindow)) {
    setSettingsError("Please enter whole numbers for both moving averages.");
    return null;
  }

  if (shortWindow < 2 || shortWindow > 100) {
    setSettingsError("Short MA must be between 2 and 100 days.");
    return null;
  }

  if (longWindow < 5 || longWindow > 200) {
    setSettingsError("Long MA must be between 5 and 200 days.");
    return null;
  }

  if (longWindow <= shortWindow) {
    setSettingsError("Long MA must be greater than Short MA.");
    return null;
  }

  setSettingsError("");
  return { shortWindow, longWindow };
}

function updateApp() {
  const windows = validateWindows();
  if (!windows) {
    return;
  }

  const { shortWindow, longWindow } = windows;

  if (priceData.length <= longWindow + 2) {
    elements.dataSummary.textContent = "Please use more rows than the long moving average window.";
    return;
  }

  const result = calculateBacktest(priceData, shortWindow, longWindow);
  latestBacktest = result;
  elements.strategyReturn.textContent = formatPercent(result.strategyReturn);
  elements.buyHoldReturn.textContent = formatPercent(result.buyHoldReturn);
  elements.maxDrawdown.textContent = formatPercent(result.maxDrawdown);
  elements.tradeCount.textContent = String(result.trades);
  elements.exposure.textContent = formatPercent(result.exposure);

  const latestPosition = result.positions.at(-1);
  elements.latestSignal.textContent = latestPosition ? "Invested" : "In cash";
  elements.latestDate.textContent = result.dates.at(-1);
  elements.dataSummary.textContent = `${priceData.length} rows loaded. Short MA: ${shortWindow} days. Long MA: ${longWindow} days.`;

  drawChart(result);
}

function drawChart(result) {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();

  // Match the canvas pixels to the screen so lines stay crisp on mobile displays.
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const width = bounds.width;
  const height = bounds.height;
  const padding = { top: 18, right: 12, bottom: 34, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const allValues = result.strategyEquity.concat(result.buyHoldEquity);
  const minValue = Math.min(...allValues) * 0.98;
  const maxValue = Math.max(...allValues) * 1.02;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  drawGrid(context, padding, chartWidth, chartHeight, minValue, maxValue);
  drawLine(context, result.buyHoldEquity, "#c76f1f", padding, chartWidth, chartHeight, minValue, maxValue);
  drawLine(context, result.strategyEquity, "#0e7c66", padding, chartWidth, chartHeight, minValue, maxValue);
  drawAxisLabels(context, result, padding, width, height, minValue, maxValue);
}

function drawGrid(context, padding, chartWidth, chartHeight, minValue, maxValue) {
  context.strokeStyle = "#e5ece5";
  context.fillStyle = "#66716c";
  context.lineWidth = 1;
  context.font = "12px system-ui, sans-serif";

  for (let line = 0; line <= 4; line += 1) {
    const y = padding.top + chartHeight * (line / 4);
    const value = maxValue - (maxValue - minValue) * (line / 4);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + chartWidth, y);
    context.stroke();
    context.fillText(`${Math.round(value * 100)}%`, 4, y + 4);
  }
}

function drawLine(context, values, color, padding, chartWidth, chartHeight, minValue, maxValue) {
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();

  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / (values.length - 1);
    const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
}

function drawAxisLabels(context, result, padding, width, height, minValue, maxValue) {
  context.fillStyle = "#5b6762";
  context.font = "12px system-ui, sans-serif";
  context.fillText(result.dates[0], padding.left, height - 10);

  const lastDate = result.dates.at(-1);
  const dateWidth = context.measureText(lastDate).width;
  context.fillText(lastDate, width - dateWidth - 10, height - 10);

  context.strokeStyle = "#b7c5bb";
  context.lineWidth = 1;
  context.strokeRect(padding.left, padding.top, width - padding.left - padding.right, height - padding.top - padding.bottom);

  // These labels make it clear that equity starts at 100%, not at a dollar amount.
  context.fillStyle = "#17211e";
  context.font = "700 12px system-ui, sans-serif";
  context.fillText("Equity", padding.left, 14);
}

async function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsedRows = parseCsv(text);

    if (parsedRows.length < 60) {
      throw new Error("CSV needs at least 60 price rows.");
    }

    priceData = parsedRows;
    updateApp();
  } catch (error) {
    elements.dataSummary.textContent = error.message;
  }
}

function resetApp() {
  priceData = buildEmbeddedSampleData();
  elements.shortWindow.value = DEFAULT_SHORT_WINDOW;
  elements.longWindow.value = DEFAULT_LONG_WINDOW;
  elements.csvFile.value = "";
  updateApp();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    elements.installStatus.textContent = "Browser only";
    return;
  }

  navigator.serviceWorker.register("service-worker.js")
    .then(() => {
      elements.installStatus.textContent = "Offline ready";
    })
    .catch(() => {
      elements.installStatus.textContent = "Offline unavailable";
    });
}

elements.shortWindow.addEventListener("input", () => setSettingsError(""));
elements.longWindow.addEventListener("input", () => setSettingsError(""));
elements.shortWindow.addEventListener("blur", updateApp);
elements.longWindow.addEventListener("blur", updateApp);
elements.csvFile.addEventListener("change", handleCsvUpload);
elements.runButton.addEventListener("click", updateApp);
elements.resetButton.addEventListener("click", resetApp);
window.addEventListener("resize", () => {
  if (latestBacktest) {
    drawChart(latestBacktest);
  }
});

registerServiceWorker();
updateApp();
