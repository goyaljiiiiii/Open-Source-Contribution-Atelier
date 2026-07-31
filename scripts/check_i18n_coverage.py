import os
import json
import sys

def main():
    locales_dir = os.path.join("frontend", "src", "i18n", "locales")
    if not os.path.isdir(locales_dir):
        print("Locales directory not found.")
        sys.exit(1)

    try:
        with open(os.path.join(locales_dir, "en.json"), "r") as f:
            en_data = json.load(f)
    except Exception as e:
        print(f"Error loading en.json: {e}")
        sys.exit(1)

    required_keys = set(en_data.keys())
    missing = False

    for filename in os.listdir(locales_dir):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(locales_dir, filename)
        with open(filepath, "r") as f:
            data = json.load(f)
        
        keys = set(data.keys())
        diff = required_keys - keys
        if diff:
            print(f"Locale {filename} is missing keys: {diff}")
            missing = True

    if missing:
        sys.exit(1)
    
    print("All locales have 100% key coverage.")

if __name__ == "__main__":
    main()
