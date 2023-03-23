{ pkgs
, bin_dir ? "bin"
, exe_dir ? "exe"
, lib_dir ? if pkgs.stdenv.isDarwin then "Resources/Library.${builtins.currentSystem}.dylib" else "lib"
}:
path:
# May be:
#  1) a derivation,
#  2) a path to a directory containing bin/, or
#  3) a path to an executable.
let
  print-needed-elf = pkgs.writeScriptBin
    "print-needed-elf"
    '''${pkgs.python3}'/bin/python ${./print_needed_elf.py} "$@"'';

  cfg =
    if pkgs.stdenv.isDarwin then
      {
        deps = with pkgs; [ darwin.binutils darwin.sigtool ];
        script = "bash ${./bundle-macos.sh}";
      }
    else if pkgs.stdenv.isLinux then
      {
        deps = [ pkgs.glibc print-needed-elf ];
        script = "bash ${./bundle-linux.sh}";
      }
    else
      throw "Unsupported platform: only darwin and linux are supported";

  name = if pkgs.lib.isDerivation path then path.name else builtins.baseNameOf path;
  overrideEnv = name: value: if value == null then "" else "export ${name}='${value}'";
in
pkgs.runCommand "bundle-${name}"
  {
    nativeBuildInputs = cfg.deps ++ [ pkgs.nukeReferences ];
  }
  ''
    set -euo pipefail
    export bin_dir='${bin_dir}'
    export exe_dir='${exe_dir}'
    export lib_dir='${lib_dir}'
    ${if builtins.pathExists "${path}/bin" then ''
      find '${path}/bin' -type f -executable -print0 | xargs -0 --max-args 1 ${cfg.script} "$out"
    '' else ''
      ${cfg.script} "$out" ${pkgs.lib.escapeShellArg path}
    ''}
    find $out -empty -type d -delete
  ''
