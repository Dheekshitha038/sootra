import json
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()


client = genai.Client()

def generate_characters(theme: str, count: int = 10):
    with open("data/questions.json", "r") as f:
        questions = json.load(f)
    
    question_list = "\n".join([f"{q['id']}: {q['text']['en']}" for q in questions])
    
    prompt = f"""
    You are an expert in Indian History and Mythology. Generate exactly {count} unique characters based on this theme: {theme}.
    
    For each character, you MUST score them against these 40 exact questions:
    {question_list}
    
    Score using exactly:
    1.0 = Yes/True
    0.0 = No/False
    0.5 = Unknown/Ambiguous/Debated
    
    You MUST return a JSON array of objects. Each object MUST strictly follow this exact structure:
    {{
        "id": "unique_lowercase_id",
        "canonical_name": "Standard English Name",
        "category": "Character",
        "regional_name": {{"hi": "Hindi Name", "te": "Telugu Name"}},
        "source_text": ["Source 1", "Source 2"],
        "attributes": {{
            "q_is_male": 1.0,
            "q_is_female": 0.0,
            "...": 0.5 
            // (Include ALL 40 questions mapped to their float score)
        }}
    }}
    """
    
    print(f"Asking AI to generate {count} characters for theme: '{theme}'...")
    print("This usually takes 20-40 seconds. Please wait...")
    
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt,
        config={
            'response_mime_type': 'application/json',
            'temperature': 0.2, 
        },
    )
    
    new_characters = json.loads(response.text)
    
    with open("data/entities.json", "r") as f:
        existing_db = json.load(f)
        
    existing_db.extend(new_characters)
    
    with open("data/entities.json", "w") as f:
        json.dump(existing_db, f, indent=2)
        
    print(f"Success! Appended {len(new_characters)} new characters to data/entities.json.")


if __name__ == "__main__":
    # RUN 1: Fills out the Pandava side, archers, and mace wielders
    #generate_characters("The Kaurava brothers and their greatest commanders in the Mahabharata", 10)
    
    # RUN 2: Fills out the antagonists, Kauravas, and tragic figures
    # generate_characters("The Kaurava brothers and their greatest commanders in the Mahabharata", 10)
    
    # RUN 3: Fills out humans, monkeys, and Ramayana specifics
    #generate_characters("Key figures from the Ramayana, including Ayodhya royalty and Vanaras", 10)

    # RUN 4: Triggers the Asura, multiple heads, and Shiva devotee questions
    #generate_characters("Famous Asuras, Rakshasas, and Demon Kings from Indian Puranas and Epics", 10)
    
    # RUN 5: Triggers the Divine, Creator/Destroyer, and Vahana (mount) questions
    #generate_characters("The Trimurti, Tridevi, and major Vedic Gods (like Indra, Agni, Surya)", 10)
    
    # RUN 6: Triggers the Sage, curse/vow, celibacy, and scholar questions
    #generate_characters("The greatest Sages (Rishis) and Gurus in Hindu mythology", 10)
    
    # RUN 7: Triggers the Animal/Creature and Vishnu Avatar questions
    #generate_characters("The Dashavatara (Ten Avatars of Vishnu) and other minor avatars", 10)
    
    # RUN 8: Ensures high representation for the Female demographic and fire/lore questions
    #generate_characters("Prominent Queens, Princesses, and Heroines from Indian Epics", 10)
    
    # RUN 9: Triggers the Historical Figure and Poet questions
    #generate_characters("Real historical Indian kings, emperors, and famous ancient scholars/poets", 10)
    
    # RUN 10: Triggers Regional Folklore and unique weapon questions
    generate_characters("Fierce regional deities, Grama Devatas, and legendary folk heroes of India", 10)