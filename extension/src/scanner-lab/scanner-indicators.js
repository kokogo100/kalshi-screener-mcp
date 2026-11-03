export function normalizeOhlcvRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          time: Number(row[0]),
          open: toNumber(row[1]),
          high: toNumber(row[2]),
          low: toNumber(row[3]),
          close: toNumber(row[4]),
          vwap: toNumber(row[5]),
          volume: toNumber(row[6]),
          trades: toNumber(row[7])
        };
      }
      return {
        time: Number(row.time ?? row.timestamp ?? row.datetime ?? 0),
        open: toNumber(row.open ?? row.o),
        high: toNumber(row.high ?? row.h),
        low: toNumber(row.low ?? row.l),
        close: toNumber(row.close ?? row.c),
        vwap: toNumber(row.vwap ?? row.vw),
        volume: toNumber(row.volume ?? row.vol ?? row.v),
        trades: toNumber(row.trades ?? row.count)
      };
    })
    .filter((row) => Number.isFinite(row.time))
    .sort((a, b) => a.time - b.time);
}

export function seriesFromOhlcv(rows = [], source = "close") {
  return normalizeOhlcvRows(rows).map((row) => valueForSource(row, source));
}

export function computeIndicatorLatest(metric, rows = [], parameters = {}) {
  return last(computeIndicatorSeries(metric, rows, parameters));
}

export function computeIndicatorSeries(metric, rows = [], parameters = {}) {
  const candles = normalizeOhlcvRows(rows);
  const duration = ({ "1m": 60000, "15m": 900000, "1h": 3600000, "1d": 86400000 })[parameters.timeframe];
  const output = candles.map(() => NaN);
  const fields = indicatorFields(metric, parameters.source || "close");
  let segmentStart = 0;
  const flush = (end) => {
    if (end <= segmentStart) return;
    if (segmentStart > 0 && ["obv", "ad", "positive_volume_index", "negative_volume_index"].includes(metric)) return;
    const values = computeContinuousIndicatorSeries(metric, candles.slice(segmentStart, end), parameters);
    if (segmentStart > 0 && ["consecutive_up_candles", "consecutive_down_candles"].includes(metric)) {
      let boundaryUnknown = true;
      for (let index = 0; index < values.length; index++) {
        if (values[index] === 0) boundaryUnknown = false;
        if (boundaryUnknown) values[index] = NaN;
      }
    }
    for (let index = segmentStart; index < end; index++) output[index] = values[index - segmentStart];
  };
  for (let index = 0; index < candles.length; index++) {
    const valid = fields.every((field) => Number.isFinite(candles[index][field]));
    const gap = index > 0 && duration && candles[index].time - candles[index - 1].time !== duration;
    if (!valid || gap) {
      flush(index);
      segmentStart = valid ? index : index + 1;
    }
  }
  flush(candles.length);
  return output;
}

function indicatorFields(metric, source) {
  const sourceFields = { hl2: ["high", "low"], hlc3: ["high", "low", "close"], ohlc4: ["open", "high", "low", "close"] }[source] || [source];
  if (["close", "open", "high", "low"].includes(metric)) return [metric];
  if (["candle_volume", "average_volume", "relative_volume", "volume_ma_ratio", "volume_ratio_previous", "volume_breakout", "volume_oscillator", "volume_roc"].includes(metric)) return ["volume"];
  if (metric === "quote_turnover") return ["volume", "vwap"];
  if (["vwma", "correl"].includes(metric)) return [...sourceFields, "volume"];
  if (["sma", "ema", "wma", "dema", "tema", "trima", "kama", "t3", "sma_cross", "ema_cross", "ma_alignment_3", "ma_alignment_4", "ma_distance_pct", "rsi", "macd", "macd_signal", "macd_histogram", "momentum", "roc", "rocp", "rocr", "stoch_rsi", "cmo", "trix", "stddev", "variance", "volatility_expanding", "volatility_contracting", "bb_width", "bb_percent_b", "bb_upper_distance", "bb_lower_distance", "envelope_position", "midpoint", "max", "min", "maxindex", "minindex", "apo", "ppo", "linear_regression_slope", "linear_regression_angle", "tsf"].includes(metric)) return sourceFields;
  if (["rolling_24h_change_pct", "n_candle_change_pct"].includes(metric)) return ["close"];
  if (["obv", "positive_volume_index", "negative_volume_index"].includes(metric)) return ["close", "volume"];
  if (["ad", "adosc", "mfi"].includes(metric)) return ["high", "low", "close", "volume"];
  return ["open", "high", "low", "close"];
}

