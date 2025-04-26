import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import urllib.parse
import requests
import re
import ssl
import socket
from urllib.parse import urlparse
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set socket timeout for SSL checks
socket.setdefaulttimeout(3.0)

# Load the trained model and scaler with improved error handling
try:
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")
        
    with open(model_path, "rb") as f:
        model_data = joblib.load(f)
        
    scaler = model_data.get("scaler")
    rf_model = model_data.get("rf")
    expected_features = model_data.get("features", [])
    
    if not all([scaler, rf_model, expected_features]):
        raise ValueError("Model data is incomplete")
        
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    # Create detailed fallback
    class FallbackModel:
        def predict(self, X):
            return [0] * len(X)
    
    rf_model = FallbackModel()
    expected_features = []
    scaler = None
    print("Using fallback model")

def check_ssl(url):
    """Verify if a domain has a valid SSL certificate"""
    try:
        parsed_url = urlparse(url)
        hostname = parsed_url.netloc
        
        if not hostname:
            return False
            
        if ":" in hostname:
            hostname = hostname.split(":")[0]
            
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443)) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                return True
    except Exception as e:
        print(f"SSL Check Error for {url}: {e}")
        return False

def extract_features(url):
    """Extract features from URL for phishing detection"""
    try:
        parsed_url = urlparse(url)
        domain = parsed_url.netloc
        
        if not domain:
            return None
            
        path = parsed_url.path
        query = parsed_url.query
        
        features = {
            "url_length": len(url),
            "domain_length": len(domain),
            "has_https": 1 if parsed_url.scheme == "https" else 0,
            "num_dots": domain.count("."),
            "num_hyphens": domain.count("-"),
            "num_underscores": domain.count("_"),
            "num_slashes": path.count("/"),
            "num_questionmarks": 1 if len(query) > 0 else 0,
            "num_equal": query.count("="),
            "num_at": url.count("@"),
            "num_ampersand": url.count("&"),
            "has_ip_address": 1 if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", domain) else 0,
            "has_suspicious_words": 1 if any(word in url.lower() for word in ["login", "verify", "secure", "account", "update", "confirm"]) else 0,
            "path_length": len(path),
            "query_length": len(query),
            "domain_has_www": 1 if domain.startswith("www.") else 0,
            "tld_length": len(domain.split(".")[-1]) if "." in domain else 0,
        }
        
        return features
    except Exception as e:
        print(f"Feature extraction error: {e}")
        return None

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        url = data.get("url")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Check if URL is valid
        try:
            parsed = urlparse(url)
            if not all([parsed.scheme, parsed.netloc]):
                return jsonify({"prediction": "Invalid URL", "validSSL": False}), 200
        except:
            return jsonify({"prediction": "Invalid URL", "validSSL": False}), 200

        # Check SSL certificate
        valid_ssl = check_ssl(url)
        
        # Extract features
        features = extract_features(url)
        
        if features is None:
            return jsonify({"prediction": "Unknown", "validSSL": valid_ssl}), 200

        # Handle model prediction
        if scaler and expected_features:
            features_df = pd.DataFrame([features])
            
            for feature in expected_features:
                if feature not in features_df.columns:
                    features_df[feature] = 0
            
            features_df = features_df[[f for f in expected_features if f in features_df.columns]]
            
            missing_features = set(expected_features) - set(features_df.columns)
            for feature in missing_features:
                features_df[feature] = 0
                
            features_df = features_df[expected_features]
            
            features_scaled = scaler.transform(features_df)
            
            prediction = rf_model.predict(features_scaled)[0]
            prediction_label = "Phishing" if prediction == 1 else "Legitimate"
        else:
            suspicious_count = sum(1 for k, v in features.items() if k.startswith("has_") and v == 1)
            prediction_label = "Phishing" if suspicious_count > 2 or not valid_ssl else "Legitimate"

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
            features = extract_features(url)
            
            if features is None:
                results.append({"url": url, "prediction": "Invalid URL", "validSSL": valid_ssl})
                continue
                
            if scaler and expected_features:
                features_df = pd.DataFrame([features])
                
                for feature in expected_features:
                    if feature not in features_df.columns:
                        features_df[feature] = 0
                
                features_df = features_df[[f for f in expected_features if f in features_df.columns]]
                
                missing_features = set(expected_features) - set(features_df.columns)
                for feature in missing_features:
                    features_df[feature] = 0
                    
                features_df = features_df[expected_features]
                
                features_scaled = scaler.transform(features_df)
                
                prediction = rf_model.predict(features_scaled)[0]
                prediction_label = "Phishing" if prediction == 1 else "Legitimate"
            else:
                suspicious_count = sum(1 for k, v in features.items() if k.startswith("has_") and v == 1)
                prediction_label = "Phishing" if suspicious_count > 2 or not valid_ssl else "Legitimate"
                
            results.append({
                "url": url, 
                "prediction": prediction_label, 
                "validSSL": valid_ssl
            })
            
        return jsonify({"results": results})
            
    except Exception as e:
        print(f"Batch analysis error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)