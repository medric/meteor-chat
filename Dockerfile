FROM google/debian:wheezy
MAINTAINER medric.chouan@gmail.com

# Fetch and install Node.js
RUN apt-get update -y && apt-get install --no-install-recommends -y -q curl python build-essential git ca-certificates
RUN mkdir /nodejs && curl http://nodejs.org/dist/v0.12.0/node-v0.12.0-linux-x64.tar.gz | tar xvzf - -C /nodejs --strip-components=1

# Fetch and install Meteor
RUN curl https://install.meteor.com/ | sh

# Add Node.js installation to PATH
ENV PATH $PATH:/nodejs/bin

#RUN npm install

ENV PORT 80
ENV ROOT_URL http://127.0.0.1
ENV MONGO_URL mongodb://mongo_instance:27017/polytalk

# Expose port 80
EXPOSE 80

# Build the app
# set the current working directory to /build
# so future commands in this Dockerfile are easier to write
ADD ./app .
CMD cd ./app && meteor build . --server="/" --directory

CMD mv ./build ../
CMD rm -rf ./app

WORKDIR ./build
CMD node main.js

