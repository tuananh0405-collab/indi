# 🎫 INDI — Micro Event Ticketing System

A lightweight, monolithic backend API for managing micro-event ticketing (up to 400 attendees). Built with **Express + TypeScript + MongoDB**.

## Features

- **Order Management** — Create and track ticket orders with expiry-based reservation
- **PayOS Integration** — Seamless payment processing via PayOS webhooks
- **QR Code Tickets** — Auto-generated QR codes for event check-in
- **Email Notifications** — SMTP-based ticket delivery with Brevo/Resend/Gmail support
- **Admin Dashboard API** — Secure admin routes protected by API key auth
- **Check-in System** — Real-time ticket validation and check-in tracking
- **Concurrency Control** — Safe seat reservation with atomic counter operations

## Tech Stack

| Layer        | Technology             |
| ------------ | ---------------------- |
| Runtime      | Node.js + TypeScript   |
| Framework    | Express.js             |
| Database     | MongoDB + Mongoose     |
| Payments     | PayOS                  |
| Email        | Nodemailer (SMTP)      |
| QR Codes     | qrcode                 |

## Project Structure

```
src/
├── app.ts                  # Express app setup & middleware
├── server.ts               # Bootstrap & server start
├── config/
│   ├── index.ts            # Environment config loader
│   └── database.ts         # MongoDB connection
├── middlewares/
│   ├── adminAuth.ts        # Admin API key guard
│   └── errorHandler.ts     # Global error handler
├── models/
│   ├── Counter.ts          # Atomic seat counter
│   ├── Order.ts            # Order schema & model
│   └── Ticket.ts           # Ticket schema & model
└── utils/
    ├── AppError.ts         # Custom error class
    └── seed.ts             # Database seeder
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- PayOS account (for payment processing)

### Installation

```bash
# Clone the repository
git clone https://github.com/tuananh0405-collab/indi.git
cd indi

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your actual credentials

# Run in development mode
npm run dev
```

### Available Scripts

| Script         | Description                        |
| -------------- | ---------------------------------- |
| `npm run dev`  | Start dev server with hot-reload   |
| `npm run build`| Compile TypeScript to `dist/`      |
| `npm start`    | Run compiled production build      |
| `npm run seed` | Seed the database                  |

## API Endpoints

| Method | Endpoint     | Description           |
| ------ | ------------ | --------------------- |
| GET    | `/health`    | Health check          |

> More endpoints will be added as the system is built out (orders, webhooks, check-in, admin).

## Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

## License

ISC
