FROM node:18-alpine AS base

# 1. Set the root working directory
RUN mkdir -p /gamers
WORKDIR /gamers

# 2. Copy NPM package files
COPY package*.json ./

# 3. Install the NPM packages
RUN npm ci --no-fund

# 4. Copy the source code last, as it changes the most
COPY . .

# 4. Start the application
FROM base as production
CMD ["/bin/ash", "-c", "npm start"]