function computeContinuousIndicatorSeries(metric, rows = [], parameters = {}) {
  const candles = normalizeOhlcvRows(rows);
  if (!candles.length) return [];
  const source = parameters.source || "close";
  const length = positiveInteger(parameters.length ?? parameters.lookback, 14);
  const values = seriesFromOhlcv(candles, source);
  const volume = candles.map((candle) => candle.volume);

  if (metric === "close") return candles.map((candle) => candle.close);
  if (metric === "open") return candles.map((candle) => candle.open);
  if (metric === "high") return candles.map((candle) => candle.high);
  if (metric === "low") return candles.map((candle) => candle.low);
  if (metric === "sma") return sma(values, length);
  if (metric === "ema") return ema(values, length);
  if (metric === "wma") return wma(values, length);
  if (metric === "dema") return dema(values, length);
  if (metric === "tema") return tema(values, length);
  if (metric === "trima") return sma(sma(values, Math.max(1, Math.ceil(length / 2))), Math.max(1, Math.floor(length / 2) + 1));
  if (metric === "kama") return kama(values, length);
  if (metric === "t3") return t3(values, length, parameters.vFactor ?? 0.7);
  if (metric === "vwma") return vwma(candles, length, source);
  if (metric === "sma_cross") return crossDifference(values, sma(values, length));
  if (metric === "ema_cross") return crossDifference(values, ema(values, length));
  if (metric === "ma_alignment_3") return maAlignment(values, [Math.max(2, Math.floor(length / 2)), length, length * 2]);
  if (metric === "ma_alignment_4") return maAlignment(values, [Math.max(2, Math.floor(length / 3)), Math.max(3, Math.floor(length / 2)), length, length * 2]);
  if (metric === "ma_distance_pct") return maDistance(values, length);
  if (metric === "volume_ma_ratio") return volumeMaRatio(candles, length);
  if (metric === "rsi") return rsi(values, length);
  if (metric === "macd") return macd(values, parameters).macd;
  if (metric === "macd_signal") return macd(values, parameters).signal;
  if (metric === "macd_histogram") return macd(values, parameters).histogram;
  if (metric === "momentum") return momentum(values, length);
  if (metric === "roc" || metric === "rocp") return roc(values, length);
  if (metric === "rocr") return rocr(values, length);
  if (metric === "cci") return cci(candles, length);
  if (metric === "stochastic_k") return stochastic(candles, length).k;
  if (metric === "stochastic_d") return stochastic(candles, length).d;
  if (metric === "stoch_rsi") return stochasticSeries(rsi(values, length), length);
  if (metric === "cmo") return cmo(values, length);
  if (metric === "willr") return williamsR(candles, length);
  if (metric === "ultimate_oscillator") return ultimateOscillator(candles);
  if (metric === "trix") return trix(values, length);
  if (metric === "bop") return candles.map((candle) => safeDivide(candle.close - candle.open, candle.high - candle.low));
  if (metric === "atr") return atr(candles, length);
  if (metric === "natr") return atr(candles, length).map((value, index) => safeDivide(value, candles[index].close) * 100);
  if (metric === "true_range") return trueRange(candles);
  if (metric === "stddev") return stddev(values, length);
  if (metric === "variance") return stddev(values, length).map((value) => Number.isFinite(value) ? value * value : NaN);
  if (metric === "mass_index") return massIndex(candles, length);
  if (metric === "volatility_expanding") return volatilityState(values, length, true);
  if (metric === "volatility_contracting") return volatilityState(values, length, false);
  if (metric === "bb_width") return bollinger(values, length, parameters.multiplier || 2).width;
  if (metric === "bb_percent_b") return bollinger(values, length, parameters.multiplier || 2).percentB;
  if (metric === "bb_upper_distance") {
    const bands = bollinger(values, length, parameters.multiplier || 2);
    return values.map((value, index) => value - bands.upper[index]);
  }
  if (metric === "bb_lower_distance") {
    const bands = bollinger(values, length, parameters.multiplier || 2);
    return values.map((value, index) => value - bands.lower[index]);
  }
  if (metric === "envelope_position") return envelopePosition(values, length, parameters.percent || 2.5);
  if (metric === "keltner_position") return keltnerPosition(candles, length, parameters.multiplier || 2);
  if (metric === "donchian_position") return donchianPosition(candles, length);
  if (metric === "pivot_position") return pivotPosition(candles);
  if (metric === "ichimoku_position") return ichimokuPosition(candles);
  if (metric === "midpoint") return midpoint(values, length);
  if (metric === "midprice") return midprice(candles, length);
  if (metric === "obv") return obv(candles);
  if (metric === "ad") return accumulationDistribution(candles);
  if (metric === "adosc") return adosc(candles, parameters.fast || 3, parameters.slow || 10);
  if (metric === "mfi") return mfi(candles, length);
  if (metric === "volume_oscillator") return volumeOscillator(candles, parameters.fast || 12, parameters.slow || 26);
  if (metric === "positive_volume_index") return positiveVolumeIndex(candles);
  if (metric === "negative_volume_index") return negativeVolumeIndex(candles);
  if (metric === "volume_roc") return roc(volume, length);
  if (metric === "avgprice") return candles.map((candle) => (candle.open + candle.high + candle.low + candle.close) / 4);
  if (metric === "medprice") return candles.map((candle) => (candle.high + candle.low) / 2);
  if (metric === "typprice") return candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  if (metric === "wclprice") return candles.map((candle) => (candle.high + candle.low + candle.close * 2) / 4);
  if (metric === "max") return rollingExtreme(values, length, true);
  if (metric === "min") return rollingExtreme(values, length, false);
  if (metric === "maxindex") return rollingExtremeIndex(values, length, true);
  if (metric === "minindex") return rollingExtremeIndex(values, length, false);
  if (metric === "correl") return correlation(values, volume, length);
  if (metric === "candle_volume") return volume;
  if (metric === "average_volume") return sma(volume, length);
  if (metric === "relative_volume") return volume.map((value, index) => safeDivide(value, sma(volume, length)[index]));
  if (metric === "volume_ratio_previous") return volume.map((value, index) => index ? safeDivide(value, volume[index - 1]) * 100 : NaN);
  if (metric === "volume_breakout") {
    const average = sma(volume, length);
    return volume.map((value, index) => safeDivide(value, average[index]));
  }
  if (metric === "quote_turnover") return candles.map((candle) => candle.vwap * candle.volume);
  if (metric === "rolling_24h_change_pct" || metric === "n_candle_change_pct") {
    return candles.map((candle, index) => {
      const previous = candles[index - length]?.close;
      return previous ? ((candle.close - previous) / previous) * 100 : NaN;
    });
  }
  if (metric === "candle_body_pct") return candles.map((candle) => safeDivide(Math.abs(candle.close - candle.open), candle.open) * 100);
  if (metric === "candle_range_pct") return candles.map((candle) => safeDivide(candle.high - candle.low, candle.open) * 100);
  if (metric === "upper_wick_pct") return candles.map((candle) => safeDivide(candle.high - Math.max(candle.open, candle.close), candle.open) * 100);
  if (metric === "lower_wick_pct") return candles.map((candle) => safeDivide(Math.min(candle.open, candle.close) - candle.low, candle.open) * 100);
  if (metric === "close_near_high_pct") return candles.map((candle) => safeDivide(candle.high - candle.close, candle.high - candle.low) * 100);
  if (metric === "close_near_low_pct") return candles.map((candle) => safeDivide(candle.close - candle.low, candle.high - candle.low) * 100);
  if (metric === "n_candle_high_breakout") return breakoutState(candles, length, true);
  if (metric === "n_candle_low_breakdown") return breakoutState(candles, length, false);
  if (metric === "consecutive_up_candles") return consecutiveCandles(candles, true);
  if (metric === "consecutive_down_candles") return consecutiveCandles(candles, false);
  if (metric === "gap_up_pct") return gapPercent(candles, true);
  if (metric === "gap_down_pct") return gapPercent(candles, false);
  if (metric === "adx") return directionalMovement(candles, length).adx;
  if (metric === "adxr") return directionalMovement(candles, length).adxr;
  if (metric === "dx") return directionalMovement(candles, length).dx;
  if (metric === "plus_di") return directionalMovement(candles, length).plusDi;
  if (metric === "minus_di") return directionalMovement(candles, length).minusDi;
  if (metric === "aroon_up") return aroon(candles, length).up;
  if (metric === "aroon_down") return aroon(candles, length).down;
  if (metric === "aroon_osc") {
    const result = aroon(candles, length);
    return result.up.map((value, index) => value - result.down[index]);
  }
  if (metric === "apo") return apo(values, parameters.fast || 12, parameters.slow || 26);
  if (metric === "ppo") return ppo(values, parameters.fast || 12, parameters.slow || 26);
  if (metric === "linear_regression_slope") return linearRegression(values, length).slope;
  if (metric === "linear_regression_angle") return linearRegression(values, length).angle;
  if (metric === "tsf") return linearRegression(values, length).forecast;
  if (metric === "parabolic_sar_position") return parabolicSarPosition(candles);
  if (metric === "supertrend_direction") return supertrendDirection(candles, length, parameters.multiplier || 3);
  if (metric === "candlestick_pattern") return candlestickPattern(candles, parameters.pattern);
  return candles.map(() => NaN);
}

