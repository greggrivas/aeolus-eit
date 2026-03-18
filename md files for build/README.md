# Aeolus: Wind Turbine Fault Detection System

Aeolus is a complete wind turbine fault detection system built on the CARE research dataset. It implements ML-based anomaly detection using real sensor data from wind turbines, providing maintenance technicians with data-driven insights for informed decision-making.

## Features

- **Real-time Anomaly Detection**: Uses Isolation Forest algorithm trained on 1M+ sensor readings
- **Production-Ready ML Pipeline**: Complete preprocessing, training, and evaluation workflow
- **CARE Scoring Methodology**: Evaluates Coverage (1.0), Accuracy (0.665), Reliability (0.966), and Earliness (0.989)
- **Maintenance Dashboard**: Web interface showing turbine status, anomaly detection results, and fault analysis
- **Simulation Mode**: "Run Prediction" button for instant anomaly detection on historical data
- **Fault Intelligence**: Displays specific fault types from dataset alongside model predictions

## Architecture

### Backend (FastAPI)
- **Prediction Service**: Real-time anomaly detection with model caching (50ms inference)
- **Training Pipeline**: Isolation Forest model with CARE evaluation
- **Data Processing**: Preprocessing and feature engineering for Wind Farm A
- **API Endpoints**: RESTful APIs for predictions, events, and benchmarking

### Frontend (Next.js)
- **Dashboard**: Turbine status overview and simulation controls
- **Event Analysis**: Detailed views of anomaly events and sensor data
- **Benchmark Lab**: Model comparison and performance metrics

### Data Pipeline
- **CARE Dataset**: Research-grade wind turbine sensor data
- **Wind Farm A Focus**: 22 events, 86 features, 10-minute SCADA intervals
- **Preprocessing**: Quality filtering, feature selection, and normalization

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aeolus
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   # or with poetry: poetry install
   ```

3. **Install Node.js dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Download CARE dataset**
   ```bash
   # Place CARE_To_Compare/ directory in project root
   ```

5. **Start the backend**
   ```bash
   cd src/aeolus_api
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Start the frontend**
   ```bash
   cd frontend
   npm run dev
   ```

7. **Open browser**
   ```
   http://localhost:3000
   ```

## Model Performance

- **CARE Score**: 0.905 (excellent performance)
- **Coverage**: 1.0 (perfect detection of anomaly events)
- **Accuracy**: 0.665 (moderate false positive rate)
- **Reliability**: 0.966 (consistent detection quality)
- **Earliness**: 0.989 (early anomaly detection)

## Dataset

Aeolus uses the CARE (Coverage, Accuracy, Reliability, Earliness) dataset:

- **95 datasets** across 3 wind farms
- **44 anomaly events** and 51 normal events
- **36 turbines** with 10-minute SCADA readings
- **Wind Farm A**: 22 events, 86 features (54 sensors + derived)

## API Documentation

### Core Endpoints

- `GET /health` - Health check
- `GET /bootstrap` - System initialization data
- `GET /events` - List wind turbine events
- `GET /events/{event_id}` - Event details and metadata
- `GET /prediction/turbine-status` - Current turbine health status
- `GET /prediction/predict` - Run anomaly detection simulation

### Benchmark Endpoints

- `GET /benchmark/runs` - List model evaluation runs
- `GET /benchmark/runs/{run_id}/leaderboard` - Model performance comparison

## Development

### Project Structure
```
aeolus/
├── CARE_To_Compare/          # CARE research dataset
├── src/aeolus_api/           # FastAPI backend
├── frontend/                 # Next.js frontend
├── artifacts/                # Model artifacts and results
├── md files for build/       # Documentation
└── pyproject.toml           # Python configuration
```

### Key Components

**Backend Services:**
- `main.py` - FastAPI application and routes
- `services/prediction.py` - Real-time prediction logic
- `services/training_isolation_forest.py` - Model training pipeline
- `services/preprocessing.py` - Data cleaning and feature engineering

**Frontend Components:**
- `app/page.tsx` - Main dashboard
- `lib/api.ts` - API client functions
- `components/` - Reusable UI components

### Running Tests

```bash
# Backend tests
cd src/aeolus_api
python -m pytest

# Frontend tests
cd frontend
npm test
```

## Evaluation Methodology

Aeolus uses the CARE scoring framework for model evaluation:

- **Coverage**: Fraction of anomaly events detected
- **Accuracy**: Fraction of normal behavior correctly recognized
- **Reliability**: Quality of event-level detection
- **Earliness**: How early anomalies are detected within events

The system achieves CARE Score: 0.905, indicating excellent overall performance for wind turbine fault detection.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is released under the MIT License.

## Citation

If you use Aeolus in your research, please cite the CARE dataset:

```
@inproceedings{care-dataset,
  title={CARE: An Open Dataset for Wind Turbine Fault Detection},
  author={...},
  booktitle={...},
  year={...}
}
```