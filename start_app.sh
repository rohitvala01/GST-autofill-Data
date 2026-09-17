#!/bin/bash
echo "🚀 Starting Chrome with Remote Debugging & Dedicated Profile..."
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_user_data" "http://localhost:5174" &
