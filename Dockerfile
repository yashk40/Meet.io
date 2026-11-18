FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose default port
EXPOSE 3000

# Start Uvicorn respecting dynamic PORT environment variable
CMD ["sh", "-c", "uvicorn main:socket_app --host 0.0.0.0 --port ${PORT:-3000}"]
