#!/bin/sh -e

if [ -z "$ORT_LIB_LOCATION" ]; then
    export ORT_LIB_LOCATION=$(readlink -f $(dirname $(readlink -f  $0))/../../lib/$(rustc -vV |awk '/host:/ { print $2 }')/onnxruntime)
fi

echo $ORT_LIB_LOCATION
tauri $1
