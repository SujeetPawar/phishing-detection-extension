import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
import ssl
import socket
from urllib.parse import urlparse
import os
import sys
import logging
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set socket timeout for SSL checks
socket.setdefaulttimeout(1.5)

# Load the trained model
try:
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")

    # Load the entire HybridModel
    with open(model_path, "rb") as f:
        model = joblib.load(f)
    
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    model = None

def check_ssl(url):
    """Verify if a domain has a valid SSL certificate with timeout"""
    try:
        parsed_url = urlparse(url)
        hostname = parsed_url.netloc
        
        # Skip invalid URLs or non-HTTPS
        if not hostname or parsed_url.scheme != 'https':
            return False
            
        if ":" in hostname:
            hostname = hostname.split(":")[0]
            
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=1.5) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                return True
    except Exception as e:
        logger.debug(f"SSL check failed for {url}: {e}")
        return False

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        url = data.get("url")
        
        logger.info(f"Received prediction request for URL: {url}")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Check if URL is valid
        parsed = urlparse(url)
        if not all([parsed.scheme, parsed.netloc]):
            return jsonify({"prediction": "Invalid URL", "validSSL": False}), 200

        # Predict using the HybridModel which handles feature extraction internally
        if model:
            prediction = model.predict([url])[0]
            prediction_label = "Phishing" if prediction == 1 else "Legitimate"
        else:
            prediction_label = "Unknown (Model not loaded)"

        # Check SSL certificate if URL uses HTTPS
        valid_ssl = check_ssl(url) if parsed.scheme == "https" else False
        logging.info(f"{url}: {prediction_label}")

        return jsonify({
            "url": url,
            "prediction": prediction_label,
            "validSSL": valid_ssl
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({"error": str(e), "validSSL": False}), 500

@app.route("/analyze-batch", methods=["POST"])
def analyze_batch():
    try:
        data = request.get_json()
        urls = data.get("urls", [])
        
        logger.info(f"Received batch analysis request for {len(urls)} URLs")

        if not urls:
            return jsonify({"error": "No URLs provided"}), 400

        results = []
        for url in urls:
            parsed = urlparse(url)
            valid_ssl = check_ssl(url) if parsed.scheme == "https" else False
            results.append({
                "url": url,
                "validSSL": valid_ssl
            })

        return jsonify({"results": results})

    except Exception as e:
        logger.error(f"Batch analysis error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)