#!/usr/bin/env bash

set -euo pipefail

out="$1"
binary="$2"

: "${bin_dir:-}"
: "${lib_dir:-}"
: "${exe_dir:-}"

# Converts paths like "folder/bin" to "../.."
relative_bin_to_lib=$(echo -n "$bin_dir" | sed 's|[^/]*|..|g')

clean_path() {
  echo -n "$1" | sed 's#//*#/#g'
}

printNeeded() {
  print-needed-elf "$1" | grep '/nix/store/'
}

finalizeBin() {
  nuke-refs "$1"
}

bundleLib() {
  local file="$1"
  local install_dir="$out/$lib_dir"

  local real_file
  real_file=$(realpath "$file")

  local file_name
  file_name=$(basename "$file")
  local real_file_name
  real_file_name=$(basename "$real_file")

  local copied_file
  copied_file="$install_dir/$real_file_name"

  local already_bundled="1"
  if [ ! -f "$copied_file" ]; then
    already_bundled="0"
    cp "$real_file" "$copied_file"
    chmod +w "$copied_file"
  fi

  if [ "$file_name" != "$real_file_name" ] && [ ! -f "$install_dir/$file_name" ]; then
    (cd "$install_dir" && ln -sf "$real_file_name" "$file_name")
    chmod +w "$install_dir/$file_name"
  fi

  if [ "$already_bundled" = "1" ]; then
    return
  fi

  echo "Bundling $real_file to $install_dir"

  local linked_libs
  linked_libs=$(printNeeded "$real_file" || true)
  for linked_lib in $linked_libs; do
    bundleLib "$linked_lib" "lib"
  done

  if [ -n "$linked_libs" ]; then
    patchelf --set-rpath "\$ORIGIN" "$copied_file"
  fi

  finalizeBin "$copied_file"
}

bundleExe() {
  local exe="$1"
  local interpreter="$2"
  local exe_name
  exe_name=$(basename "$exe")

  local copied_exe="$out/$exe_dir/$exe_name"
  cp "$exe" "$copied_exe"
  chmod +w "$copied_exe"
  local rpath
  rpath=$(clean_path "\$ORIGIN/$relative_bin_to_lib/$lib_dir")
  patchelf --set-interpreter "$(basename "$interpreter")" --set-rpath "$rpath" "$copied_exe"
  finalizeBin "$copied_exe"

  bundleLib "$interpreter" "lib"

  local linked_libs
  linked_libs=$(printNeeded "$exe" || true)
  for linked_lib in $linked_libs; do
    bundleLib "$linked_lib" "lib"
  done

  # shellcheck disable=SC2016
  printf '#!/bin/sh
set -eu
dir="$(cd -- "$(dirname "$(dirname "$(realpath "$0")")")" >/dev/null 2>&1 ; pwd -P)"
exec "$dir"/%s "$dir"/%s "$@"' \
  "'$lib_dir/$(basename "$interpreter")'" \
  "'$exe_dir/$exe_name'" \
  > "$out/$bin_dir/$exe_name"
  chmod +x "$out/$bin_dir/$exe_name"
}

exe_interpreter=$(patchelf --print-interpreter "$binary" 2>/dev/null || true)
if [ -n "$exe_interpreter" ]; then
  mkdir -p "$out/$exe_dir" "$out/$bin_dir" "$out/$lib_dir"
  bundleExe "$binary" "$exe_interpreter"
else
  mkdir -p "$out/$bin_dir"
  cp "$binary" "$out/$bin_dir"
fi
