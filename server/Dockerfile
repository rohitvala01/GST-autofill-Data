# Use official Playwright image which includes Node.js and all browser dependencies
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev
RUN npx playwright install chromium

# Copy application files
COPY . ./

# Expose port
EXPOSE 5001

# Start server
CMD ["node", "index.js"]
