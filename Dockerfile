# pull official base image
FROM node:13.12.0-alpine

# set working directory
WORKDIR /server

# add `/server/node_modules/.bin` to $PATH
ENV PATH /server/node_modules/.bin:$PATH

# install app dependencies
COPY package*.json ./
RUN npm install

# add app
COPY . ./

EXPOSE 4000

# start app
CMD ["node", "index.js"]