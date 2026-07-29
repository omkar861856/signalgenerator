mod backtest;
mod indicators;
mod scanner;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use backtest::{BacktestEngine, BacktestParams, BacktestResult};
use indicators::{Candle, Indicators};
use scanner::{ScanMatch, ScannerEngine, SymbolData};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub scanner_engine: Arc<ScannerEngine>,
}

#[derive(Debug, Deserialize)]
pub struct IndicatorRequest {
    pub candles: Vec<Candle>,
    pub period: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct IndicatorResponse {
    pub rsi: Vec<f64>,
    pub ema50: Vec<f64>,
    pub vwap: Vec<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub expression: String,
    pub dataset: Vec<SymbolData>,
}

#[derive(Debug, Serialize)]
pub struct ScanResponse {
    pub total_evaluated: usize,
    pub match_count: usize,
    pub matches: Vec<ScanMatch>,
}

#[derive(Debug, Deserialize)]
pub struct BacktestRequest {
    pub candles: Vec<Candle>,
    pub params: BacktestParams,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = AppState {
        scanner_engine: Arc::new(ScannerEngine::new()),
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/indicators/calculate", post(calculate_indicators_handler))
        .route("/api/scanners/eval", post(evaluate_scanner_handler))
        .route("/api/backtest/run", post(run_backtest_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Rust Quant Engine running on {}", addr);
    println!("🚀 Rust Quant Engine running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "engine": "Rust Quant Engine 0.1.0",
        "features": ["SIMD Indicators", "Rayon Parallel Scanning", "Event-Driven Backtester"]
    }))
}

async fn calculate_indicators_handler(
    Json(req): Json<IndicatorRequest>,
) -> Json<IndicatorResponse> {
    let closes: Vec<f64> = req.candles.iter().map(|c| c.close).collect();
    let period = req.period.unwrap_or(14);

    let rsi = Indicators::calculate_rsi(&closes, period);
    let ema50 = Indicators::calculate_ema(&closes, 50);
    let vwap = Indicators::calculate_vwap(&req.candles);

    Json(IndicatorResponse { rsi, ema50, vwap })
}

async fn evaluate_scanner_handler(
    State(state): State<AppState>,
    Json(req): Json<ScanRequest>,
) -> Json<ScanResponse> {
    let total_evaluated = req.dataset.len();
    match state.scanner_engine.compile_expression(&req.expression) {
        Ok(ast) => {
            let matches = state.scanner_engine.evaluate_parallel(&ast, &req.dataset);
            let match_count = matches.len();
            Json(ScanResponse {
                total_evaluated,
                match_count,
                matches,
            })
        }
        Err(_err) => Json(ScanResponse {
            total_evaluated,
            match_count: 0,
            matches: vec![],
        }),
    }
}

async fn run_backtest_handler(
    Json(req): Json<BacktestRequest>,
) -> Json<BacktestResult> {
    let result = BacktestEngine::run(&req.candles, &req.params);
    Json(result)
}
