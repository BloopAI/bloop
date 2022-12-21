{
  description = "bloop";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-22.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.flake-utils.inputs.nixpkgs.follows = "nixpkgs";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
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
            buildInputs = with pkgs; [
              llvmPackages_14.stdenv
              libclang
              clang
              rustup
              nodePackages.pnpm
              appimage-run
              appimage-run-tests
              appimagekit
              dbus.dev
              pkg-config
              openssl
              glib.dev
              gtk3.dev
              libsoup.dev
              webkitgtk
              dmidecode
              cmake
              openblas
              protobuf
            ];

            LIBCLANG_PATH = "${libclang.lib}/lib";
            BINDGEN_EXTRA_CLANG_ARGS = "-isystem ${libclang.lib}/lib/clang/${lib.getVersion clang}/include";
          };

          packages.my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs ++ [ pkgsStatic.pkg-config ];
          });
        }
      );
}