export function computeCrossValues(metric, compareTo, rows = [], parameters = {}) {
  const candles = normalizeOhlcvRows(rows);
  if (candles.length < 2) return null;
  const duration = ({ "1m": 60000, "15m": 900000, "1h": 3600000, "1d": 86400000 })[parameters.timeframe];
  if (duration && candles.at(-1).time - candles.at(-2).time !== duration) return null;
  const leftSeries = crossLeftSeries(metric, candles, parameters);
  const rightSeries = crossRightSeries(metric, compareTo, candles, parameters);
  const currentIndex = candles.length - 1;
  const previousIndex = candles.length - 2;
  return {
    previousLeft: leftSeries[previousIndex],
    previousRight: rightSeries[previousIndex],
    currentLeft: leftSeries[currentIndex],
    currentRight: rightSeries[currentIndex],
    currentDiff: leftSeries[currentIndex] - rightSeries[currentIndex]
  };
}

export function sma(values = [], length = 14) {
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    return sum(window) / length;
  });
}

export function ema(values = [], length = 14) {
  const multiplier = 2 / (length + 1);
  const output = [];
  let previous = NaN;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      output.push(NaN);
      return;
    }
    if (index + 1 < length) {
      output.push(NaN);
      return;
    }
    if (!Number.isFinite(previous)) previous = sum(values.slice(index + 1 - length, index + 1)) / length;
    else previous = (value - previous) * multiplier + previous;
    output.push(previous);
  });
  return output;
}

export function wma(values = [], length = 14) {
  const weightSum = (length * (length + 1)) / 2;
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    return values.slice(index + 1 - length, index + 1)
      .reduce((total, value, offset) => total + value * (offset + 1), 0) / weightSum;
  });
}

export function dema(values = [], length = 14) {
  const first = ema(values, length);
  const second = ema(first, length);
  return first.map((value, index) => Number.isFinite(value) && Number.isFinite(second[index])
    ? value * 2 - second[index]
    : NaN);
}

export function tema(values = [], length = 14) {
  const first = ema(values, length);
  const second = ema(first, length);
  const third = ema(second, length);
  return first.map((value, index) => Number.isFinite(value) && Number.isFinite(second[index]) && Number.isFinite(third[index])
    ? value * 3 - second[index] * 3 + third[index]
    : NaN);
}

export function vwma(candles = [], length = 14, source = "close") {
  return candles.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const volumeSum = sum(window.map((candle) => candle.volume));
    if (!volumeSum) return NaN;
    return window.reduce((total, candle) => total + valueForSource(candle, source) * candle.volume, 0) / volumeSum;
  });
}

export function rsi(values = [], length = 14) {
  const output = values.map(() => NaN);
  if (values.length <= length) return output;
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  gain /= length;
  loss /= length;
  output[length] = rsiValue(gain, loss);
  for (let index = length + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    gain = (gain * (length - 1) + Math.max(change, 0)) / length;
    loss = (loss * (length - 1) + Math.max(-change, 0)) / length;
    output[index] = rsiValue(gain, loss);
  }
  return output;
}

export function macd(values = [], parameters = {}) {
  const fast = positiveInteger(parameters.fast, 12);
  const slow = positiveInteger(parameters.slow, 26);
  const signalLength = positiveInteger(parameters.signal, 9);
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = values.map((_, index) => Number.isFinite(fastEma[index]) && Number.isFinite(slowEma[index])
    ? fastEma[index] - slowEma[index]
    : NaN);
  const signal = ema(macdLine, signalLength);
  return {
    macd: macdLine,
    signal,
    histogram: macdLine.map((value, index) => Number.isFinite(value) && Number.isFinite(signal[index])
      ? value - signal[index]
      : NaN)
  };
}

export function bollinger(values = [], length = 20, multiplier = 2) {
  const basis = sma(values, length);
  const deviation = stddev(values, length);
  const upper = basis.map((value, index) => Number.isFinite(value) ? value + deviation[index] * multiplier : NaN);
  const lower = basis.map((value, index) => Number.isFinite(value) ? value - deviation[index] * multiplier : NaN);
  return {
    basis,
    upper,
    lower,
    width: basis.map((value, index) => value ? ((upper[index] - lower[index]) / value) * 100 : NaN),
    percentB: values.map((value, index) => {
      const range = upper[index] - lower[index];
      return Number.isFinite(range) && range !== 0 ? (value - lower[index]) / range : NaN;
    })
  };
}

export function stddev(values = [], length = 14) {
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    const mean = sum(window) / length;
    return Math.sqrt(sum(window.map((value) => (value - mean) ** 2)) / length);
  });
}

export function trueRange(candles = []) {
  return candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close;
    if (!Number.isFinite(previousClose)) return candle.high - candle.low;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
}

export function atr(candles = [], length = 14) {
  return rma(trueRange(candles), length);
}

export function roc(values = [], length = 14) {
  return values.map((value, index) => {
    const previous = values[index - length];
    return previous ? ((value - previous) / previous) * 100 : NaN;
  });
}

export function rocr(values = [], length = 14) {
  return values.map((value, index) => {
    const previous = values[index - length];
    return previous ? value / previous : NaN;
  });
}

export function momentum(values = [], length = 14) {
  return values.map((value, index) => {
    const previous = values[index - length];
    return Number.isFinite(previous) ? value - previous : NaN;
  });
}

export function stochastic(candles = [], length = 14, smooth = 3) {
  const k = candles.map((candle, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const high = max(window.map((entry) => entry.high));
    const low = min(window.map((entry) => entry.low));
    return high !== low ? ((candle.close - low) / (high - low)) * 100 : NaN;
  });
  return { k, d: sma(k, smooth) };
}

export function williamsR(candles = [], length = 14) {
  return candles.map((candle, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const high = max(window.map((entry) => entry.high));
    const low = min(window.map((entry) => entry.low));
    return high !== low ? ((high - candle.close) / (high - low)) * -100 : NaN;
  });
}

