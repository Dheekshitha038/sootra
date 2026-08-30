from pydantic import BaseModel
from typing import List, Optional
from src.schemas.entity import HeritageEntity, HeritageQuestion

class GameSessionState(BaseModel) : 
    probabilities : List[float]
    asked_questions : List[str]

class GameStartResponse(BaseModel) : 
    session_state : GameSessionState
    first_question : Optional[HeritageQuestion]
    is_finished : bool

class AnswerSubmitRequest(BaseModel) :
    session_state : GameSessionState
    question_id : str 
    answer : str 

class GameStepResponse(BaseModel) : 
    session_state : GameSessionState
    next_question : Optional[HeritageQuestion] = None
    is_finished : bool 
    confidence : float 
    prediction : Optional[HeritageEntity] = None




