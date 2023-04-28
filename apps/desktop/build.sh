#!/bin/sh -e

git lfs install
git lfs pull

PROJECT_ROOT=$(realpath $(dirname $(realpath $0))/../../)
LOCAL_CONFIG=$PROJECT_ROOT/local_config.json

if [ -z "$ORT_LIB_LOCATION" ]; then
    export ORT_LIB_LOCATION=$(realpath $PROJECT_ROOT/lib/$(rustc -vV |awk '/host:/ { print $2 }')/onnxruntime)
fi

echo $ORT_LIB_LOCATION

if [ $1 == "dev" ]; then
   npm run tauri dev -- -- -- --config-file=$LOCAL_CONFIG
else
   npm run tauri $@
fi

