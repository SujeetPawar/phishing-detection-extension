FROM python:3.9-slim

WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the model and application code
COPY . .
COPY ../ml_mode/ /app/ml_mode/

# Make port 8080 available (Cloud Run uses 8080 by default)
EXPOSE 8080

# Run the application
CMD ["python", "app.py"]

