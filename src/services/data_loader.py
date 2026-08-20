import json
from typing import List, Tuple
from src.schemas.entity import HeritageEntity, HeritageQuestion

def load_heritage_data(entities_path: str, questions_path: str) : 
    with open(entities_path, 'r', encoding='utf-8') as e : 
        raw_datae = json.load(e)
        entities = [HeritageEntity(**item) for item in raw_datae]
    with open(questions_path, 'r', encoding = 'utf-8') as q : 
        raw_dataq = json.load(q) 
        questions = [HeritageQuestion(**item) for item in raw_dataq]
    return entities, questions
