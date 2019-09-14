FROM node:11

LABEL version="1.0.0"
LABEL name="telegram-bot"

COPY . /app
WORKDRI "/app"

# install all dependencies via npm
RUN npm i

# the presence of a correctly configured config.js file is assumed

CMD node index.js
