from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class GeoCoordinate(BaseModel) : 
    name : str 
    latitude : float 
    longitude : float 

class HeritageEntity(BaseModel) : 
    id : str 
    canonical_name : str 
    category : str
    regional_name : Dict[str, str] = {}
    source_text : List[str] = []
    spatial_coordinates : Optional[GeoCoordinate] = None
    attributes : Dict[str, float]

class HeritageQuestion(BaseModel) : 
    id : str 
    category : str 
    text : Dict[str, str]