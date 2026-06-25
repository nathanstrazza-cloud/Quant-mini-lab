"use strict";

// Quant Mini Lab keeps every calculation in this file so beginners can follow the full flow.
const DEFAULT_SHORT_WINDOW = 20;
const DEFAULT_LONG_WINDOW = 50;
const VALIDATION_SHORT_WINDOW = 2;
const VALIDATION_LONG_WINDOW = 3;
const VALIDATION_STARTING_VALUE = 100;
const VALIDATION_PRICES = [100, 110, 105, 120, 130];

const elements = {
  shortWindow: document.querySelector("#shortWindow"),
  longWindow: document.querySelector("#longWindow"),
  csvFile: document.querySelector("#csvFile"),
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  validationButton: document.querySelector("#validationButton"),
  strategyReturn: document.querySelector("#strategyReturn"),
  buyHoldReturn: document.querySelector("#buyHoldReturn"),
  returnDifference: document.querySelector("#returnDifference"),
  maxDrawdown: document.querySelector("#maxDrawdown"),
  tradeCount: document.querySelector("#tradeCount"),
  exposure: document.querySelector("#exposure"),
  bestDailyReturn: document.querySelector("#bestDailyReturn"),
  worstDailyReturn: document.querySelector("#worstDailyReturn"),
  chart: document.querySelector("#equityChart"),
  latestSignal: document.querySelector("#latestSignal"),
  latestDate: document.querySelector("#latestDate"),
  dataSummary: document.querySelector("#dataSummary"),
  interpretationText: document.querySelector("#interpretationText"),
  installStatus: document.querySelector("#installStatus"),
  settingsError: document.querySelector("#settingsError"),
  debugPanel: document.querySelector("#debugPanel"),
  debugFinalStrategyValue: document.querySelector("#debugFinalStrategyValue"),
  debugFinalBuyHoldValue: document.querySelector("#debugFinalBuyHoldValue"),
  debugTotalReturn: document.querySelector("#debugTotalReturn"),
  debugCalculationNote: document.querySelector("#debugCalculationNote"),
  debugDailyRows: document.querySelector("#debugDailyRows"),
  historyPanel: document.querySelector("#historyPanel"),
  historyRows: document.querySelector("#historyRows")
};

let priceData = buildEmbeddedSampleData();
let latestBacktest = null;
let debugMode = false;
let strategyHistory = [];

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

function buildValidationData() {
  return VALIDATION_PRICES.map((close, index) => ({
    date: `Day ${index + 1}`,
    close
  }));
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
  const strategyDailyReturns = [];
  const dailyRows = [{
    date: data[0].date,
    close: closes[0],
    dailyReturn: null,
    dailyReturnFormula: "Start",
    signalExplanation: "Cash (start)",
    strategyDailyReturn: 0,
    strategyEquity: strategyEquity[0],
    buyHoldEquity: buyHoldEquity[0]
  }];
  let trades = 0;
  let investedDays = 0;

  for (let index = 1; index < data.length; index += 1) {
    // Daily return measures the one-day price change: today's close divided by yesterday's close, minus 1.
    const dailyReturn = closes[index] / closes[index - 1] - 1;

    // Use yesterday's signal for today's return to avoid using future information.
    const yesterday = index - 1;
    const invested = shortAverage[yesterday] !== null &&
      longAverage[yesterday] !== null &&
      shortAverage[yesterday] > longAverage[yesterday] ? 1 : 0;

    const previousPosition = positions[index - 1];
    if (invested !== previousPosition) {
      // A trade is counted whenever the strategy changes between cash and invested.
      trades += 1;
    }

    investedDays += invested;
    positions.push(invested);
    // Strategy daily return is the market daily return multiplied by 1 when invested, or 0 when in cash.
    const strategyDailyReturn = dailyReturn * invested;
    strategyDailyReturns.push(strategyDailyReturn);
    // Strategy value compounds only the strategy daily return, so cash days keep the value unchanged.
    strategyEquity.push(strategyEquity[index - 1] * (1 + strategyDailyReturn));
    // Buy and hold value compounds every market daily return because it stays invested the whole time.
    buyHoldEquity.push(buyHoldEquity[index - 1] * (1 + dailyReturn));

    dailyRows.push({
      date: data[index].date,
      close: closes[index],
      dailyReturn,
      dailyReturnFormula: `${formatCompactNumber(closes[index])} / ${formatCompactNumber(closes[index - 1])} - 1`,
      signalExplanation: describeSignal(invested, shortAverage[yesterday], longAverage[yesterday]),
      strategyDailyReturn,
      strategyEquity: strategyEquity[index],
      buyHoldEquity: buyHoldEquity[index]
    });
  }

  return {
    dates: data.map((row) => row.date),
    shortAverage,
    longAverage,
    strategyEquity,
    buyHoldEquity,
    positions,
    dailyRows,
    // Total return is final value divided by starting value, minus 1.
    strategyReturn: strategyEquity.at(-1) - 1,
    buyHoldReturn: buyHoldEquity.at(-1) - 1,
    returnDifference: strategyEquity.at(-1) - buyHoldEquity.at(-1),
    maxDrawdown: calculateMaxDrawdown(strategyEquity),
    trades,
    // Exposure is the share of return-generating days where the strategy held the market.
    exposure: investedDays / Math.max(1, data.length - 1),
    bestDailyReturn: Math.max(...strategyDailyReturns),
    worstDailyReturn: Math.min(...strategyDailyReturns)
  };
}

