# CargoX — Smart Goods Transport & Fleet Management Platform

CargoX connects and manages:
**Customer → Transport Company → Vehicle → Driver → Delivery → Payment**

The system supports two sides:
- **Customer side** — book and track goods transportation
- **Transport business side** — manage vehicles, drivers, trips, expenses, payments and profits

## User Types
- **Customer**: Book transport, track shipments, make payments, view history.
- **Transport Admin / Owner**: Manage fleet, drivers, bookings, active trips, expenses, payments, reports.
- **Driver**: View assigned trips, update status, upload delivery proof.

## Website Structure
- **Landing Page**: Hero section, How It Works, Contact
- **Customer**: Login/Register, Dashboard, Book, Track, Payments
- **Driver**: Login, Dashboard, Active Trip, History
- **Admin**: Dashboard, Fleet, Bookings, Trips, Expenses, Reports

## Core Features
- **Booking System**: Pickup/drop details, cargo specs, vehicle matching, estimated cost.
- **Booking Lifecycle**: REQUESTED → CONFIRMED → VEHICLE ASSIGNED → DRIVER ASSIGNED → DRIVER ARRIVED → PICKUP COMPLETED → IN TRANSIT → OUT FOR DELIVERY → DELIVERED → COMPLETED
- **Admin Dashboard**: Analytics, revenue, expenses, profit estimations.
- **Fleet & Driver Management**: Real-time status, document expiry tracking, maintenance scheduling.
- **Tracking**: Live fleet map with ETA and trip status.
- **Proof of Delivery (POD)**: Photo, signature, timestamp, GPS.
- **Financials**: Payment tracking, trip expenses (fuel, toll), driver allowance.

## Future AI Layer
- AI Vehicle Recommendation
- AI Price Prediction
- AI Route Intelligence
- AI Business Assistant (Chatbot)

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Python, FastAPI, Uvicorn
- **Database**: PostgreSQL
- **Mapping**: OpenStreetMap, Leaflet

## Development Phases
1. **Foundation**: Auth, Roles, DB, Dashboards
2. **Transport Management**: Vehicles, Drivers, Customers, Bookings, Trips
3. **Business Operations**: Payments, Expenses, Maintenance
4. **Tracking**: Live Map, ETA, POD
5. **AI**: Predictions, Recommendations, Chatbot
6. **Production**: Security, Testing, Deployment
