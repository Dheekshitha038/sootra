import numpy as np 
from fastapi import APIRouter
from src.schemas.game import GameStartResponse, GameSessionState, GameStepResponse, AnswerSubmitRequest
from src.services.akinator_engine import BayesianAkinatorEngine
from src.services.data_loader import load_heritage_data


router = APIRouter(prefix="/api/v1/akinator")

entities, questions = load_heritage_data("data/entities.json", "data/questions.json")
engine = BayesianAkinatorEngine(entities, questions)

@router.get('/start', response_model = GameStartResponse)
def start_game() : 
    initial_probs = [1.0/ engine.num_entities]*engine.num_entities
    first_q = engine.get_next_best_question(initial_probs, [])
    return {
        "session_state": {
            "probabilities": initial_probs,
            "asked_questions": []
        },
        "first_question": first_q,
        "is_finished": False
    }

@router.post('/answer', response_model=GameStepResponse)
def submit_answer(request: AnswerSubmitRequest):
    current_probs = np.array(request.session_state.probabilities)
    asked_qs = request.session_state.asked_questions
    asked_qs.append(request.question_id)
    new_probs = engine.update_beliefs(current_probs, request.question_id, request.answer)
    top_entity, confidence = engine.get_top_prediction(new_probs)
    if confidence > 0.85 : 
        return {
            "session_state" : {
            "probabilities": new_probs.tolist(),
            "asked_questions": asked_qs
            }, 
            "next_question" : None,
            "is_finished": True, 
            "confidence" : confidence,
            "prediction" : top_entity
        }
    else : 
        next_question = engine.get_next_best_question(new_probs, asked_qs)
        return {
            "session_state" : {
            "probabilities": new_probs.tolist(),
            "asked_questions": asked_qs
            }, 
            "next_question" : next_question,
            "is_finished": False, 
            "confidence" : confidence,
            "prediction" : None
        }

            
        





