import re
import socket
import ssl
import tldextract
import urllib.parse
from urllib.parse import urlparse
import ipaddress
import whois
from datetime import datetime
import requests
from bs4 import BeautifulSoup

# Suspicious words that often appear in phishing URLs
SUSPICIOUS_WORDS = [
    'login', 'verify', 'secure', 'account', 'banking', 'update', 'confirm',
    'paypal', 'password', 'credential', 'wallet', 'official', 'signin',
    'authorize', 'authenticate', 'reset', 'alert', 'suspend', 'unusual'
]

def extract_features(url):
    """
    Extract features from URL for phishing detection
    """
    try:
        parsed_url = urlparse(url)
        domain = parsed_url.netloc
        
        # If there's no domain, it's not a valid URL
        if not domain:
            return None
            
        # Extract domain-related components
        extracted = tldextract.extract(url)
        subdomain = extracted.subdomain
        root_domain = extracted.domain
        tld = extracted.suffix
        
        # Get URL components
        path = parsed_url.path
        query = parsed_url.query
        fragment = parsed_url.fragment
        
        # Calculate domain and URL length
        domain_length = len(domain)
        url_length = len(url)
        
        # Basic features
        features = {
            "url_length": url_length,
            "domain_length": domain_length,
            "has_https": 1 if parsed_url.scheme == "https" else 0,
            "num_dots": domain.count("."),
            "num_hyphens": domain.count("-"),
            "num_underscores": domain.count("_"),
            "num_slashes": path.count("/") + url.count("//") - 1 if url.startswith("http") else 0,
            "num_questionmarks": 1 if len(query) > 0 else 0,
            "num_equal": query.count("="),
            "num_at": url.count("@"),
            "num_ampersand": url.count("&"),
            "has_ip_address": is_ip_address(domain),
            "path_length": len(path),
            "query_length": len(query),
            "fragment_length": len(fragment),
            "num_parameters": query.count("&") + 1 if query else 0,
            "has_subdomain": 1 if subdomain else 0,
            "subdomain_length": len(subdomain) if subdomain else 0,
            "has_port": 1 if ":" in domain else 0,
            "tld_length": len(tld) if tld else 0,
            "domain_has_www": 1 if domain.startswith("www.") else 0,
        }
        
        # Add suspicious word features
        for word in SUSPICIOUS_WORDS:
            features[f"has_{word}"] = 1 if word in url.lower() else 0
        
        # Combined suspicious word feature
        features["suspicious_words_count"] = sum(1 for word in SUSPICIOUS_WORDS if word in url.lower())
        features["has_suspicious_words"] = 1 if features["suspicious_words_count"] > 0 else 0
        
        # Digit features
        features["num_digits"] = sum(c.isdigit() for c in url)
        features["domain_digit_ratio"] = features["num_digits"] / domain_length if domain_length > 0 else 0
        
        # Try to get additional domain-related features
        try:
            # Check if domain is newly registered
            try:
                domain_info = whois.whois(domain)
                creation_date = domain_info.creation_date
                
                if creation_date:
                    # Handle multiple creation dates
                    if isinstance(creation_date, list):
                        creation_date = creation_date[0]
                    
                    # Calculate domain age in days
                    domain_age = (datetime.now() - creation_date).days
                    features["domain_age_days"] = domain_age
                    features["is_new_domain"] = 1 if domain_age < 60 else 0
                else:
                    features["domain_age_days"] = -1
                    features["is_new_domain"] = 1
            except Exception:
                features["domain_age_days"] = -1
                features["is_new_domain"] = 1
        except Exception:
            features["domain_age_days"] = -1
            features["is_new_domain"] = 0
        
        return features
    except Exception as e:
        print(f"Error extracting features from {url}: {e}")
        return None

def is_ip_address(domain):
    """Check if domain is an IP address"""
    try:
        ipaddress.ip_address(domain)
        return 1
    except ValueError:
        return 0

def check_ssl_validity(url):
    """Check if SSL certificate is valid"""
    try:
        hostname = urlparse(url).netloc
        if not hostname:
            return False
            
        # Remove port information if present
        if ":" in hostname:
            hostname = hostname.split(":")[0]
            
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=3.0) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                # Certificate exists and is verified by a CA
                return True
    except Exception:
        return False