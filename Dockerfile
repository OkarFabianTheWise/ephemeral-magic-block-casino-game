FROM backpackapp/build:v0.30.1

RUN rustup install 1.86.0 && \
    rustup default 1.86.0 && \
    rustup component add rustfmt clippy