function describeSignal(invested, shortAverage, longAverage) {
  if (shortAverage === null || longAverage === null) {
    return "Cash (not enough averages)";
  }

  const comparison = `${formatCompactNumber(shortAverage)} ${invested ? ">" : "<="} ${formatCompactNumber(longAverage)}`;
  return `${invested ? "Invested" : "Cash"} (${comparison})`;
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

function formatPercentagePoints(value) {
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero"
  }).format(value * 100);

  return `${formatted} pts`;
}

function formatAbsolutePercentagePoints(value) {
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Math.abs(value) * 100);

  return `${formatted} pts`;
}

function formatDebugPercent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatValue(value) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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

function hideDebugPanel() {
  debugMode = false;
  elements.debugPanel.hidden = true;
  elements.debugDailyRows.replaceChildren();
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

  if (longWindow < 3 || longWindow > 200) {
    setSettingsError("Long MA must be between 3 and 200 days.");
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
    return null;
  }

  const { shortWindow, longWindow } = windows;

  if (priceData.length <= longWindow) {
    elements.dataSummary.textContent = "Please use more rows than the long moving average window.";
    return null;
  }

  const result = calculateBacktest(priceData, shortWindow, longWindow);
  latestBacktest = result;
  elements.strategyReturn.textContent = formatPercent(result.strategyReturn);
  elements.buyHoldReturn.textContent = formatPercent(result.buyHoldReturn);
  elements.returnDifference.textContent = formatPercentagePoints(result.returnDifference);
  elements.maxDrawdown.textContent = formatPercent(result.maxDrawdown);
  elements.tradeCount.textContent = String(result.trades);
  elements.exposure.textContent = formatPercent(result.exposure);
  elements.bestDailyReturn.textContent = formatPercent(result.bestDailyReturn);
  elements.worstDailyReturn.textContent = formatPercent(result.worstDailyReturn);

  const latestPosition = result.positions.at(-1);
  elements.latestSignal.textContent = latestPosition ? "Invested" : "In cash";
  elements.latestDate.textContent = result.dates.at(-1);
  elements.dataSummary.textContent = `${priceData.length} rows loaded. Short MA: ${shortWindow} days. Long MA: ${longWindow} days.`;
  elements.interpretationText.textContent = buildInterpretation(result);

  drawChart(result);
  if (debugMode) {
    renderDebugPanel(result);
  }

  return { result, windows };
}

function buildInterpretation(result) {
  const comparison = result.returnDifference >= 0 ? "beat" : "trailed";
  const meaning = result.returnDifference >= 0
    ? "In this sample, the moving-average rule added value versus simply staying invested."
    : "In this sample, simply staying invested did better than switching between cash and the market.";
  const difference = formatAbsolutePercentagePoints(result.returnDifference);
  const drawdown = formatPercent(Math.abs(result.maxDrawdown));
  const exposure = formatPercent(result.exposure);
  const bestDay = formatPercent(result.bestDailyReturn);
  const worstDay = formatPercent(result.worstDailyReturn);

  return `The strategy ${comparison} Buy & Hold by ${difference}. ${meaning} It was invested ${exposure} of the time, so the remaining days were spent in cash. Its largest drop from a previous high was ${drawdown}, which is the main pain point to compare with the total return. Best strategy day: ${bestDay}. Worst strategy day: ${worstDay}.`;
}

