import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score


# 🚀 Load dataset
df = pd.read_csv('phishing.csv')

# 🛑 Drop unnecessary columns
df.drop(['FILENAME', 'Title', 'TLD'], axis=1, inplace=True)

# ✅ Encode categorical columns
for col in df.select_dtypes(include=['object']).columns:
    df[col] = LabelEncoder().fit_transform(df[col])

# 🎯 Split dataset into features and labels
X = df.drop('label', axis=1)  
y = df['label']

# Save feature names to enforce consistency
feature_names = list(X.columns)

# 🔄 Normalize numerical features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 📊 Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

# 🏆 Train Random Forest Classifier
rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
rf_model.fit(X_train, y_train)

# ✅ Save models and feature names
with open('../api/model.pkl', 'wb') as f:
    pickle.dump({'scaler': scaler, 'rf': rf_model, 'features': feature_names}, f)

print("\n✅ Model and Feature Names Saved Successfully!")

    
