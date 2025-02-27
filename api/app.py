import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from feature_extraction import extract_features  

app = Flask(__name__)

# Load the trained model and scaler
with open("api/model.pkl", "rb") as f:
    model_data = joblib.load(f)

scaler = model_data["scaler"]
rf_model = model_data["rf"]
expected_features = model_data["features"]  # Feature names from training

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        url = data.get("url")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Extract features (returns a dictionary)
        features = extract_features(url)

        if features is None:
            return jsonify({"error": "Invalid URL"}), 400

        # Convert dictionary to DataFrame
        features_df = pd.DataFrame([features])

        # 🔥 **Handle missing features by adding them with default values (0)**
        for feature in expected_features:
            if feature not in features_df.columns:
                features_df[feature] = 0  # Fill missing features with 0

        # 🔥 **Remove unexpected extra features without throwing an error**
        features_df = features_df[expected_features]  # Keep only expected features

        # Normalize features
        features_scaled = scaler.transform(features_df)

        # Predict
        prediction = rf_model.predict(features_scaled)[0]
        prediction_label = "Phishing" if prediction == 1 else "Legitimate"

        return jsonify({"prediction": prediction_label})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
