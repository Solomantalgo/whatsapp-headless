# Use official Node.js LTS image
FROM node:22-slim

# Install Chromium for Puppeteer
RUN apt-get update && \
    apt-get install -y chromium wget ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