export function cci(candles = [], length = 20) {
  const typical = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const typicalSma = sma(typical, length);
  return typical.map((value, index) => {
    if (index + 1 < length) return NaN;
    const window = typical.slice(index + 1 - length, index + 1);
    const meanDeviation = sum(window.map((entry) => Math.abs(entry - typicalSma[index]))) / length;
    return meanDeviation ? (value - typicalSma[index]) / (0.015 * meanDeviation) : NaN;
  });
}

export function obv(candles = []) {
  const output = [];
  let current = 0;
  candles.forEach((candle, index) => {
    if (index === 0) {
      output.push(current);
      return;
    }
    if (candle.close > candles[index - 1].close) current += candle.volume;
    if (candle.close < candles[index - 1].close) current -= candle.volume;
    output.push(current);
  });
  return output;
}

export function accumulationDistribution(candles = []) {
  let current = 0;
  return candles.map((candle) => {
    const range = candle.high - candle.low;
    const multiplier = range ? ((candle.close - candle.low) - (candle.high - candle.close)) / range : 0;
    current += multiplier * candle.volume;
    return current;
  });
}

export function mfi(candles = [], length = 14) {
  const typical = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const moneyFlow = typical.map((value, index) => value * candles[index].volume);
  return candles.map((_, index) => {
    if (index + 1 < length) return NaN;
    let positive = 0;
    let negative = 0;
    for (let offset = index + 1 - length; offset <= index; offset += 1) {
      if (offset === 0) continue;
      if (typical[offset] > typical[offset - 1]) positive += moneyFlow[offset];
      if (typical[offset] < typical[offset - 1]) negative += moneyFlow[offset];
    }
    if (!negative) return 100;
    const ratio = positive / negative;
    return 100 - 100 / (1 + ratio);
  });
}

export function valueForSource(candle = {}, source = "close") {
  if (source === "open") return candle.open;
  if (source === "high") return candle.high;
  if (source === "low") return candle.low;
  if (source === "hl2") return (candle.high + candle.low) / 2;
  if (source === "hlc3") return (candle.high + candle.low + candle.close) / 3;
  if (source === "ohlc4") return (candle.open + candle.high + candle.low + candle.close) / 4;
  if (source === "volume") return candle.volume;
  if (source === "vwap") return candle.vwap;
  return candle.close;
}

function crossLeftSeries(metric, candles, parameters) {
  const sourceValues = seriesFromOhlcv(candles, parameters.source || "close");
  if (metric === "sma_cross" || metric === "ema_cross") return sourceValues;
  return computeIndicatorSeries(metric, candles, parameters);
}

function crossRightSeries(metric, compareTo, candles, parameters) {
  if (metric === "sma_cross" || metric === "ema_cross") return computeIndicatorSeries(metric === "sma_cross" ? "sma" : "ema", candles, { ...parameters, length: positiveInteger(parameters.length ?? parameters.lookback, 20) });
  return computeIndicatorSeries(compareTo, candles, parameters);
}

function crossDifference(left = [], right = []) {
  return left.map((value, index) => value - right[index]);
}

function maAlignment(values = [], lengths = []) {
  const averages = lengths.map((length) => sma(values, length));
  return values.map((_, index) => {
    const current = averages.map((series) => series[index]);
    if (!current.every(Number.isFinite)) return NaN;
    const bullish = current.every((value, offset) => offset === 0 || current[offset - 1] > value);
    const bearish = current.every((value, offset) => offset === 0 || current[offset - 1] < value);
    if (bullish) return 1;
    if (bearish) return -1;
    return 0;
  });
}

function maDistance(values = [], length = 20) {
  const average = sma(values, length);
  return values.map((value, index) => safeDivide(value - average[index], average[index]) * 100);
}

function volumeMaRatio(candles = [], length = 20) {
  const volume = candles.map((candle) => candle.volume);
  const average = sma(volume, length);
  return volume.map((value, index) => safeDivide(value, average[index]));
}

function kama(values = [], length = 10, fast = 2, slow = 30) {
  const output = values.map(() => NaN);
  const fastSc = 2 / (fast + 1);
  const slowSc = 2 / (slow + 1);
  values.forEach((value, index) => {
    if (index < length) return;
    const change = Math.abs(value - values[index - length]);
    let volatility = 0;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      volatility += Math.abs(values[offset] - values[offset - 1]);
    }
    const er = volatility ? change / volatility : 0;
    const sc = (er * (fastSc - slowSc) + slowSc) ** 2;
    output[index] = Number.isFinite(output[index - 1])
      ? output[index - 1] + sc * (value - output[index - 1])
      : value;
  });
  return output;
}

function t3(values = [], length = 5, vFactor = 0.7) {
  const e1 = ema(values, length);
  const e2 = ema(e1, length);
  const e3 = ema(e2, length);
  const e4 = ema(e3, length);
  const e5 = ema(e4, length);
  const e6 = ema(e5, length);
  const c1 = -(vFactor ** 3);
  const c2 = 3 * vFactor ** 2 + 3 * vFactor ** 3;
  const c3 = -6 * vFactor ** 2 - 3 * vFactor - 3 * vFactor ** 3;
  const c4 = 1 + 3 * vFactor + vFactor ** 3 + 3 * vFactor ** 2;
  return values.map((_, index) => {
    const parts = [e3[index], e4[index], e5[index], e6[index]];
    return parts.every(Number.isFinite) ? c1 * e6[index] + c2 * e5[index] + c3 * e4[index] + c4 * e3[index] : NaN;
  });
}

function cmo(values = [], length = 14) {
  return values.map((_, index) => {
    if (index < length) return NaN;
    let up = 0;
    let down = 0;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      const change = values[offset] - values[offset - 1];
      if (change > 0) up += change;
      else down -= change;
    }
    return up + down ? ((up - down) / (up + down)) * 100 : NaN;
  });
}

function ultimateOscillator(candles = [], short = 7, medium = 14, long = 28) {
  const bp = candles.map((candle, index) => candle.close - Math.min(candle.low, candles[index - 1]?.close ?? candle.low));
  const tr = trueRange(candles);
  return candles.map((_, index) => {
    const avgShort = sum(bp.slice(index + 1 - short, index + 1)) / sum(tr.slice(index + 1 - short, index + 1));
    const avgMedium = sum(bp.slice(index + 1 - medium, index + 1)) / sum(tr.slice(index + 1 - medium, index + 1));
    const avgLong = sum(bp.slice(index + 1 - long, index + 1)) / sum(tr.slice(index + 1 - long, index + 1));
    return index + 1 >= long ? 100 * ((4 * avgShort + 2 * avgMedium + avgLong) / 7) : NaN;
  });
}

