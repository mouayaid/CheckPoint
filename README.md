# CheckPoint – Smart Workplace Management System

## Overview

CheckPoint is a workplace management platform developed as a graduation project (PFE). It consists of an **ASP.NET Core (.NET 8)** backend and a **React Native (Expo)** mobile application.

The platform includes:

* User authentication and account approval
* General requests management
* Desk reservation with QR check-in/check-out
* Meeting room reservation
* AI meeting transcription and summaries
* Notifications
* Events and announcements
* Profile management

---

# Project Structure

```text
Checkpoint/
│
├── backend/
│   ├── PFE.API/
│   ├── PFE.Application/
│   ├── PFE.Domain/
│   ├── PFE.Infrastructure/
│   └── ...
│
└── frontend/
```

---

# Prerequisites

Before running the project, install the following:

### Backend

* .NET 8 SDK
* SQL Server (Express or Developer)
* SQL Server Management Studio (optional)

### Frontend

* Node.js (LTS recommended)
* npm
* Expo CLI (optional)
* Android Studio (for emulator) or Expo Go on a physical device

### Optional Services

* Python 3.10+
* FFmpeg
* Ollama (for AI meeting summaries)

---

# Backend Setup

## 1. Clone the repository

```bash
git clone <repository-url>
cd Checkpoint
```

---

## 2. Restore dependencies

```bash
cd backend
dotnet restore
```

---

## 3. Configure the database

Open:

```
backend/PFE.API/appsettings.Development.json
```

Update the connection string:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=YOUR_SERVER;Database=CheckPoint_DB;Trusted_Connection=True;TrustServerCertificate=True;"
}
```

Example:

```text
Server=localhost;
```

or

```text
Server=.\SQLEXPRESS;
```

---

## 4. Apply database migrations

```bash
dotnet ef database update
```

If Entity Framework tools are not installed:

```bash
dotnet tool install --global dotnet-ef
```

---

## 5. Configure Cloudinary

If profile image upload is enabled, update:

```json
"Cloudinary": {
  "CloudName": "...",
  "ApiKey": "...",
  "ApiSecret": "..."
}
```

---

## 6. Run the backend

```bash
cd backend/PFE.API
dotnet run
```

The API will typically be available at:

```
http://localhost:5148
```

or

```
https://localhost:7148
```

---

# Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

Open the application using:

* Android Emulator
* Expo Go
* Development Build

---

# Backend URL Configuration

If using a physical Android device, replace `localhost` with your computer's local IP address.

Example:

```
http://192.168.x.x:5148
```

Make sure the computer and phone are connected to the same network.

For the Android emulator, use:

```
http://10.0.2.2:5148
```

---

# Optional: AI Meeting Transcription

To enable AI meeting transcription and meeting summaries:

## Install Python packages

```bash
pip install faster-whisper
```

Install FFmpeg and ensure it is available in your system PATH.

Verify installation:

```bash
ffmpeg -version
```

---

## Install Ollama

Download and install Ollama.

Pull the required model:

```bash
ollama pull llama3.2:3b
```

Start Ollama:

```bash
ollama serve
```

Ensure the backend configuration contains:

```json
"Ollama": {
  "BaseUrl": "http://localhost:11434"
}
```

---

# Building the Mobile Application

Development build:

```bash
eas build --profile development --platform android
```

Production build:

```bash
eas build --profile production --platform android
```

---

# Common Issues

### Cannot connect to SQL Server

* Verify SQL Server is running.
* Check the connection string.
* Ensure SQL Server authentication is correctly configured.

### Entity Framework migration errors

```bash
dotnet restore
dotnet ef database update
```

### Backend cannot be reached from the phone

* Use your computer's local IP address instead of `localhost`.
* Ensure Windows Firewall allows incoming connections on the backend port.

### FFmpeg not found

Install FFmpeg and add it to your system PATH.

### Ollama connection refused

Start Ollama:

```bash
ollama serve
```

---

# Technologies Used

## Backend

* ASP.NET Core 8
* Entity Framework Core
* SQL Server
* JWT Authentication
* SignalR
* Cloudinary

## Frontend

* React Native
* Expo
* Axios
* React Navigation

## AI

* Faster-Whisper
* Ollama
* Llama 3.2

---

# License

This project was developed as part of a final-year engineering project (PFE) and is intended for academic and demonstration purposes.
