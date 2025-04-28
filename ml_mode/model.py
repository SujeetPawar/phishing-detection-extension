import pandas as pd
import numpy as np
import pickle
import re
from urllib.parse import urlparse
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense
from tensorflow.keras.utils import to_categorical
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.base import BaseEstimator, TransformerMixin

class URLFeatureExtractor(BaseEstimator, TransformerMixin):
    """Automatically extracts all features from raw URLs"""
    def __init__(self):
        self.feature_names = [
            'URLLength', 'DomainLength', 'IsDomainIP', 'URLSimilarityIndex',
            'CharContinuationRate', 'NoOfSubDomain', 'HasObfuscation',
            'NoOfObfuscatedChar', 'ObfuscationRatio', 'NoOfLettersInURL',
            'LetterRatioInURL', 'NoOfDegitsInURL', 'DegitRatioInURL',
            'NoOfEqualsInURL', 'NoOfQMarkInURL', 'NoOfAmpersandInURL',
            'NoOfOtherSpecialCharsInURL', 'SpacialCharRatioInURL', 'IsHTTPS'
        ]
    
    def fit(self, X, y=None):
        return self
    
    def transform(self, urls):
        features = []
        for url in urls:
            # Parse URL components
            parsed = urlparse(url)
            domain = parsed.netloc
            path = parsed.path
            
            # Calculate features
            url_len = len(url)
            domain_len = len(domain)
            is_ip = 1 if re.match(r'^\d+\.\d+\.\d+\.\d+$', domain) else 0
            subdomains = domain.count('.') - 1 if '.' in domain else 0
            
            # Character analysis
            letters = sum(c.isalpha() for c in url)
            digits = sum(c.isdigit() for c in url)
            special_chars = len([c for c in url if not c.isalnum()])
            
            # Obfuscation detection
            obfuscated = len(re.findall(r'%[0-9a-fA-F]{2}', url))
            has_obfuscation = 1 if obfuscated > 0 else 0
            
            # Special characters
            equals = url.count('=')
            qmarks = url.count('?')
            ampersands = url.count('&')
            
            # Ratios
            letter_ratio = letters / url_len if url_len > 0 else 0
            digit_ratio = digits / url_len if url_len > 0 else 0
            special_ratio = special_chars / url_len if url_len > 0 else 0
            obfuscation_ratio = obfuscated / url_len if url_len > 0 else 0
            
            # Continuation rate (simplified)
            cont_rate = sum(1 for i in range(len(url)-1) if url[i] == url[i+1]) / url_len if url_len > 0 else 0
            
            # HTTPS check
            is_https = 1 if parsed.scheme == 'https' else 0
            
            # Similarity index (simplified)
            similarity_index = sum(1 for c in url if c.lower() in 'phishing') / url_len if url_len > 0 else 0
            
            features.append([
                url_len, domain_len, is_ip, similarity_index, cont_rate,
                subdomains, has_obfuscation, obfuscated, obfuscation_ratio,
                letters, letter_ratio, digits, digit_ratio, equals, qmarks,
                ampersands, special_chars, special_ratio, is_https
            ])
        
        return pd.DataFrame(features, columns=self.feature_names)

def build_cnn(input_shape):
    """Creates a 1D CNN model for URL classification"""
    model = Sequential([
        Conv1D(64, 3, activation='relu', input_shape=input_shape),
        MaxPooling1D(2),
        Conv1D(128, 3, activation='relu'),
        MaxPooling1D(2),
        Flatten(),
        Dense(128, activation='relu'),
        Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

class HybridModel:
    """Combines RandomForest and CNN predictions"""
    def __init__(self):
        self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.cnn_model = None
        self.scaler = StandardScaler()
        self.feature_extractor = URLFeatureExtractor()
    
    def fit(self, X, y):
        # Extract features
        X_features = self.feature_extractor.transform(X)
        
        # Train RandomForest
        X_scaled = self.scaler.fit_transform(X_features)
        self.rf_model.fit(X_scaled, y)
        
        # Train CNN (using raw URL characters)
        max_len = 200
        X_seq = self._urls_to_sequences(X, max_len)
        y_categorical = y
        
        self.cnn_model = build_cnn((max_len, 1))
        self.cnn_model.fit(X_seq, y_categorical, epochs=5, batch_size=32, verbose=1)
    
    def predict(self, X):
        # RF prediction
        X_features = self.feature_extractor.transform(X)
        X_scaled = self.scaler.transform(X_features)
        rf_pred = self.rf_model.predict_proba(X_scaled)[:, 1]
        
        # CNN prediction
        X_seq = self._urls_to_sequences(X, 200)
        cnn_pred = self.cnn_model.predict(X_seq).flatten()
        
        # Combine predictions (simple average)
        combined = (rf_pred + cnn_pred) / 2
        return (combined > 0.5).astype(int)
    
    def _urls_to_sequences(self, urls, max_len):
        """Convert URLs to numerical sequences for CNN"""
        sequences = []
        for url in urls:
            # Simple character-level encoding
            seq = [ord(c) for c in url[:max_len]]
            # Pad if necessary
            if len(seq) < max_len:
                seq += [0] * (max_len - len(seq))
            sequences.append(seq)
        return np.expand_dims(np.array(sequences), -1)

# 🚀 Main execution
if __name__ == "__main__":
    # Load dataset
    df = pd.read_csv('phishing.csv')
    
    # We'll use URL column as input and label as target
    X = df['URL'].values
    y = df['label'].values
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train hybrid model
    model = HybridModel()
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    
    print("\n🔍 Evaluation Metrics:")
    print(classification_report(y_test, y_pred))
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Save model
    with open('../api/model.pkl', 'wb') as f:
        pickle.dump(model, f)
    
    print("\n✅ Hybrid Model Saved Successfully!")