{
  description = "bloop";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-22.11";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pkgsStatic = pkgs.pkgsStatic;
          lib = pkgs.lib;
          clang = pkgs.llvmPackages_14.clang;
          libclang = pkgs.llvmPackages_14.libclang;
        in
        {
          devShell = pkgs.mkShell {
            shellHook = ''
              rustup default stable >&2
              pnpm install >&2
            '';
            buildInputs = with pkgs; ([
              git-lfs
              llvmPackages_14.stdenv
              libclang
              clang
              rustup
              nodePackages.pnpm
              pkg-config
              openssl
              glib.dev
              cmake
              python3
              protobuf
              automake
              autoconf
              rocksdb
            ] ++ lib.optionals pkgs.stdenv.isLinux [
              dbus.dev
              libsoup.dev
              gtk3.dev
              webkitgtk
              dmidecode
              appimage-run
              appimagekit
            ] ++ lib.optionals pkgs.stdenv.isDarwin [
              darwin.apple_sdk.frameworks.Carbon
              darwin.apple_sdk.frameworks.WebKit
              darwin.apple_sdk.frameworks.AppKit
            ]);

            ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
            ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
            LIBCLANG_PATH = "${libclang.lib}/lib";
          };

          packages.my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs ++ [ pkgsStatic.pkg-config ];
          });
        }
      );
}

