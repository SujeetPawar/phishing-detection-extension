import re
import requests
import numpy as np
import pandas as pd
from urllib.parse import urlparse
import tldextract

def extract_features(url):
    """Extracts features from a URL to match the dataset used for training."""

    url_length = len(url)
    parsed_url = urlparse(url)
    domain_info = tldextract.extract(url)

    is_https = 1 if parsed_url.scheme == "https" else 0
    no_of_subdomains = parsed_url.netloc.count(".") - 1  
    no_of_digits = sum(c.isdigit() for c in url)

    # Count special characters in URL
    special_chars = ['@', '?', '=', '&', '-', '_', '%', '#', '/', '*', '~', '+', '!']
    no_of_special_chars = sum(url.count(c) for c in special_chars)
    
    obfuscation_ratio = no_of_special_chars / url_length if url_length > 0 else 0
    no_of_letters = sum(c.isalpha() for c in url)
    letter_ratio = no_of_letters / url_length if url_length > 0 else 0
    digit_ratio = no_of_digits / url_length if url_length > 0 else 0

    domain_length = len(domain_info.domain)
    tld_length = len(domain_info.suffix)

    has_ssl = 0  
    response_length = 0
    largest_line_length = 0
    has_favicon = 0
    no_of_images = 0
    no_of_js = 0
    no_of_css = 0
    has_copyright = 0
    has_title = 0
    has_description = 0
    has_password_field = 0
    no_of_forms = 0
    has_submit_button = 0
    no_of_iframes = 0
    no_of_redirects = 0
    has_external_form_submit = 0
    is_responsive = 0
    no_of_self_redirects = 0
    no_of_external_refs = 0
    no_of_self_refs = 0
    no_of_hidden_fields = 0
    robots_meta = 0
    url_title_match_score = 0
    domain_title_match_score = 0
    url_similarity_index = 0
    char_continuation_rate = 0
    no_of_equals_in_url = url.count('=')
    no_of_ampersand_in_url = url.count('&')
    no_of_qmark_in_url = url.count('?')
    no_of_other_special_chars = sum(url.count(c) for c in ['+', '!', '$', '|'])

    try:
        response = requests.get(url, timeout=3)
        has_ssl = 1 if "https" in response.url else 0  
        response_length = len(response.text)
        largest_line_length = max(len(line) for line in response.text.split("\n")) if response.text else 0

        # Check for favicon
        has_favicon = 1 if "favicon" in response.text.lower() else 0
        
        # Count occurrences of <script>, <link rel="stylesheet">, <img> tags
        no_of_js = response.text.lower().count("<script")
        no_of_css = response.text.lower().count("<link rel=\"stylesheet\"")
        no_of_images = response.text.lower().count("<img")

        # Check for password fields and forms
        has_password_field = 1 if "type=\"password\"" in response.text.lower() else 0
        no_of_forms = response.text.lower().count("<form")
        has_submit_button = 1 if "type=\"submit\"" in response.text.lower() else 0

        # Count iframes
        no_of_iframes = response.text.lower().count("<iframe")

        # Check meta robots tag
        robots_meta = 1 if "robots" in response.text.lower() else 0

        # Count redirects
        no_of_redirects = response.text.lower().count("window.location") + response.text.lower().count("meta http-equiv=\"refresh\"")

        # Check external form submit (if action attribute points outside)
        has_external_form_submit = 1 if "action=\"http" in response.text.lower() else 0

        # Check responsiveness (if viewport meta tag exists)
        is_responsive = 1 if "name=\"viewport\"" in response.text.lower() else 0

    except:
        pass  

    # **Financial keywords (to detect phishing)**
    keywords = ["bank", "crypto", "pay"]
    bank = 1 if any(k in url.lower() for k in ["bank"]) else 0
    crypto = 1 if any(k in url.lower() for k in ["crypto"]) else 0
    pay = 1 if any(k in url.lower() for k in ["pay"]) else 0

    # **Construct Feature Dictionary**
    features = {
        "URLLength": url_length,
        "DomainLength": domain_length,
        "IsDomainIP": 1 if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain_info.domain) else 0,
        "TLDLength": tld_length,
        "NoOfSubDomain": no_of_subdomains,
        "NoOfDigitsInURL": no_of_digits,
        "NoOfSpecialCharsInURL": no_of_special_chars,
        "ObfuscationRatio": obfuscation_ratio,
        "NoOfLettersInURL": no_of_letters,
        "LetterRatioInURL": letter_ratio,
        "DegitRatioInURL": digit_ratio,
        "IsHTTPS": is_https,
        "LineOfCode": response_length,
        "LargestLineLength": largest_line_length,
        "HasSSL": has_ssl,
        "HasFavicon": has_favicon,
        "NoOfJS": no_of_js,
        "NoOfCSS": no_of_css,
        "NoOfImage": no_of_images,
        "HasCopyrightInfo": has_copyright,
        "HasTitle": has_title,
        "HasDescription": has_description,
        "Bank": bank,
        "Crypto": crypto,
        "Pay": pay,
        "HasPasswordField": has_password_field,
        "HasSubmitButton": has_submit_button,
        "NoOfiFrame": no_of_iframes,
        "NoOfURLRedirect": no_of_redirects,
        "HasExternalFormSubmit": has_external_form_submit,
        "IsResponsive": is_responsive,
        "NoOfSelfRedirect": no_of_self_redirects,
        "NoOfExternalRef": no_of_external_refs,
        "NoOfSelfRef": no_of_self_refs,
        "HasHiddenFields": no_of_hidden_fields,
        "Robots": robots_meta,
        "URLTitleMatchScore": url_title_match_score,
        "DomainTitleMatchScore": domain_title_match_score,
        "URLSimilarityIndex": url_similarity_index,
        "CharContinuationRate": char_continuation_rate,
        "NoOfEqualsInURL": no_of_equals_in_url,
        "NoOfAmpersandInURL": no_of_ampersand_in_url,
        "NoOfQMarkInURL": no_of_qmark_in_url,
        "NoOfOtherSpecialCharsInURL": no_of_other_special_chars,
        "SpacialCharRatioInURL": obfuscation_ratio,
    }

    return features  
