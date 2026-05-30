#!/bin/bash

echo "🚀 Starter Landjord Overblik (Uofficielt) deployment..."

# Tjekker om docker compose (eller docker-compose) findes
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    echo "📦 Bygger og starter containere (Docker Compose V2)..."
    docker compose up -d --build
elif command -v docker-compose &> /dev/null; then
    echo "📦 Bygger og starter containere (Docker Compose V1)..."
    docker-compose up -d --build
else
    echo "❌ Fejl: Docker og/eller Docker Compose er ikke installeret."
    exit 1
fi

echo "✅ Deployment færdig!"
echo "➡️  Frontend kører på: https://localhost:5821 (Accepter selv-signeret certifikat i browseren)"
echo "➡️  Backend API proxy kører på: http://localhost:8000"
