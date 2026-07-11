const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://signalgenerator:D39a9Iu7WojmboSk@cluster0.wttchje.mongodb.net/signalgenerator?retryWrites=true&w=majority&appName=Cluster0';

const AppStateSchema = new mongoose.Schema({
    key: { type: String, default: 'global_state', unique: true },
    selectedMarginPercentage: { type: Number, default: 100 },
    watchlistedStocks: { type: [String], default: [] },
    subscribedTokens: { type: [Number], default: [] },
    intradayTriggers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    openOrdersDecisions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    intradayActionsLogs: { type: [String], default: [] },
    activeStrategy: { type: String, default: 'momentum_surfing_morning' },
    customStopLossPercent: { type: Number, default: 2 },
    customTargetPercent: { type: Number, default: 4 },
    customSystemPrompt: { type: String, default: '' },
    profitTargetExit: { type: Number, default: 0 },
    lossTargetExit: { type: Number, default: 0 },
    pnlExitMode: { type: String, default: 'current' },
    pnlExitAutoEnabled: { type: Boolean, default: true },
    reallocationAutoEnabled: { type: Boolean, default: false }
}, { minimize: false, timestamps: true });

const AppState = mongoose.model('AppState', AppStateSchema);

const HistoricalCandleSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    instrumentToken: { type: Number, required: true },
    interval: { type: String, required: true },
    timestamp: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 }
}, { collection: 'candles', timestamps: true });

HistoricalCandleSchema.index({ symbol: 1, interval: 1, timestamp: 1 }, { unique: true });
HistoricalCandleSchema.index({ timestamp: 1 });
HistoricalCandleSchema.index({ instrumentToken: 1 });

const HistoricalCandle = mongoose.model('HistoricalCandle', HistoricalCandleSchema);

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('[MongoDB] Connected successfully to Cluster0/signalgenerator database.');
        
        // Ensure default global state document exists
        let state = await AppState.findOne({ key: 'global_state' });
        if (!state) {
            state = new AppState({ key: 'global_state' });
            await state.save();
            console.log('[MongoDB] Created default global state document.');
        }
    } catch (err) {
        console.error('[MongoDB] Connection failed:', err.message);
    }
}

const KiteDocSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    content: { type: String, required: true }
}, { timestamps: true });

const KiteDoc = mongoose.model('KiteDoc', KiteDocSchema);

const InstrumentSchema = new mongoose.Schema({
    instrument_token: { type: Number, required: true, unique: true },
    exchange_token: { type: String },
    tradingsymbol: { type: String, required: true },
    name: { type: String },
    last_price: { type: Number },
    expiry: { type: String },
    strike: { type: Number },
    tick_size: { type: Number },
    lot_size: { type: Number },
    instrument_type: { type: String },
    segment: { type: String },
    exchange: { type: String }
}, { timestamps: true });

InstrumentSchema.index({ tradingsymbol: 1 });
InstrumentSchema.index({ exchange: 1, tradingsymbol: 1 });

const Instrument = mongoose.model('Instrument', InstrumentSchema);

module.exports = {
    connectDB,
    AppState,
    HistoricalCandle,
    KiteDoc,
    Instrument
};