function renderDebugPanel(result) {
  // The equity curves start at 1, so multiply by 100 to show values from a 100 starting balance.
  const finalStrategyValue = result.strategyEquity.at(-1) * VALIDATION_STARTING_VALUE;
  const finalBuyHoldValue = result.buyHoldEquity.at(-1) * VALIDATION_STARTING_VALUE;

  elements.debugPanel.hidden = false;
  elements.debugFinalStrategyValue.textContent = formatValue(finalStrategyValue);
  elements.debugFinalBuyHoldValue.textContent = formatValue(finalBuyHoldValue);
  // Total return is shown for the strategy because it is the debug mode's primary result.
  elements.debugTotalReturn.textContent = formatDebugPercent(result.strategyReturn);
  elements.debugCalculationNote.textContent =
    `Start value is ${VALIDATION_STARTING_VALUE}. Daily return = today's price / yesterday's price - 1. Strategy value changes only when yesterday's 2-day average is above yesterday's 3-day average.`;

  const rows = result.dailyRows.map((row) => {
    const tableRow = document.createElement("tr");
    // Each row shows the raw daily-return formula, the signal used, and the two compounded values.
    const cells = [
      row.date,
      formatValue(row.close),
      row.dailyReturn === null ? "Start" : `${row.dailyReturnFormula} = ${formatDebugPercent(row.dailyReturn)}`,
      row.signalExplanation,
      formatDebugPercent(row.strategyDailyReturn),
      formatValue(row.strategyEquity * VALIDATION_STARTING_VALUE),
      formatValue(row.buyHoldEquity * VALIDATION_STARTING_VALUE)
    ];

    cells.forEach((cell) => {
      const tableCell = document.createElement("td");
      tableCell.textContent = cell;
      tableRow.append(tableCell);
    });

    return tableRow;
  });

  elements.debugDailyRows.replaceChildren(...rows);
}

function buildHistoryEntry(result, windows) {
  return {
    shortWindow: windows.shortWindow,
    longWindow: windows.longWindow,
    strategyReturn: result.strategyReturn,
    maxDrawdown: result.maxDrawdown,
    returnDifference: result.returnDifference
  };
}

function addCurrentResultToHistory() {
  if (debugMode) {
    return;
  }

  const current = updateApp();
  if (!current) {
    return;
  }

  strategyHistory = [
    buildHistoryEntry(current.result, current.windows),
    ...strategyHistory
  ].slice(0, 5);
  renderStrategyHistory();
}

function resetStrategyHistory() {
  if (debugMode) {
    return;
  }

  const current = updateApp();
  strategyHistory = current ? [buildHistoryEntry(current.result, current.windows)] : [];
  renderStrategyHistory();
}

function hideStrategyHistory() {
  strategyHistory = [];
  elements.historyPanel.hidden = true;
  elements.historyRows.replaceChildren();
}

function renderStrategyHistory() {
  if (strategyHistory.length === 0) {
    elements.historyPanel.hidden = true;
    elements.historyRows.replaceChildren();
    return;
  }

  elements.historyPanel.hidden = false;
  const differences = strategyHistory.map((entry) => entry.returnDifference);
  const shouldHighlight = strategyHistory.length >= 3;
  const bestDifference = Math.max(...differences);
  const worstDifference = Math.min(...differences);

  const rows = strategyHistory.map((entry) => {
    const tableRow = document.createElement("tr");
    const cells = [
      ["Short average", entry.shortWindow],
      ["Long average", entry.longWindow],
      ["Strategy return", formatPercent(entry.strategyReturn)],
      ["Max drawdown", formatPercent(entry.maxDrawdown)]
    ];

    cells.forEach(([label, cell]) => {
      const tableCell = document.createElement("td");
      tableCell.dataset.label = label;
      tableCell.textContent = String(cell);
      tableRow.append(tableCell);
    });

    const differenceCell = document.createElement("td");
    differenceCell.dataset.label = "Difference";
    differenceCell.textContent = formatPercentagePoints(entry.returnDifference);
    if (shouldHighlight && bestDifference !== worstDifference) {
      differenceCell.classList.toggle("is-best-difference", entry.returnDifference === bestDifference);
      differenceCell.classList.toggle("is-worst-difference", entry.returnDifference === worstDifference);
    }
    tableRow.append(differenceCell);

    return tableRow;
  });

  elements.historyRows.replaceChildren(...rows);
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
  const isNarrow = width < 420;
  const padding = {
    top: 28,
    right: isNarrow ? 14 : 124,
    bottom: isNarrow ? 38 : 42,
    left: isNarrow ? 46 : 56
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const allValues = result.strategyEquity.concat(result.buyHoldEquity);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = Math.max(0.04, rawMax - rawMin);
  const minValue = Math.max(0, rawMin - range * 0.12);
  const maxValue = rawMax + range * 0.12;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  drawGrid(context, padding, chartWidth, chartHeight, minValue, maxValue);
  drawStartingLine(context, padding, chartWidth, chartHeight, minValue, maxValue);
  drawLine(context, result.buyHoldEquity, "#c76f1f", padding, chartWidth, chartHeight, minValue, maxValue);
  drawLine(context, result.strategyEquity, "#0e7c66", padding, chartWidth, chartHeight, minValue, maxValue);
  drawEndpointLabel(context, result.buyHoldEquity, "Buy & Hold", "#9b4f12", padding, chartWidth, chartHeight, minValue, maxValue, isNarrow);
  drawEndpointLabel(context, result.strategyEquity, "Strategy", "#075f4c", padding, chartWidth, chartHeight, minValue, maxValue, isNarrow);
  drawAxisLabels(context, result, padding, width, height);
}

function drawGrid(context, padding, chartWidth, chartHeight, minValue, maxValue) {
  context.strokeStyle = "#e5ece5";
  context.fillStyle = "#66716c";
  context.lineWidth = 1;
  context.font = "12px system-ui, sans-serif";
  context.textBaseline = "middle";

  for (let line = 0; line <= 4; line += 1) {
    const y = padding.top + chartHeight * (line / 4);
    const value = maxValue - (maxValue - minValue) * (line / 4);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + chartWidth, y);
    context.stroke();
    context.fillText(`${formatChartValue(value)}x`, 4, y);
  }
}

