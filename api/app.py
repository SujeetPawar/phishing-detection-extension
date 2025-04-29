import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
import ssl
import socket
from urllib.parse import urlparse
import os
import sys


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml_mode.model import HybridModel, load_model, URLFeatureExtractor

app = Flask(__name__)
CORS(app)


# Set socket timeout for SSL checks
socket.setdefaulttimeout(1.0)

# Load the trained model
try:
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")
    
    # Make sure required classes are available
    _ = URLFeatureExtractor()  # Test if class can be instantiated
    _ = HybridModel()         # Test if class can be instantiated
    
    model = load_model(model_path)
    if model is None:
        raise ValueError("Failed to load model - invalid format")
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# Add a timeout to SSL checks
def check_ssl(url):
    """Verify if a domain has a valid SSL certificate with timeout"""
    try:
        parsed_url = urlparse(url)
        hostname = parsed_url.netloc

        if not hostname:
            return False

        if ":" in hostname:
            hostname = hostname.split(":")[0]

        context = ssl.create_default_context()
        context.timeout = 1.0  # 1 second timeout
        
        with socket.create_connection((hostname, 443), timeout=1.0) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                return True
    except Exception:
        return False

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        url = data.get("url")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Check if URL is valid
        parsed = urlparse(url)
        if not all([parsed.scheme, parsed.netloc]):
            return jsonify({"prediction": "Invalid URL", "validSSL": False}), 200

        # Predict using the HybridModel
        prediction = model.predict([url])[0]  # Model expects just URL as input

        prediction_label = "Phishing" if prediction == 1 else "Legitimate"

        # Check SSL certificate
        valid_ssl = check_ssl(url)

        return jsonify({
            "url": url,
            "prediction": prediction_label,
            "validSSL": valid_ssl
        })

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"error": str(e), "validSSL": False}), 500

@app.route("/analyze-batch", methods=["POST"])
def analyze_batch():
    try:
        data = request.get_json()
        urls = data.get("urls", [])

        if not urls:
            return jsonify({"error": "No URLs provided"}), 400

        results = []
        for url in urls:
            valid_ssl = check_ssl(url)
            results.append({
                "url": url,
                "validSSL": valid_ssl
            })

        return jsonify({"results": results})

    except Exception as e:
        print(f"Batch analysis error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)