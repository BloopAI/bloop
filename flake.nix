{
  description = "bloop";

  # nixConfig = {
  #   extra-substituters = "https://bloopai.cachix.org";
  #   extra-trusted-public-keys =
  #     "bloopai.cachix.org-1:uSHFor+Jd3znikUnLc58xnHBXTcuIBSjdJxV5rLIMJU=";
  # };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nixpkgs2305.url = "github:nixos/nixpkgs/nixos-23.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, nixpkgs2305, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgsStable = import nixpkgs2305 { inherit system; };
        pkgsStatic = pkgs.pkgsStatic;
        lib = pkgs.lib;

        llvm = pkgs.llvmPackages_14;
        clang = llvm.clang;
        libclang = llvm.libclang;
        stdenv = if pkgs.stdenv.isLinux then
          pkgs.stdenvAdapters.useMoldLinker llvm.stdenv
        else
          llvm.stdenv;

        mkShell = if stdenv.isLinux then
          pkgs.mkShell.override { inherit stdenv; }
        else
          pkgs.mkShell;

        rustPlatform = pkgs.makeRustPlatform {
          cargo = pkgs.cargo;
          rustc = pkgs.rustc;
        };

        runtimeDeps = with pkgs;
          ([ openssl.out rocksdb git zlib nsync onnxruntime14 ]
            ++ lib.optionals stdenv.isDarwin [
              darwin.apple_sdk.frameworks.Foundation
              darwin.apple_sdk.frameworks.CoreFoundation
              darwin.apple_sdk.frameworks.Security
            ]);

        buildDeps = with pkgs;
          ([
            stdenv.cc.cc.lib
            glib.dev
            pkg-config
            openssl.out
            openssl.dev
            llvm.bintools

            protobuf
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Foundation
            darwin.apple_sdk.frameworks.CoreFoundation
            darwin.apple_sdk.frameworks.Security
          ]);

        guiDeps = with pkgs;
          [ nodePackages.npm nodejs ] ++ (lib.optionals stdenv.isLinux [
            gdk-pixbuf
            gdk-pixbuf.dev
            zlib.dev
            dbus.dev
            libsoup.dev
            gtk3.dev
            webkitgtk
            dmidecode
            appimage-run
            appimagekit
            gdk-pixbuf
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Carbon
            darwin.apple_sdk.frameworks.WebKit
            darwin.apple_sdk.frameworks.AppKit
          ]);

        onnxruntime_lib = if stdenv.isDarwin then
          "libonnxruntime.dylib"
        else
          "libonnxruntime.so";

        envVars = {
          LIBCLANG_PATH = "${libclang.lib}/lib";
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
          OPENSSL_NO_VENDOR = "1";
          ORT_STRATEGY = "system";
          ORT_LIB_LOCATION = "${onnxruntime14}/lib";
          ORT_DYLIB_PATH = "${onnxruntime14}/lib/${onnxruntime_lib}";
        } // lib.optionalAttrs stdenv.isLinux {
          RUSTFLAGS = "-C link-arg=-fuse-ld=mold";
        };

        bleep =
          (rustPlatform.buildRustPackage.override { inherit stdenv; } rec {
            meta = with pkgs.lib; {
              description = "Search code. Fast.";
              homepage = "https://bloop.ai";
              license = licenses.asl20;
              platforms = platforms.all;
            };

            name = "bleep";
            pname = name;
            src = pkgs.lib.sources.cleanSource ./.;

            cargoLock = {
              lockFile = ./Cargo.lock;
              outputHashes = {
                "hyperpolyglot-0.1.7" =
                  "sha256-JY75NB6sPxN0p/hksnBbat4S2EYFi2nExYoVHpYoib8=";
                "tree-sitter-cpp-0.20.0" =
                  "sha256-h6mJdmQzJlxYIcY+d5IiaFghraUgBGZwqFPKwB3E4pQ=";
                "tree-sitter-go-0.19.1" =
                  "sha256-f885YTswEDH/QfRPUxcLp/1E2zXLKl25R9IyTGKb1eM=";
                "tree-sitter-java-0.20.0" =
                  "sha256-gQzoWGV9wYiLibMFkLoY2sdEJg+ae9NnHt/GFfFzP8U=";
                "ort-1.14.8" =
                  "sha256-6YAhbrgI95WwRV0ngS0yaYlxfDGUFXYU0/oGf6vs68M=";
                "comrak-0.18.0" =
                  "sha256-UWY00jF2aKAG3Oz0P1UWF/7TiTIrCUGHwfjW+O1ok7Q=";
                "tree-sitter-php-0.19.1" =
                  "sha256-oHUfcuqtFFl+70/uJjE74J1JVV93G9++UaEIntOH5tM=";
                "esaxx-rs-0.1.8" =
                  "sha256-rPNNSn829eOo/glgmHPqnoylZmDLlaI5vKMRtfTikGs=";
              };
            };

            buildNoDefaultFeatures = true;
            checkNoDefaultFeatures = true;
            cargoTestFlags = "-p ${name}";
            cargoBuildFlags = "-p ${name}";

            nativeCheckInputs = buildDeps;
            nativeBuildInputs = buildDeps;
            checkInputs = runtimeDeps;
            buildInputs = runtimeDeps;
          }).overrideAttrs (old: envVars);

        onnxruntime14 = import ./nix/onnxruntime.nix {
          inherit (llvm) stdenv;
          pkgs = pkgsStable;
        };

        frontend = (pkgs.buildNpmPackage rec {
          meta = with pkgs.lib; {
            description = "Search code. Fast.";
            homepage = "https://bloop.ai";
            license = licenses.asl20;
            platforms = platforms.all;
          };

          name = "bleep-frontend";
          pname = name;
          src = pkgs.lib.sources.cleanSource ./.;

          # The prepack script runs the build script, which we'd rather do in the build phase.
          npmPackFlags = [ "--ignore-scripts" ];
          npmDepsHash = "sha256-YvmdThbqlmQ9MXL+a7eyXJ33sQNStQah9MUW2zhc/Uc=";
          makeCacheWritable = true;
          npmBuildScript = "build-web";
          installPhase = ''
            mkdir -p $out
            cp -r client/dist $out/dist
          '';
        });

      in {
        packages = {
          default = bleep;

          frontend = frontend;
          bleep = bleep;
          docker = pkgs.dockerTools.buildImage {
            name = "bleep";
            config = { Cmd = [ "${bleep}/bin/bleep" ]; };
            extraCommands = ''
              ln -s ${bleep}/bin/bleep /bleep
            '';

          };

          onnxruntime14 = onnxruntime14;
        };

        devShells = {
          default = (mkShell {
            buildInputs = buildDeps ++ runtimeDeps ++ guiDeps ++ (with pkgs; [
              git-lfs
              rustfmt
              clippy
              rust-analyzer
              cargo
              rustc
              cargo-watch
            ]);

            src = pkgs.lib.sources.cleanSource ./.;

            BLOOP_LOG = "bleep=debug";
          }).overrideAttrs (old: envVars);
        };

        formatter = pkgs.nixfmt;
      });
}
