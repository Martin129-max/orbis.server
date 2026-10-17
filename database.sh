#!/bin/bash

CONTAINER_NAME="orbis_server_db"
PSQL_USER="postgres"
PSQL_PASSWORD="YourStrongPass123"
PORT=5434
IMAGE="postgres:16"

wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL to be ready..."

  for i in {1..30}; do
    if docker exec $CONTAINER_NAME pg_isready -U $PSQL_USER >/dev/null 2>&1; then
      echo "✅ PostgreSQL is ready!"
      return
    fi
    sleep 2
  done

  echo "❌ PostgreSQL did not start in time."
}

case "$1" in
setup)
  echo "🚀 Creating PostgreSQL container..."
  docker run -d \
    --name $CONTAINER_NAME \
    -e POSTGRES_USER=$PSQL_USER \
    -e POSTGRES_PASSWORD=$PSQL_PASSWORD \
    -e POSTGRES_DB=$CONTAINER_NAME \
    -p $PORT:5432 \
    $IMAGE
  echo "✅ Container created. You can now run: ./database.sh start"
  ;;

start)
  echo "▶️ Starting PostgreSQL..."
  docker start $CONTAINER_NAME
  wait_for_postgres
  ;;

stop)
  echo "⏹ Stopping PostgreSQL..."
  docker stop $CONTAINER_NAME
  ;;

restart)
  echo "🔄 Restarting PostgreSQL..."
  docker restart $CONTAINER_NAME
  wait_for_postgres
  ;;

status)
  docker ps -a | grep $CONTAINER_NAME
  ;;

logs)
  docker logs -f $CONTAINER_NAME
  ;;

remove)
  echo "🗑 Removing container..."
  docker rm -f $CONTAINER_NAME
  ;;

*)
  echo "Usage: ./database.sh {setup|start|stop|restart|status|logs|remove}"
  ;;
esac
