#!/bin/bash

CONTAINER_NAME="orbis_server_storage"
ACCESS_KEY="orbis"
SECRET_KEY="YourStrongPass123"
PORT=9100
CONSOLE_PORT=9101
IMAGE="rustfs/rustfs:1.0.1"

wait_for_storage() {
  echo "⏳ Waiting for storage to be ready..."

  for i in {1..30}; do
    if curl -fs "http://localhost:$PORT/health" >/dev/null 2>&1; then
      echo "✅ Storage is ready!"
      return
    fi
    sleep 2
  done

  echo "❌ Storage did not start in time."
}

case "$1" in
setup)
  echo "🚀 Creating storage container..."
  docker run -d \
    --name $CONTAINER_NAME \
    -e RUSTFS_ACCESS_KEY=$ACCESS_KEY \
    -e RUSTFS_SECRET_KEY=$SECRET_KEY \
    -e RUSTFS_CONSOLE_ENABLE=true \
    -v $CONTAINER_NAME:/data \
    -p $PORT:9000 \
    -p $CONSOLE_PORT:9001 \
    $IMAGE
  wait_for_storage
  pnpm run storage:bucket
  echo "✅ Container created. You can now run: ./scripts/development/storage.sh start"
  ;;

start)
  echo "▶️ Starting storage..."
  docker start $CONTAINER_NAME
  wait_for_storage
  ;;

stop)
  echo "⏹ Stopping storage..."
  docker stop $CONTAINER_NAME
  ;;

restart)
  echo "🔄 Restarting storage..."
  docker restart $CONTAINER_NAME
  wait_for_storage
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
  docker volume rm $CONTAINER_NAME
  ;;

*)
  echo "Usage: ./scripts/development/storage.sh {setup|start|stop|restart|status|logs|remove}"
  ;;
esac
