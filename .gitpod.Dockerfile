FROM axonasif/workspace-base

ARG NIX_VERSION="2.11.0"
ARG NIX_CONFIG="experimental-features = nix-command flakes"

ENV NIX_VERSION=${NIX_VERSION}

USER root

# Dazzle does not rebuild a layer until one of its lines are changed. Increase this counter to rebuild this layer.
ENV TRIGGER_REBUILD=1

RUN addgroup --system nixbld \
    && adduser gitpod nixbld \
    && for i in $(seq 1 30); do useradd -ms /bin/bash nixbld$i && adduser nixbld$i nixbld; done \
    && mkdir -m 0755 /nix && chown gitpod /nix \
    && mkdir -p /etc/nix && echo 'sandbox = false' > /etc/nix/nix.conf

# Install Nix
USER gitpod
ENV USER gitpod
WORKDIR /home/gitpod

RUN curl https://nixos.org/releases/nix/nix-$NIX_VERSION/install | sh

RUN echo '. /home/gitpod/.nix-profile/etc/profile.d/nix.sh' >> /home/gitpod/.bashrc.d/200-nix
RUN mkdir -p /home/gitpod/.config/nixpkgs && echo '{ allowUnfree = true; }' >> /home/gitpod/.config/nixpkgs/config.nix
RUN mkdir -p /home/gitpod/.config/nix && echo $NIX_CONFIG >> /home/gitpod/.config/nix/nix.conf

# Install cachix
RUN . /home/gitpod/.nix-profile/etc/profile.d/nix.sh \
    && nix-env -iA cachix -f https://cachix.org/api/v1/install \
    && cachix use cachix

# Install direnv & other files
RUN mkdir -p $HOME/.config/direnv && printf '%s\n' "[whitelist]" 'prefix = [ "/workspace" ]' >  $HOME/.config/direnv/config.toml \
    && printf '%s\n' 'source <(direnv hook bash)' > $HOME/.bashrc.d/999-direnv \
    && printf '%s\n' \
        'dirs=($HOME/.cargo $HOME/.cache/nix) && mkdir -p "${dirs[@]}"' \
        'create-overlay /nix "${dirs[@]}"' > $HOME/.runonce/100-nix \
    && . /home/gitpod/.nix-profile/etc/profile.d/nix.sh \
    && nix-env -iA nixpkgs.direnv

# Cache nix compilation for saving time
ARG onetime_cache_dir="/tmp/.workdir"
RUN mkdir -p "${onetime_cache_dir}"
COPY --chown=gitpod:gitpod . "${onetime_cache_dir}"

WORKDIR "${onetime_cache_dir}"
SHELL [ "/bin/bash", "-c" ]
RUN source "$HOME/.nix-profile/etc/profile.d/nix.sh" \
    && nix run nixpkgs#cachix use bloopai \
    && nix develop
