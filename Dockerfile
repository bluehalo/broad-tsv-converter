FROM node:lts-buster

LABEL maintainer "Daniel Park <dpark@broadinstitute.org>"

# Bring in other supporting files
COPY . /opt/converter

WORKDIR /opt/converter

RUN mkdir -p logs staging

RUN npm install

CMD ["/bin/bash"]
