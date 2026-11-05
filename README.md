# 🚌 AMTS Live Bus Portal & Municipal Fleet Telemetry System

A modern, full-stack transit management and real-time commuter tracking platform built for the **Ahmedabad Municipal Transport Service (AMTS)**. The system features a public passenger web portal with live GPS bus tracking, smart journey planning, bilingual support (English & Gujarati), and QR ticketing, alongside a mission-critical Municipal Admin Command Center.

---

## ✨ Key Features

### 🚍 Commuter Web Portal
- **Live Bus Tracking:** Real-time vehicle positions with live telemetry (speed, heading, battery/fuel status, arrival ETAs) rendered on interactive Leaflet maps.
- **Smart Route & Stop Search:** Instant search across 14 operational lines and 536 bus stops with bilingual Gujarati/English station names.
- **Fare & Journey Planner:** Automatic fare calculation based on stage distances and shortest path journey assistance.
- **Paperless QR Ticketing:** User registration, instant e-ticket generation, dynamic QR verification codes, and personal passbook history.
- **Bilingual Interface:** Instant one-click toggle between English and Gujarati (ગુજરાતી).

### 🏛️ Municipal Admin Command Center (`/#admin-dashboard`)
- **Real-Time Fleet Dispatch Matrix:** Live telemetry table with real-time bus speeds, GPS coordinates, fuel/battery metrics, and service status.
- **Network Management:** Add and manage routes, corridor patterns, fleet vehicles, and bus stands.
- **Service Advisories & Alerts:** Broadcast municipal transit alerts, road blockages, and diversion notices to commuters in real-time.
- **Analytics & Heatmaps:** Historical ridership, peak corridor demand, and fleet operational efficiency charts.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Leaflet & React-Leaflet |
| **Backend** | Python 3.11+, Django 5.1, Django REST Framework, WhiteNoise, Gunicorn |
| **Database** | PostgreSQL 16+ with PostGIS 3.6+ geospatial extension (Neon Cloud / Local) |
| **Deployment** | Vercel (Edge CDN Frontend), Render (WSGI Backend), Neon (Serverless DB) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.11+)
- PostgreSQL with PostGIS extension (or a free [Neon](https://neon.tech) database)

### 1. Clone Repository
```bash
git clone https://github.com/PATNI-CHIRAG/AMTS_BUS_PORTAL.git
cd AMTS_BUS_PORTAL
```

### 2. Backend Setup (Django)
```bash
# Navigate to backend and create virtual environment
cd backend
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations and seed data
python manage.py migrate
python manage.py import_amts_data
python manage.py seed_routes_34_and_50

# Start Django development server
python manage.py runserver
```
*Backend runs on `http://127.0.0.1:8000`.*

### 3. Frontend Setup (React + Vite)
```bash
# Open a new terminal in the project root
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🔐 Default Admin Credentials

To access the Municipal Command Center (`/#admin-dashboard`):
- **Username:** `admin`
- **Password:** `admin@123`

---

## 🌐 Production Deployment

- **Database:** Hosted on [Neon](https://neon.tech) PostgreSQL with PostGIS extension enabled.
- **Backend:** Deployed as a Web Service on [Render](https://render.com) (`gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`).
- **Frontend:** Deployed on [Vercel](https://vercel.com) with root directory set to `frontend`.

---

## 📄 License
Developed for academic, civic, and municipal demonstration purposes. All rights reserved.
