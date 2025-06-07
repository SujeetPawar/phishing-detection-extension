import pickle
import os
import sys
import numpy as np
from urllib.parse import urlparse
import re

# Ensure the ml_mode directory is in the path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

# Import the classes from ml_mode directly
try:
    from ml_mode.model import HybridModel, URLFeatureExtractor
except ImportError:
    print("Could not import from ml_mode directly. Creating mock classes.")
    
    # Define minimal versions of the classes for unpickling
    class URLFeatureExtractor:
        def __init__(self):
            self.feature_names = [
                'URLLength', 'DomainLength', 'IsDomainIP', 'URLSimilarityIndex',
                'CharContinuationRate', 'NoOfSubDomain', 'HasObfuscation',
                'NoOfObfuscatedChar', 'ObfuscationRatio', 'NoOfLettersInURL',
                'LetterRatioInURL', 'NoOfDegitsInURL', 'DegitRatioInURL',
                'NoOfEqualsInURL', 'NoOfQMarkInURL', 'NoOfAmpersandInURL',
                'NoOfOtherSpecialCharsInURL', 'SpacialCharRatioInURL', 'IsHTTPS'
            ]
        
        def transform(self, urls):
            features = []
            for url in urls:
                parsed = urlparse(url)
                domain = parsed.netloc
                
                url_len = len(url)
                domain_len = len(domain)
                is_ip = 1 if re.match(r'^\d+\.\d+\.\d+\.\d+$', domain) else 0
                subdomains = domain.count('.') - 1 if '.' in domain else 0
                
                letters = sum(c.isalpha() for c in url)
                digits = sum(c.isdigit() for c in url)
                special_chars = len([c for c in url if not c.isalnum()])
                
                obfuscated = len(re.findall(r'%[0-9a-fA-F]{2}', url))
                has_obfuscation = 1 if obfuscated > 0 else 0
                
                equals = url.count('=')
                qmarks = url.count('?')
                ampersands = url.count('&')
                
                letter_ratio = letters / url_len if url_len > 0 else 0
                digit_ratio = digits / url_len if url_len > 0 else 0
                special_ratio = special_chars / url_len if url_len > 0 else 0
                obfuscation_ratio = obfuscated / url_len if url_len > 0 else 0
                
                cont_rate = sum(1 for i in range(len(url)-1) if url[i] == url[i+1]) / url_len if url_len > 0 else 0
                
                is_https = 1 if parsed.scheme == 'https' else 0
                
                similarity_index = sum(1 for c in url if c.lower() in 'phishing') / url_len if url_len > 0 else 0
                
                features.append([
                    url_len, domain_len, is_ip, similarity_index, cont_rate,
                    subdomains, has_obfuscation, obfuscated, obfuscation_ratio,
                    letters, letter_ratio, digits, digit_ratio, equals, qmarks,
                    ampersands, special_chars, special_ratio, is_https
                ])
            
            return np.array(features)
    
    class HybridModel:
        def __init__(self):
            pass
            
        def predict(self, urls):
            # Always predict as phishing for mock implementation
            return np.ones(len(urls), dtype=int)

# Register the classes in the global namespace
globals()['HybridModel'] = HybridModel
globals()['URLFeatureExtractor'] = URLFeatureExtractor

# Create a mock model for testing
class MockModel:
    def predict(self, urls):
        return [1 for _ in urls]  # Always predict as phishing for testing

# Global model variable
GLOBAL_MODEL = None

# Function to load the model
def load_model():
    global GLOBAL_MODEL
    try:
        model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
        print(f"Loading model from {model_path}")
        
        if not os.path.exists(model_path):
            print(f"Model file not found at {model_path}")
            GLOBAL_MODEL = MockModel()
            print("Using mock model for testing")
            return GLOBAL_MODEL
        
        # Register the classes in the main module
        import __main__
        __main__.HybridModel = HybridModel
        __main__.URLFeatureExtractor = URLFeatureExtractor
        
        with open(model_path, 'rb') as f:
            data = pickle.load(f)
            if data.get('model_type') == 'HybridModel':
                # Register required classes in globals
                for name, cls in data.get('classes', {}).items():
                    globals()[name] = cls
                    if hasattr(__main__, '__dict__'):
                        __main__.__dict__[name] = cls
                        
                print("Model loaded successfully")
                GLOBAL_MODEL = data['model']
                return GLOBAL_MODEL
            else:
                print("Invalid model type")
                GLOBAL_MODEL = MockModel()
                print("Using mock model for testing")
                return GLOBAL_MODEL
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        GLOBAL_MODEL = MockModel()
        print("Using mock model for testing due to error")
        return GLOBAL_MODEL

# Initialize the model
GLOBAL_MODEL = load_model()
