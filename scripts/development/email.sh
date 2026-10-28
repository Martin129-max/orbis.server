#!/bin/bash

CONTAINER_NAME="orbis_server_email"
PORT=8025
IMAGE="axllent/mailpit:v1.31.6"

wait_for_email() {
  echo "⏳ Waiting for the email inbox to be ready..."

  for i in {1..30}; do
    if curl -fs "http://localhost:$PORT/readyz" >/dev/null 2>&1; then
      echo "✅ Email inbox is ready at http://localhost:$PORT"
      return
    fi
    sleep 1
  done

  echo "❌ Email inbox did not start in time."
}

create_container() {
  echo "🚀 Creating email inbox container..."
  docker run -d \
    --name $CONTAINER_NAME \
    -e MP_DATABASE=/data/mailpit.db \
    -v $CONTAINER_NAME:/data \
    -p $PORT:8025 \
    $IMAGE
}

ensure_container() {
  if ! docker container inspect $CONTAINER_NAME >/dev/null 2>&1; then
    create_container
  fi
}

case "$1" in
setup)
  create_container
  wait_for_email
  echo "✅ Container created. You can now run: ./scripts/development/email.sh start"
  ;;

start)
  echo "▶️ Starting email inbox..."
  ensure_container
  docker start $CONTAINER_NAME
  wait_for_email
  ;;

stop)
  echo "⏹ Stopping email inbox..."
  docker stop $CONTAINER_NAME
  ;;

restart)
  echo "🔄 Restarting email inbox..."
  ensure_container
  docker restart $CONTAINER_NAME
  wait_for_email
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
  echo "Usage: ./scripts/development/email.sh {setup|start|stop|restart|status|logs|remove}"
  ;;
esac