function trix(values = [], length = 14) {
  const triple = ema(ema(ema(values, length), length), length);
  return roc(triple, 1);
}

function massIndex(candles = [], length = 25) {
  const range = candles.map((candle) => candle.high - candle.low);
  const single = ema(range, 9);
  const double = ema(single, 9);
  const ratio = single.map((value, index) => safeDivide(value, double[index]));
  return ratio.map((_, index) => index + 1 >= length ? sum(ratio.slice(index + 1 - length, index + 1)) : NaN);
}

function volatilityState(values = [], length = 20, expanding = true) {
  const deviation = stddev(values, length);
  const baseline = sma(deviation, length);
  return deviation.map((value, index) => {
    if (!Number.isFinite(value) || !Number.isFinite(baseline[index])) return NaN;
    return expanding ? Number(value > baseline[index]) : Number(value < baseline[index]);
  });
}

function envelopePosition(values = [], length = 20, percent = 2.5) {
  const basis = sma(values, length);
  return values.map((value, index) => {
    const mid = basis[index];
    if (!Number.isFinite(mid)) return NaN;
    const upper = mid * (1 + percent / 100);
    const lower = mid * (1 - percent / 100);
    if (value > upper) return 1;
    if (value < lower) return -1;
    return 0;
  });
}

function keltnerPosition(candles = [], length = 20, multiplier = 2) {
  const close = candles.map((candle) => candle.close);
  const mid = ema(close, length);
  const range = atr(candles, length);
  return candles.map((candle, index) => {
    if (!Number.isFinite(mid[index]) || !Number.isFinite(range[index])) return NaN;
    if (candle.close > mid[index] + range[index] * multiplier) return 1;
    if (candle.close < mid[index] - range[index] * multiplier) return -1;
    return 0;
  });
}

function donchianPosition(candles = [], length = 20) {
  return candles.map((candle, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const high = max(window.map((entry) => entry.high));
    const low = min(window.map((entry) => entry.low));
    if (candle.close >= high) return 1;
    if (candle.close <= low) return -1;
    return safeDivide(candle.close - low, high - low);
  });
}

function pivotPosition(candles = []) {
  return candles.map((candle, index) => {
    const previous = candles[index - 1];
    if (!previous) return NaN;
    const pivot = (previous.high + previous.low + previous.close) / 3;
    return candle.close > pivot ? 1 : candle.close < pivot ? -1 : 0;
  });
}

function ichimokuPosition(candles = []) {
  return candles.map((candle, index) => {
    if (index + 1 < 52) return NaN;
    const convWindow = candles.slice(index + 1 - 9, index + 1);
    const baseWindow = candles.slice(index + 1 - 26, index + 1);
    const spanWindow = candles.slice(index + 1 - 52, index + 1);
    const conversion = (max(convWindow.map((entry) => entry.high)) + min(convWindow.map((entry) => entry.low))) / 2;
    const base = (max(baseWindow.map((entry) => entry.high)) + min(baseWindow.map((entry) => entry.low))) / 2;
    const spanA = (conversion + base) / 2;
    const spanB = (max(spanWindow.map((entry) => entry.high)) + min(spanWindow.map((entry) => entry.low))) / 2;
    if (candle.close > Math.max(spanA, spanB)) return 1;
    if (candle.close < Math.min(spanA, spanB)) return -1;
    return 0;
  });
}

function midpoint(values = [], length = 14) {
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    return (max(window) + min(window)) / 2;
  });
}

function midprice(candles = [], length = 14) {
  return candles.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    return (max(window.map((entry) => entry.high)) + min(window.map((entry) => entry.low))) / 2;
  });
}

function adosc(candles = [], fast = 3, slow = 10) {
  const ad = accumulationDistribution(candles);
  const fastEma = ema(ad, fast);
  const slowEma = ema(ad, slow);
  return ad.map((_, index) => fastEma[index] - slowEma[index]);
}

function volumeOscillator(candles = [], fast = 12, slow = 26) {
  const volume = candles.map((candle) => candle.volume);
  const fastEma = ema(volume, fast);
  const slowEma = ema(volume, slow);
  return volume.map((_, index) => safeDivide(fastEma[index] - slowEma[index], slowEma[index]) * 100);
}

function positiveVolumeIndex(candles = []) {
  return volumeIndex(candles, true);
}

function negativeVolumeIndex(candles = []) {
  return volumeIndex(candles, false);
}

function volumeIndex(candles = [], positive = true) {
  const output = [];
  let current = 1000;
  candles.forEach((candle, index) => {
    if (index) {
      const volumeRising = candle.volume > candles[index - 1].volume;
      if (volumeRising === positive) current += current * safeDivide(candle.close - candles[index - 1].close, candles[index - 1].close);
    }
    output.push(current);
  });
  return output;
}

function rollingExtreme(values = [], length = 14, highest = true) {
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    return highest ? max(window) : min(window);
  });
}

function rollingExtremeIndex(values = [], length = 14, highest = true) {
  return values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    const extreme = highest ? max(window) : min(window);
    const offset = window.length - 1 - window.lastIndexOf(extreme);
    return offset;
  });
}

function correlation(left = [], right = [], length = 14) {
  return left.map((_, index) => {
    if (index + 1 < length) return NaN;
    const a = left.slice(index + 1 - length, index + 1);
    const b = right.slice(index + 1 - length, index + 1);
    const meanA = sum(a) / length;
    const meanB = sum(b) / length;
    const covariance = sum(a.map((value, offset) => (value - meanA) * (b[offset] - meanB)));
    const deviationA = Math.sqrt(sum(a.map((value) => (value - meanA) ** 2)));
    const deviationB = Math.sqrt(sum(b.map((value) => (value - meanB) ** 2)));
    return safeDivide(covariance, deviationA * deviationB);
  });
}

function breakoutState(candles = [], length = 20, highBreakout = true) {
  return candles.map((candle, index) => {
    if (index < length) return NaN;
    const previous = candles.slice(index - length, index);
    const level = highBreakout ? max(previous.map((entry) => entry.high)) : min(previous.map((entry) => entry.low));
    return highBreakout ? Number(candle.close > level) : Number(candle.close < level);
  });
}

function consecutiveCandles(candles = [], upward = true) {
  let count = 0;
  return candles.map((candle) => {
    const matches = upward ? candle.close > candle.open : candle.close < candle.open;
    count = matches ? count + 1 : 0;
    return count;
  });
}

