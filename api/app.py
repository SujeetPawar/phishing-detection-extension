import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
import ssl
import socket
from urllib.parse import urlparse
import os
import sys


# Use our custom model loader
from model_loader import GLOBAL_MODEL as model

app = Flask(__name__)
CORS(app)

# Set socket timeout for SSL checks
socket.setdefaulttimeout(1.0)

# Check model status
if model is None:
    print("⚠️ Model failed to load from model_loader.py")
else:
    print("✅ Model loaded successfully from model_loader.py")

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
        print(f"Received prediction request with data: {data}")
        
        # Handle both 'url' and 'urls' parameters
        urls = data.get("urls", [])
        if not urls:
            single_url = data.get("url")
            if single_url:
                urls = [single_url]
            else:
                print("No URLs provided in request")
                return jsonify({"error": "No URLs provided"}), 400

        if isinstance(urls, str):
            urls = [urls]

        print(f"Processing {len(urls)} URLs")
        results = []
        
        for url in urls:
            try:
                print(f"Processing URL: {url}")
                parsed = urlparse(url)
                
                if not all([parsed.scheme, parsed.netloc]):
                    print(f"Invalid URL: {url}")
                    results.append({
                        "url": url,
                        "prediction": "Invalid URL",
                        "validSSL": False
                    })
                    continue

                # Predict
                print(f"Making prediction for: {url}")
                prediction = model.predict([url])[0]
                prediction_label = "Phishing" if prediction == 1 else "Legitimate"
                print(f"Prediction result: {prediction_label}")

                # Check SSL
                print(f"Checking SSL for: {url}")
                valid_ssl = check_ssl(url)
                print(f"SSL result: {valid_ssl}")

                results.append({
                    "url": url,
                    "prediction": prediction_label,
                    "validSSL": valid_ssl
                })

            except Exception as e:
                print(f"Error processing URL {url}: {str(e)}")
                results.append({
                    "url": url,
                    "prediction": "Error",
                    "validSSL": False,
                    "error": str(e)
                })

        print(f"Returning results for {len(results)} URLs")
        return jsonify({
            "results": results,
            "count": len(results),
            "success": True
        }), 200
        
        

    except Exception as e:
        print(f"Batch prediction error: {str(e)}")
        return jsonify({
            "error": str(e),
            "validSSL": False,
            "success": False
        }), 500

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

@app.route("/", methods=["HEAD"])
def connection_check():
    # Just return an empty 200 response for connection checks
    return "", 200

if __name__ == "__main__":
    # Use the PORT environment variable provided by Cloud Run if available
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host="0.0.0.0", port=port)
