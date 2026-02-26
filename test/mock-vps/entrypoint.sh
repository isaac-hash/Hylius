#!/bin/bash
# Start Docker daemon in background
dockerd &>/dev/null &

# Wait for Docker to be ready
for i in $(seq 1 30); do
    if docker info &>/dev/null; then
        break
    fi
    sleep 1
done

# Start SSH daemon in foreground
exec /usr/sbin/sshd -D