function gapPercent(candles = [], upward = true) {
  return candles.map((candle, index) => {
    const previous = candles[index - 1];
    if (!previous?.close) return NaN;
    const change = ((candle.open - previous.close) / previous.close) * 100;
    return upward ? Math.max(change, 0) : Math.max(-change, 0);
  });
}

function directionalMovement(candles = [], length = 14) {
  const plusDm = candles.map((candle, index) => {
    if (!index) return 0;
    const up = candle.high - candles[index - 1].high;
    const down = candles[index - 1].low - candle.low;
    return up > down && up > 0 ? up : 0;
  });
  const minusDm = candles.map((candle, index) => {
    if (!index) return 0;
    const up = candle.high - candles[index - 1].high;
    const down = candles[index - 1].low - candle.low;
    return down > up && down > 0 ? down : 0;
  });
  const tr = trueRange(candles);
  const atrValues = rma(tr, length);
  const plusDi = rma(plusDm, length).map((value, index) => safeDivide(value, atrValues[index]) * 100);
  const minusDi = rma(minusDm, length).map((value, index) => safeDivide(value, atrValues[index]) * 100);
  const dx = plusDi.map((value, index) => safeDivide(Math.abs(value - minusDi[index]), value + minusDi[index]) * 100);
  const adx = rma(dx, length);
  const adxr = adx.map((value, index) => index >= length && Number.isFinite(adx[index - length]) ? (value + adx[index - length]) / 2 : NaN);
  return { plusDi, minusDi, dx, adx, adxr };
}

function aroon(candles = [], length = 14) {
  const up = candles.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const highest = max(window.map((entry) => entry.high));
    const periodsSince = window.length - 1 - window.findLastIndex((entry) => entry.high === highest);
    return ((length - periodsSince) / length) * 100;
  });
  const down = candles.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = candles.slice(index + 1 - length, index + 1);
    const lowest = min(window.map((entry) => entry.low));
    const periodsSince = window.length - 1 - window.findLastIndex((entry) => entry.low === lowest);
    return ((length - periodsSince) / length) * 100;
  });
  return { up, down };
}

function apo(values = [], fast = 12, slow = 26) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  return values.map((_, index) => fastEma[index] - slowEma[index]);
}

function ppo(values = [], fast = 12, slow = 26) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  return values.map((_, index) => safeDivide(fastEma[index] - slowEma[index], slowEma[index]) * 100);
}

function linearRegression(values = [], length = 14) {
  const slope = values.map((_, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    const n = window.length;
    const sumX = (n * (n - 1)) / 2;
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
    const sumY = sum(window);
    const sumXY = window.reduce((total, value, x) => total + x * value, 0);
    return safeDivide(n * sumXY - sumX * sumY, n * sumX2 - sumX ** 2);
  });
  return {
    slope,
    angle: slope.map((value) => Math.atan(value) * 180 / Math.PI),
    forecast: slope.map((value, index) => {
      if (!Number.isFinite(value) || index + 1 < length) return NaN;
      const window = values.slice(index + 1 - length, index + 1);
      const intercept = (sum(window) / length) - value * ((length - 1) / 2);
      return intercept + value * length;
    })
  };
}

function parabolicSarPosition(candles = []) {
  if (!candles.length) return [];
  const output = [NaN];
  let long = true;
  let af = 0.02;
  let ep = candles[0].high;
  let sar = candles[0].low;
  for (let index = 1; index < candles.length; index += 1) {
    sar += af * (ep - sar);
    const candle = candles[index];
    if (long) {
      if (candle.low < sar) {
        long = false;
        sar = ep;
        ep = candle.low;
        af = 0.02;
      } else if (candle.high > ep) {
        ep = candle.high;
        af = Math.min(0.2, af + 0.02);
      }
    } else if (candle.high > sar) {
      long = true;
      sar = ep;
      ep = candle.high;
      af = 0.02;
    } else if (candle.low < ep) {
      ep = candle.low;
      af = Math.min(0.2, af + 0.02);
    }
    output.push(candle.close >= sar ? 1 : -1);
  }
  return output;
}

function supertrendDirection(candles = [], length = 10, multiplier = 3) {
  const atrValues = atr(candles, length);
  const output = candles.map(() => NaN);
  let direction = 1;
  candles.forEach((candle, index) => {
    const atrValue = atrValues[index];
    if (!Number.isFinite(atrValue)) return;
    const hl2 = (candle.high + candle.low) / 2;
    const upper = hl2 + multiplier * atrValue;
    const lower = hl2 - multiplier * atrValue;
    if (candle.close > upper) direction = 1;
    else if (candle.close < lower) direction = -1;
    output[index] = direction;
  });
  return output;
}

function candlestickPattern(candles = [], pattern = "") {
  const name = normalizePatternName(pattern);
  const periods = {
    "doji": 1, "long legged doji": 1, "dragonfly doji": 1, "gravestone doji": 1,
    "hammer": 1, "inverted hammer": 1, "hanging man": 1, "shooting star": 1,
    "marubozu": 1, "closing marubozu": 1, "spinning top": 1, "high wave candle": 1,
    "engulfing pattern": 2, "harami pattern": 2, "harami cross": 2, "piercing pattern": 2,
    "dark cloud cover": 2, "kicking": 2, "counterattack": 2,
    "morning star": 3, "morning doji star": 3, "evening star": 3, "evening doji star": 3,
    "three white soldiers": 3, "three black crows": 3, "three inside up down": 3,
    "three outside up down": 3, "tasuki gap": 3, "rise fall three methods": 5, "breakaway": 5
  }[name];
  return candles.map((_, index) => !periods || index + 1 < periods ? NaN : Number(patternMatches(candles, index, pattern)));
}

