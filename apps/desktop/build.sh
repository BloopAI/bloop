#!/bin/sh -e

git lfs install
git lfs pull

if [ -z "$ORT_LIB_LOCATION" ]; then
    export ORT_LIB_LOCATION=$(realpath $(dirname $(realpath $0))/../../lib/$(rustc -vV |awk '/host:/ { print $2 }')/onnxruntime)
fi

echo $ORT_LIB_LOCATION
npm run tauri $@
