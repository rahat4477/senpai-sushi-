# QRSavour - QR Code Restaurant Ordering System

A full-stack solution for restaurant table ordering.

## 🚀 Features
- **Mobile-first Menu**: Elegant, app-like experience for customers.
- **QR Integration**: Automatic table detection via URL parameters.
- **Real-time Kitchen**: Live dashboard for staff to manage orders.
- **Thermal Printing**: Automatic receipt generation via ESC/POS protocol.

## 🛠 Tech Stack
- **Frontend**: React 19, Tailwind CSS, Motion (Animations), Lucide Icons.
- **Backend**: Node.js, Express, tsx.
- **Database**: Firebase Firestore (Real-time).
- **Printer**: Node.js `escpos` library.

## 📦 Setup Instructions

### 1. Environment Variables
Configure the following in your `.env`:
- `GEMINI_API_KEY`: For AI features (if added).
- `PRINTER_IP`: IP address of your thermal printer (e.g., `192.168.1.100`).
- `PRINTER_PORT`: Default is `9100`.

### 2. Printer Connectivity
- Ensure your printer is on the same network as the server.
- The system supports standard ESC/POS ethernet/LAN printers (EPSON TM-T20, etc).

### 3. Usage
- **Customer View**: `https://<APP_URL>/menu?table=1`
- **Kitchen View**: `https://<APP_URL>/kitchen`

## 📄 License
SPDX-License-Identifier: Apache-2.0