function patternMatches(candles, index, pattern) {
  const candle = candles[index];
  if (!candle) return false;
  const previous = candles[index - 1];
  const twoBack = candles[index - 2];
  const name = normalizePatternName(pattern);

  if (name === "doji") return isDoji(candle);
  if (name === "long legged doji") return isLongLeggedDoji(candle);
  if (name === "dragonfly doji") return isDragonflyDoji(candle);
  if (name === "gravestone doji") return isGravestoneDoji(candle);
  if (name === "hammer") return isHammerShape(candle);
  if (name === "inverted hammer") return isBullish(candle) && isInvertedHammerShape(candle);
  if (name === "hanging man") return isBearish(candle) && isHammerShape(candle);
  if (name === "shooting star") return isBearish(candle) && isInvertedHammerShape(candle);
  if (name === "engulfing pattern") return previous && isEngulfing(previous, candle);
  if (name === "harami pattern") return previous && isHarami(previous, candle, false);
  if (name === "harami cross") return previous && isHarami(previous, candle, true);
  if (name === "morning star") return twoBack && previous && isMorningStar(twoBack, previous, candle, false);
  if (name === "morning doji star") return twoBack && previous && isMorningStar(twoBack, previous, candle, true);
  if (name === "evening star") return twoBack && previous && isEveningStar(twoBack, previous, candle, false);
  if (name === "evening doji star") return twoBack && previous && isEveningStar(twoBack, previous, candle, true);
  if (name === "marubozu") return isMarubozu(candle);
  if (name === "closing marubozu") return isClosingMarubozu(candle);
  if (name === "spinning top") return isSpinningTop(candle);
  if (name === "high wave candle") return isHighWaveCandle(candle);
  if (name === "piercing pattern") return previous && isPiercingPattern(previous, candle);
  if (name === "dark cloud cover") return previous && isDarkCloudCover(previous, candle);
  if (name === "three white soldiers") return threeDirection(candles, index, true);
  if (name === "three black crows") return threeDirection(candles, index, false);
  if (name === "three inside up down") return threeInsideUpDown(candles, index);
  if (name === "three outside up down") return threeOutsideUpDown(candles, index);
  if (name === "rise fall three methods") return riseFallThreeMethods(candles, index);
  if (name === "tasuki gap") return tasukiGap(candles, index);
  if (name === "breakaway") return breakaway(candles, index);
  if (name === "kicking") return previous && kicking(previous, candle);
  if (name === "counterattack") return previous && counterattack(previous, candle);
  return false;
}

function rma(values = [], length = 14) {
  const output = values.map(() => NaN);
  let previous = NaN;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    if (index + 1 < length) return;
    if (!Number.isFinite(previous)) previous = sum(values.slice(index + 1 - length, index + 1)) / length;
    else previous = (previous * (length - 1) + value) / length;
    output[index] = previous;
  });
  return output;
}

function stochasticSeries(values = [], length = 14) {
  return values.map((value, index) => {
    if (index + 1 < length) return NaN;
    const window = values.slice(index + 1 - length, index + 1);
    const high = max(window);
    const low = min(window);
    return high !== low ? ((value - low) / (high - low)) * 100 : NaN;
  });
}

