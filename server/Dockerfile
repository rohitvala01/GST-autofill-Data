# Use official Playwright image
FROM mcr.microsoft.com/playwright:v1.50.0-jammy

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
RUN npx playwright install --with-deps chromium

# Copy application files
COPY . ./

# Expose port
EXPOSE 5001

# Start server
CMD ["node", "index.js"]
