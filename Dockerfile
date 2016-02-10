FROM google/debian:wheezy
MAINTAINER medric.chouan@gmail.com

# Fetch and install Node.js
RUN apt-get update -y && apt-get install --no-install-recommends -y -q curl python build-essential git ca-certificates
RUN mkdir /nodejs && curl http://nodejs.org/dist/v0.12.0/node-v0.12.0-linux-x64.tar.gz | tar xvzf - -C /nodejs --strip-components=1

# Fetch and install Meteor
RUN curl https://install.meteor.com/ | sh

# Add Node.js installation to PATH
ENV PATH $PATH:/nodejs/bin

# Build the app
# set the current working directory to /build
# so future commands in this Dockerfile are easier to write
ADD ./app /opt/polytalk/app
WORKDIR /opt/polytalk/app
CMD meteor build . --server="/" --directory

CMD mv ./build ../
CMD rm -rf .

