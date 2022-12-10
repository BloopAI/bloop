#!/bin/bash
cargo run -p bleep -- --disable-background &

i=0
while [ $i -le 1200 ]; do
    status_code=$(curl --write-out "%{http_code}\n" --silent --output /dev/null http://localhost:7878/health)
    if [[ "$status_code" -ne 200 ]]; then
        i=$(($i+30))
        sleep 30
        echo "Server not started"
    else
        echo "Server started, breaking..."
        break
    fi
done
