import json
from collections import Counter

def check_duplicates():
    try:
        with open("data/entities.json", "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error: data/entities.json not found!")
        return
    except json.JSONDecodeError:
        print("Error: data/entities.json is empty or contains invalid JSON.")
        return

    print(f"Total characters in database: {len(data)}")

    # 1. Check for Duplicate IDs
    ids = [char.get("id") for char in data]
    duplicate_ids = [id for id, count in Counter(ids).items() if count > 1]
    
    if duplicate_ids:
        print(f"\n⚠️ FOUND {len(duplicate_ids)} DUPLICATE IDs:")
        for dup in duplicate_ids:
            print(f" - {dup}")
    else:
        print("\n✅ All IDs are completely unique!")

    # 2. Check for Duplicate Names
    names = [char.get("canonical_name") for char in data]
    duplicate_names = [name for name, count in Counter(names).items() if count > 1]
    
    if duplicate_names:
        print(f"\n⚠️ FOUND {len(duplicate_names)} DUPLICATE NAMES:")
        for dup in duplicate_names:
            print(f" - {dup}")
    else:
        print("✅ All Canonical Names are completely unique!")

if __name__ == "__main__":
    check_duplicates()