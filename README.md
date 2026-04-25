# Aeolus — Wind Farm Monitoring Platform

Built as part of the **Experts in Teamwork** course at **NTNU**, in collaboration with a cross-disciplinary team. Aeolus is a full-stack web application for monitoring, analysing, and diagnosing faults in wind farm turbines using real operational data.

---

## What it does

- **Fleet overview** — live health status across all turbines, KPIs, and a performance table
- **Fault detection** — machine learning models flag anomalous events in turbine sensor data
- **Event explorer** — drill into individual fault events with timeseries plots, subsystem signals, power curves, and feature attribution
- **Predictive model** — a supervised Random Forest classifier trained on SCADA data to predict fault types
- **AI chat assistant** — an LLM-powered operator assistant that can query the data and answer questions about turbine health
- **Benchmark & analytics** — model performance metrics and energy output analytics

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| ML | scikit-learn (Isolation Forest, Random Forest, Power Curve) |
| AI Chat | OpenRouter API (LLM with tool-calling) |
| Data | CARE to Compare — real wind farm SCADA dataset |

## My role

I led the technical side of the project, designed the frontend and backend, trained the machine learning models, and integrated the AI assistant.

## Disclaimer
Built entirely with AI assistance (vibe coded) — due to the time constraints of the EiT course and my background being outside software development, this project was built without prior experience in TypeScript, Next.js, or backend development.


---

> Dataset: [CARE to Compare](https://www.nrel.gov/wind/care-to-compare.html) — a publicly available wind farm benchmark dataset.
