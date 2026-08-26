import json

def fix_schema():
    with open("data/questions.json", "r") as f:
        questions = json.load(f)

    for q in questions:
        # Pull out the old string and delete the old key
        if "question_text" in q:
            old_text = q.pop("question_text")
            # Create the new dictionary format Pydantic expects
            q["text"] = {"en": old_text}

    with open("data/questions.json", "w") as f:
        json.dump(questions, f, indent=2)
        
    print(f"Successfully updated {len(questions)} questions to match the Pydantic schema!")

if __name__ == "__main__":
    fix_schema()

    