function drawStartingLine(context, padding, chartWidth, chartHeight, minValue, maxValue) {
  const startY = padding.top + chartHeight - ((1 - minValue) / (maxValue - minValue)) * chartHeight;

  if (startY < padding.top || startY > padding.top + chartHeight) {
    return;
  }

  context.save();
  context.strokeStyle = "#b7c5bb";
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(padding.left, startY);
  context.lineTo(padding.left + chartWidth, startY);
  context.stroke();
  context.restore();
}

function drawLine(context, values, color, padding, chartWidth, chartHeight, minValue, maxValue) {
  context.strokeStyle = color;
  context.lineWidth = 3.5;
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

function drawEndpointLabel(context, values, label, color, padding, chartWidth, chartHeight, minValue, maxValue, isNarrow) {
  if (isNarrow) {
    return;
  }

  const value = values.at(-1);
  const labelText = `${label} ${formatChartValue(value)}x`;
  context.font = "700 12px system-ui, sans-serif";
  const labelWidth = context.measureText(labelText).width;
  const x = padding.left + chartWidth + 8;
  const rawY = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
  const y = Math.min(padding.top + chartHeight - 10, Math.max(padding.top + 10, rawY));

  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(labelText, x - Math.max(0, labelWidth - padding.right + 16), y);
}

function drawAxisLabels(context, result, padding, width, height) {
  context.fillStyle = "#5b6762";
  context.font = "12px system-ui, sans-serif";
  context.textBaseline = "alphabetic";
  context.fillText(result.dates[0], padding.left, height - 10);

  const lastDate = result.dates.at(-1);
  const dateWidth = context.measureText(lastDate).width;
  context.fillText(lastDate, width - dateWidth - 10, height - 10);

  context.strokeStyle = "#b7c5bb";
  context.lineWidth = 1;
  context.strokeRect(padding.left, padding.top, width - padding.left - padding.right, height - padding.top - padding.bottom);

  // These labels make it clear that equity starts at 1.00 times the starting value.
  context.fillStyle = "#17211e";
  context.font = "700 12px system-ui, sans-serif";
  context.fillText("Portfolio value", padding.left, 16);
}

function formatChartValue(value) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
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
    hideDebugPanel();
    resetStrategyHistory();
  } catch (error) {
    elements.dataSummary.textContent = error.message;
  }
}

function loadValidationDataset() {
  priceData = buildValidationData();
  debugMode = true;
  hideStrategyHistory();
  elements.shortWindow.value = VALIDATION_SHORT_WINDOW;
  elements.longWindow.value = VALIDATION_LONG_WINDOW;
  elements.csvFile.value = "";
  updateApp();
}

function resetApp() {
  priceData = buildEmbeddedSampleData();
  hideDebugPanel();
  elements.shortWindow.value = DEFAULT_SHORT_WINDOW;
  elements.longWindow.value = DEFAULT_LONG_WINDOW;
  elements.csvFile.value = "";
  resetStrategyHistory();
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
elements.runButton.addEventListener("click", addCurrentResultToHistory);
elements.resetButton.addEventListener("click", resetApp);
elements.validationButton.addEventListener("click", loadValidationDataset);
window.addEventListener("resize", () => {
  if (latestBacktest) {
    drawChart(latestBacktest);
  }
});

registerServiceWorker();
resetStrategyHistory();
