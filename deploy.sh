#!/bin/bash

echo "🚀 Starter Landjord Overblik (Uofficielt) deployment..."

# Tjekker om der skal deployes remote
if [ "${1:-}" == "remote" ]; then
    SERVER="root@192.168.50.5"
    REMOTE_DIR="/root/landjord"
    echo "🚀 Starter remote deployment til $SERVER..."
    
    ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $REMOTE_DIR"
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude 'venv' \
        --exclude '__pycache__' \
        --exclude '.pytest_cache' \
        --exclude '.git' \
        --exclude 'db.sqlite' \
        ./ $SERVER:$REMOTE_DIR/
        
    echo "📦 Bygger og starter containere på fjernserver..."
    # Sikker oprydning: Pruner KUN dangling images der tilhører landjord-projektet
    ssh -o StrictHostKeyChecking=no $SERVER "cd $REMOTE_DIR && docker compose up --build -d --remove-orphans && docker image prune -f --filter \"label=com.docker.compose.project=landjord\""
    
    echo "✅ Remote deployment færdig!"
    exit 0
fi

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
