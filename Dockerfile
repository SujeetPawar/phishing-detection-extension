FROM python:3.11-slim

WORKDIR /app

# Copy the API code and ML model code
COPY api/ /app/api/
COPY ml_mode/ /app/ml_mode/

# Install dependencies
WORKDIR /app/api
RUN pip install --no-cache-dir -r requirements.txt

# Set Python path to include ml_mode
ENV PYTHONPATH="/app:/app/api:/app/ml_mode"

# Expose port
EXPOSE 8000

# Run the application
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "wsgi:app"]
