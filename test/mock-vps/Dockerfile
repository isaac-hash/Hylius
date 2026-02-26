FROM ubuntu:22.04

# Install SSH server and required tools
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    curl \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir /var/run/sshd
RUN echo 'root:testpassword' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Install Docker (Docker-in-Docker)
RUN curl -fsSL https://get.docker.com | sh

# Disable BuildKit (not compatible with Docker-in-Docker cgroups)
RUN mkdir -p /etc/docker && echo '{"features":{"buildkit":false}}' > /etc/docker/daemon.json

EXPOSE 22

# Start both Docker daemon and SSH
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
