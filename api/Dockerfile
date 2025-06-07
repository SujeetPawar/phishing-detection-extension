FROM python:3.9-slim

WORKDIR /app

# Copy requirements file
COPY requirement.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirement.txt

# Create the app structure
RUN mkdir -p /app/ml_mode

# Copy the API files
COPY *.py *.pkl /app/

# Go up one directory and copy the ml_mode folder
WORKDIR /
COPY ml_mode/ /app/ml_mode/
WORKDIR /app

# Make port 8080 available (Cloud Run uses 8080 by default)
EXPOSE 8080

# Run the application using regular Python (more reliable with the model)
CMD ["python", "app.py"]
