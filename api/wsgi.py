import sys
import os

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Make sure the ml_mode module is in the path
ml_mode_path = os.path.join(project_root, 'ml_mode')
sys.path.append(ml_mode_path)

# Import ml_mode classes and add to global namespace
try:
    from ml_mode.model import HybridModel, URLFeatureExtractor
    __main__ = sys.modules['__main__']
    __main__.HybridModel = HybridModel
    __main__.URLFeatureExtractor = URLFeatureExtractor
    globals()['HybridModel'] = HybridModel
    globals()['URLFeatureExtractor'] = URLFeatureExtractor
except (ImportError, KeyError) as e:
    print(f"Note: Could not import classes from ml_mode: {e}")

# Import the model loader first to ensure model is loaded
import model_loader

# Import the Flask app
from app import app

if __name__ == "__main__":
    # Use the PORT environment variable provided by Cloud Run if available
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host="0.0.0.0", port=port)
