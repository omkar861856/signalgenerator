use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

pub struct Indicators;

impl Indicators {
    pub fn calculate_sma(prices: &[f64], period: usize) -> Vec<f64> {
        let mut result = vec![0.0; prices.len()];
        if prices.len() < period || period == 0 {
            return result;
        }

        let mut sum = 0.0;
        for i in 0..period {
            sum += prices[i];
        }
        result[period - 1] = sum / period as f64;

        for i in period..prices.len() {
            sum += prices[i] - prices[i - period];
            result[i] = sum / period as f64;
        }

        result
    }

    pub fn calculate_ema(prices: &[f64], period: usize) -> Vec<f64> {
        let mut result = vec![0.0; prices.len()];
        if prices.len() < period || period == 0 {
            return result;
        }

        let k = 2.0 / (period as f64 + 1.0);
        let mut sum = 0.0;
        for i in 0..period {
            sum += prices[i];
        }
        let mut prev_ema = sum / period as f64;
        result[period - 1] = prev_ema;

        for i in period..prices.len() {
            let ema = prices[i] * k + prev_ema * (1.0 - k);
            result[i] = ema;
            prev_ema = ema;
        }

        result
    }

    pub fn calculate_rsi(prices: &[f64], period: usize) -> Vec<f64> {
        let mut result = vec![50.0; prices.len()];
        if prices.len() <= period || period == 0 {
            return result;
        }

        let mut gains = 0.0;
        let mut losses = 0.0;

        for i in 1..=period {
            let diff = prices[i] - prices[i - 1];
            if diff > 0.0 {
                gains += diff;
            } else {
                losses -= diff;
            }
        }

        let mut avg_gain = gains / period as f64;
        let mut avg_loss = losses / period as f64;

        if avg_loss == 0.0 {
            result[period] = 100.0;
        } else {
            let rs = avg_gain / avg_loss;
            result[period] = 100.0 - (100.0 / (1.0 + rs));
        }

        for i in (period + 1)..prices.len() {
            let diff = prices[i] - prices[i - 1];
            if diff > 0.0 {
                avg_gain = (avg_gain * (period as f64 - 1.0) + diff) / period as f64;
                avg_loss = (avg_loss * (period as f64 - 1.0)) / period as f64;
            } else {
                avg_gain = (avg_gain * (period as f64 - 1.0)) / period as f64;
                avg_loss = (avg_loss * (period as f64 - 1.0) - diff) / period as f64;
            }

            if avg_loss == 0.0 {
                result[i] = 100.0;
            } else {
                let rs = avg_gain / avg_loss;
                result[i] = 100.0 - (100.0 / (1.0 + rs));
            }
        }

        result
    }

    pub fn calculate_vwap(candles: &[Candle]) -> Vec<f64> {
        let mut result = vec![0.0; candles.len()];
        let mut cum_tp_vol = 0.0;
        let mut cum_vol = 0.0;

        for (i, candle) in candles.iter().enumerate() {
            let typical_price = (candle.high + candle.low + candle.close) / 3.0;
            cum_tp_vol += typical_price * candle.volume;
            cum_vol += candle.volume;

            result[i] = if cum_vol > 0.0 {
                cum_tp_vol / cum_vol
            } else {
                typical_price
            };
        }

        result
    }

    pub fn calculate_atr(candles: &[Candle], period: usize) -> Vec<f64> {
        let mut result = vec![0.0; candles.len()];
        if candles.len() <= period || period == 0 {
            return result;
        }

        let mut tr_list = Vec::with_capacity(candles.len());
        tr_list.push(candles[0].high - candles[0].low);

        for i in 1..candles.len() {
            let tr1 = candles[i].high - candles[i].low;
            let tr2 = (candles[i].high - candles[i - 1].close).abs();
            let tr3 = (candles[i].low - candles[i - 1].close).abs();
            let tr = tr1.max(tr2).max(tr3);
            tr_list.push(tr);
        }

        let mut sum = 0.0;
        for i in 0..period {
            sum += tr_list[i];
        }
        let mut prev_atr = sum / period as f64;
        result[period - 1] = prev_atr;

        for i in period..candles.len() {
            let atr = (prev_atr * (period as f64 - 1.0) + tr_list[i]) / period as f64;
            result[i] = atr;
            prev_atr = atr;
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sma_calculation() {
        let prices = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let sma = Indicators::calculate_sma(&prices, 3);
        assert_eq!(sma[2], 20.0);
        assert_eq!(sma[3], 30.0);
        assert_eq!(sma[4], 40.0);
    }

    #[test]
    fn test_rsi_bounds() {
        let prices = vec![
            100.0, 102.0, 104.0, 106.0, 108.0, 110.0, 112.0, 114.0, 116.0, 118.0, 120.0, 122.0, 124.0, 126.0, 128.0,
        ];
        let rsi = Indicators::calculate_rsi(&prices, 14);
        let last_rsi = rsi.last().cloned().unwrap_or(0.0);
        assert!(last_rsi >= 90.0, "Continuous gains should result in RSI near 100, got {}", last_rsi);
    }
}
