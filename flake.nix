{
  description = "bloop";

  nixConfig = {
    extra-substituters = "https://bloopai.cachix.org";
    extra-trusted-public-keys =
      "bloopai.cachix.org-1:uSHFor+Jd3znikUnLc58xnHBXTcuIBSjdJxV5rLIMJU=";
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-23.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgsStatic = pkgs.pkgsStatic;
        lib = pkgs.lib;

        llvm = pkgs.llvmPackages_14;
        clang = llvm.clang;
        libclang = llvm.libclang;
        stdenv = llvm.stdenv;

        rustPlatform = pkgs.makeRustPlatform {
          cargo = pkgs.cargo;
          rustc = pkgs.rustc;
        };

        runtimeDeps = with pkgs;
          ([ openssl.out rocksdb git zlib ] ++ lib.optionals stdenv.isDarwin [
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

            protobuf
            onnxruntime-static
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Foundation
            darwin.apple_sdk.frameworks.CoreFoundation
            darwin.apple_sdk.frameworks.Security
          ]);

        guiDeps = with pkgs;
          [ nodePackages.npm nodejs ] ++ (lib.optionals stdenv.isLinux [
            zlib.dev
            dbus.dev
            libsoup.dev
            gtk3.dev
            webkitgtk
            dmidecode
            appimage-run
            appimagekit
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Carbon
            darwin.apple_sdk.frameworks.WebKit
            darwin.apple_sdk.frameworks.AppKit
          ]);

        envVars = {
          LIBCLANG_PATH = "${libclang.lib}/lib";
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
          OPENSSL_NO_VENDOR = "1";
          ORT_LIB_LOCATION = "${onnxruntime-static}/build";
        };

        bleep = (rustPlatform.buildRustPackage rec {
          meta = with pkgs.lib; {
            description = "Search code. Fast.";
            homepage = "https://bloop.ai";
            license = licenses.asl20;
            platforms = platforms.all;
          };

          name = "bleep";
          pname = name;
          src = pkgs.lib.sources.cleanSource ./.;

          cargoTestFlags = "-p ${name}";
          cargoBuildFlags = "-p ${name}";
          cargoLock = {
            lockFile = ./Cargo.lock;
            outputHashes = {
              "hyperpolyglot-0.1.7" =
                "sha256-g+ZJxthxOYPMacYi3fK304KVldiykAvcpTZctWKVVU0=";
              "tree-sitter-cpp-0.20.0" =
                "sha256-h6mJdmQzJlxYIcY+d5IiaFghraUgBGZwqFPKwB3E4pQ=";
              "tree-sitter-go-0.19.1" =
                "sha256-f885YTswEDH/QfRPUxcLp/1E2zXLKl25R9IyTGKb1eM=";
              "tree-sitter-java-0.20.0" =
                "sha256-gQzoWGV9wYiLibMFkLoY2sdEJg+ae9NnHt/GFfFzP8U=";
              "ort-1.14.0-beta.0" =
                "sha256-GLwCOtYOvJWg/tBAuqVqwREaxlxAhL1FJltwF+fWROk=";
            };
          };

          nativeCheckInputs = buildDeps;
          nativeBuildInputs = buildDeps;
          checkInputs = runtimeDeps;
          buildInputs = runtimeDeps;
        }).overrideAttrs (old: envVars);

        onnxruntime-static =
          import ./nix/onnxruntime.nix { inherit pkgs stdenv; };

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

          onnxruntime-static = onnxruntime-static;
        };

        devShells = {
          default = (pkgs.mkShell {
            buildInputs = buildDeps ++ runtimeDeps ++ guiDeps ++ (with pkgs; [
              git-lfs
              cargo
              rustc
              rustfmt
              clippy
              rust-analyzer
              nixfmt
            ]);

            src = pkgs.lib.sources.cleanSource ./.;

            setupHook = ''
              git lfs install
            '';
          }).overrideAttrs (old: envVars);
        };

      });
}

