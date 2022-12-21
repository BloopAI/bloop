#!/bin/sh -e


QDRANT_VERSION=v0.11.5
BINDIR=src-tauri
QDRANT_RELEASE=$BINDIR/bin/qdrant

TARGET_TRIPLET="$(rustc -Vv |grep host |cut -d\  -f2)"
QDRANT_BIN=$BINDIR/bin/qdrant-$TARGET_TRIPLET

COMMAND=$1 
case "$COMMAND" in
	build|dev) ;;
	*) 
		echo "build.sh <build|dev>"
	       	exit 1
esac


cargo install --git https://github.com/qdrant/qdrant --tag $QDRANT_VERSION --bin qdrant --locked --root $BINDIR || true
mv $QDRANT_RELEASE $QDRANT_BIN
ln -sf $QDRANT_BIN $QDRANT_RELEASE

pnpm build $COMMAND
