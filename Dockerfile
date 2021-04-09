FROM node:lts-buster

LABEL maintainer "Daniel Park <dpark@broadinstitute.org>"

RUN npm install libxmljs

# Bring in other supporting files
COPY . /opt/converter

WORKDIR /opt/converter

RUN mkdir -p logs staging

RUN npm install

CMD ["/bin/bash"]
