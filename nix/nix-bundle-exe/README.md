# nix-bundle-exe

Originally maintained in [https://github.com/3noch/nix-bundle-exe](https://github.com/3noch/nix-bundle-exe)
Distributed under MIT license.

# Original README. 

This is a simple [Nix](https://nixos.org/) derivation to bundle Mach-O (macOS) and ELF (Linux) executables into a relocatable directory structure. That is to say, given a Nix package containing executables, this derivation will produce a package with those same executables, but with all their shared libraries copied into a new directory structure and reconfigured to work without any dependency on Nix.

If you are able to build your executable with full static linking, that would be better than using this derivation. For cases where that is too difficult, you can use this.

This tool has a very similar goal to [nix-bundle](https://github.com/matthewbauer/nix-bundle) with some key differences:

  1. `nix-bundle` works on arbitrary derivations and can bundle any resource, not just shared libraries. This tool only works on executables and their shared libraries.
  2. `nix-bundle` does not work on macOS. This tool does.
  3. `nix-bundle` requires target systems to have certain Linux kernel features. This tool requires Linux target systems to be POSIX only. macOS targets have no requirements.
  4. `nix-bundle` has some large build-time dependencies which may make it hard to use in CI in some cases. This tool has no additional build-time dependencies.

## Examples

This will make a bundle of `opencv` where all of its binaries can be run on a system where Nix is not installed.
```shell
nix-build -E 'with import <nixpkgs> {}; callPackage ./. {} opencv'
```

This will bundle `gzip` only, and not any of its accompanying scripts:

```shell
nix-build -E 'with import <nixpkgs> {}; callPackage ./. {} "${gzip}/bin/gzip"'
```

(Avoiding the accompanying scripts makes the resulting closure extremely small and does not depend on the original `gzip` closure in any way.)