function rsiValue(gain, loss) {
  if (!loss) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function positiveInteger(value, fallback = 14) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function last(values = []) {
  return values[values.length - 1];
}

function sum(values = []) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function max(values = []) {
  return values.reduce((current, value) => Number.isFinite(value) ? Math.max(current, value) : current, -Infinity);
}

function min(values = []) {
  return values.reduce((current, value) => Number.isFinite(value) ? Math.min(current, value) : current, Infinity);
}

function safeDivide(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : NaN;
}

function normalizePatternName(pattern = "") {
  return String(pattern || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candleStats(candle = {}) {
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const range = high - low;
  const body = Math.abs(close - open);
  const upper = high - Math.max(open, close);
  const lower = Math.min(open, close) - low;
  return {
    open,
    high,
    low,
    close,
    range,
    body,
    upper,
    lower,
    bodyRatio: safeDivide(body, range),
    upperRatio: safeDivide(upper, range),
    lowerRatio: safeDivide(lower, range)
  };
}

function isValidCandle(candle = {}) {
  const stats = candleStats(candle);
  return [stats.open, stats.high, stats.low, stats.close, stats.range].every(Number.isFinite)
    && stats.range > 0
    && stats.high >= Math.max(stats.open, stats.close)
    && stats.low <= Math.min(stats.open, stats.close);
}

function isBullish(candle) {
  return candle && Number(candle.close) > Number(candle.open);
}

function isBearish(candle) {
  return candle && Number(candle.close) < Number(candle.open);
}

function isDoji(candle, maxBodyRatio = 0.12) {
  if (!isValidCandle(candle)) return false;
  return candleStats(candle).bodyRatio <= maxBodyRatio;
}

function isLongLeggedDoji(candle) {
  if (!isDoji(candle, 0.08)) return false;
  const stats = candleStats(candle);
  return stats.upperRatio >= 0.35 && stats.lowerRatio >= 0.35;
}

function isDragonflyDoji(candle) {
  if (!isDoji(candle, 0.12)) return false;
  const stats = candleStats(candle);
  return stats.lowerRatio >= 0.6 && stats.upperRatio <= 0.15;
}

function isGravestoneDoji(candle) {
  if (!isDoji(candle, 0.12)) return false;
  const stats = candleStats(candle);
  return stats.upperRatio >= 0.6 && stats.lowerRatio <= 0.15;
}

function isSmallBody(candle, maxBodyRatio = 0.3) {
  if (!isValidCandle(candle)) return false;
  return candleStats(candle).bodyRatio <= maxBodyRatio;
}

function smallBodyOf(candle) {
  return isSmallBody(candle, 0.3);
}

function isLongBody(candle) {
  if (!isValidCandle(candle)) return false;
  return candleStats(candle).bodyRatio >= 0.6;
}

function isHammerShape(candle) {
  if (!isSmallBody(candle, 0.35)) return false;
  const stats = candleStats(candle);
  return stats.lowerRatio >= 0.55 && stats.upperRatio <= 0.18;
}

function isInvertedHammerShape(candle) {
  if (!isSmallBody(candle, 0.35)) return false;
  const stats = candleStats(candle);
  return stats.upperRatio >= 0.55 && stats.lowerRatio <= 0.18;
}

function isEngulfing(previous, candle) {
  return ((isBullish(candle) && isBearish(previous)) || (isBearish(candle) && isBullish(previous)))
    && bodyEngulfs(candle, previous);
}

function isHarami(previous, candle, requireDoji = false) {
  if (!isLongBody(previous)) return false;
  if (requireDoji && !isDoji(candle, 0.12)) return false;
  if (!requireDoji && isDoji(candle, 0.12)) return false;
  return bodyInside(candle, previous);
}

function isMorningStar(first, middle, lastCandle, requireDoji = false) {
  return isBearish(first)
    && isLongBody(first)
    && (requireDoji ? isDoji(middle, 0.12) : smallBodyOf(middle) && !isDoji(middle, 0.08))
    && isBullish(lastCandle)
    && lastCandle.close > midpointBody(first);
}

function isEveningStar(first, middle, lastCandle, requireDoji = false) {
  return isBullish(first)
    && isLongBody(first)
    && (requireDoji ? isDoji(middle, 0.12) : smallBodyOf(middle) && !isDoji(middle, 0.08))
    && isBearish(lastCandle)
    && lastCandle.close < midpointBody(first);
}

function isMarubozu(candle) {
  if (!isValidCandle(candle)) return false;
  const stats = candleStats(candle);
  return stats.bodyRatio >= 0.75 && stats.upperRatio <= 0.08 && stats.lowerRatio <= 0.08;
}

function isClosingMarubozu(candle) {
  if (!isLongBody(candle)) return false;
  const stats = candleStats(candle);
  return (isBullish(candle) && stats.upperRatio <= 0.05)
    || (isBearish(candle) && stats.lowerRatio <= 0.05);
}

function isSpinningTop(candle) {
  if (!isValidCandle(candle)) return false;
  const stats = candleStats(candle);
  return stats.bodyRatio > 0.08
    && stats.bodyRatio <= 0.3
    && stats.upperRatio >= 0.25
    && stats.lowerRatio >= 0.25;
}

function isHighWaveCandle(candle) {
  if (!isValidCandle(candle)) return false;
  const stats = candleStats(candle);
  return stats.bodyRatio <= 0.25
    && stats.upperRatio >= 0.35
    && stats.lowerRatio >= 0.35;
}

function isPiercingPattern(previous, candle) {
  return isBearish(previous)
    && isLongBody(previous)
    && isBullish(candle)
    && candle.open < previous.low
    && candle.close > midpointBody(previous)
    && candle.close < previous.open;
}

function isDarkCloudCover(previous, candle) {
  return isBullish(previous)
    && isLongBody(previous)
    && isBearish(candle)
    && candle.open > previous.high
    && candle.close < midpointBody(previous)
    && candle.close > previous.open;
}

function bodyInside(candle, container) {
  return Math.max(candle.open, candle.close) < Math.max(container.open, container.close)
    && Math.min(candle.open, candle.close) > Math.min(container.open, container.close);
}

function bodyEngulfs(candle, target) {
  return Math.max(candle.open, candle.close) > Math.max(target.open, target.close)
    && Math.min(candle.open, candle.close) < Math.min(target.open, target.close);
}

function insideRange(candle, container) {
  return candle.high < container.high && candle.low > container.low;
}

function midpointBody(candle) {
  return (candle.open + candle.close) / 2;
}

function threeDirection(candles, index, bullish = true) {
  if (index < 2) return false;
  const rows = [candles[index - 2], candles[index - 1], candles[index]];
  if (!rows.every(isLongBody)) return false;
  if (!rows.every((candle) => bullish ? isBullish(candle) : isBearish(candle))) return false;
  return bullish
    ? rows[1].close > rows[0].close && rows[2].close > rows[1].close
    : rows[1].close < rows[0].close && rows[2].close < rows[1].close;
}

function threeInsideUpDown(candles, index) {
  if (index < 2) return false;
  const first = candles[index - 2];
  const second = candles[index - 1];
  const third = candles[index];
  const inside = bodyInside(second, first) && insideRange(second, first);
  const bullish = isBearish(first) && isBullish(second) && isBullish(third) && third.close > first.open;
  const bearish = isBullish(first) && isBearish(second) && isBearish(third) && third.close < first.open;
  return isLongBody(first) && inside && (bullish || bearish);
}

function threeOutsideUpDown(candles, index) {
  if (index < 2) return false;
  const first = candles[index - 2];
  const second = candles[index - 1];
  const third = candles[index];
  const bullish = isBearish(first) && isBullish(second) && bodyEngulfs(second, first) && isBullish(third) && third.close > second.close;
  const bearish = isBullish(first) && isBearish(second) && bodyEngulfs(second, first) && isBearish(third) && third.close < second.close;
  return bullish || bearish;
}

function riseFallThreeMethods(candles, index) {
  if (index < 4) return false;
  const [first, second, third, fourth, fifth] = candles.slice(index - 4, index + 1);
  const middle = [second, third, fourth];
  const rising = isBullish(first)
    && isLongBody(first)
    && middle.every((candle) => isBearish(candle) && isSmallBody(candle, 0.45) && insideRange(candle, first))
    && isBullish(fifth)
    && isLongBody(fifth)
    && fifth.close > first.close;
  const falling = isBearish(first)
    && isLongBody(first)
    && middle.every((candle) => isBullish(candle) && isSmallBody(candle, 0.45) && insideRange(candle, first))
    && isBearish(fifth)
    && isLongBody(fifth)
    && fifth.close < first.close;
  return rising || falling;
}

function tasukiGap(candles, index) {
  if (index < 2) return false;
  const first = candles[index - 2];
  const second = candles[index - 1];
  const third = candles[index];
  const bullish = isBullish(first)
    && isBullish(second)
    && second.low > first.high
    && isBearish(third)
    && third.open < second.close
    && third.open > second.open
    && third.close > first.high
    && third.close < second.open;
  const bearish = isBearish(first)
    && isBearish(second)
    && second.high < first.low
    && isBullish(third)
    && third.open > second.close
    && third.open < second.open
    && third.close < first.low
    && third.close > second.open;
  return bullish || bearish;
}

function breakaway(candles, index) {
  if (index < 4) return false;
  const [first, second, third, fourth, fifth] = candles.slice(index - 4, index + 1);
  const bullish = isBearish(first)
    && isLongBody(first)
    && isBearish(second)
    && second.high < first.low
    && third.low < second.low
    && fourth.low <= third.low
    && isBullish(fifth)
    && isLongBody(fifth)
    && fifth.close > second.close
    && fifth.close < first.open;
  const bearish = isBullish(first)
    && isLongBody(first)
    && isBullish(second)
    && second.low > first.high
    && third.high > second.high
    && fourth.high >= third.high
    && isBearish(fifth)
    && isLongBody(fifth)
    && fifth.close < second.close
    && fifth.close > first.open;
  return bullish || bearish;
}

function kicking(previous, candle) {
  const bullish = isBearish(previous) && isBullish(candle) && isMarubozu(previous) && isMarubozu(candle) && candle.low > previous.high;
  const bearish = isBullish(previous) && isBearish(candle) && isMarubozu(previous) && isMarubozu(candle) && candle.high < previous.low;
  return bullish || bearish;
}

function counterattack(previous, candle) {
  if (!isLongBody(previous) || !isLongBody(candle)) return false;
  if (!((isBullish(previous) && isBearish(candle)) || (isBearish(previous) && isBullish(candle)))) return false;
  const tolerance = Math.max(candleStats(previous).range, candleStats(candle).range) * 0.08;
  return Math.abs(previous.close - candle.close) <= tolerance;
}
