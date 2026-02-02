"""Anidle game API router.

Uses Jikan API with config-based member range difficulty selection.
"""

import time
import uuid
from typing import Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.jikan_service import JikanService
from services.config_service import game_config
from models.game import AnidleGame

router = APIRouter()
jikan = JikanService()

# In-memory game storage (use Redis in production)
games: Dict[str, AnidleGame] = {}


class StartGameRequest(BaseModel):
    """Request to start a new game."""
    user_id: str
    difficulty: str = "normal"


class GuessRequest(BaseModel):
    """Request to make a guess."""
    anime_name: str


class HintRequest(BaseModel):
    """Request for a hint."""
    hint_type: str


@router.post("/start")
async def start_game(request: StartGameRequest):
    """Start a new Anidle game."""
    anime_data = await jikan.get_random_anime(request.difficulty)
    if not anime_data:
        raise HTTPException(status_code=500, detail="Failed to fetch anime from API")
    
    target = jikan.format_anime_data(anime_data)
    game_id = f"{request.user_id}_{uuid.uuid4().hex[:8]}"
    game = AnidleGame(
        game_id=game_id,
        user_id=request.user_id,
        target=target,
        difficulty=request.difficulty,
        max_guesses=game_config.anidle_max_guesses
    )
    
    games[game_id] = game
    
    return {
        "game_id": game_id,
        "max_guesses": game.max_guesses,
        "difficulty": request.difficulty
    }


@router.post("/{game_id}/guess")
async def make_guess(game_id: str, request: GuessRequest):
    """Submit a guess for the game."""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    
    if game.is_complete:
        raise HTTPException(status_code=400, detail="Game is already complete")
    
    guess_data = await jikan.search_anime(request.anime_name)
    if not guess_data:
        raise HTTPException(status_code=400, detail="Anime not found")
    
    guess = jikan.format_anime_data(guess_data)
    comparison = AnidleGame.compare_anime(guess, game.target)
    is_correct = game.add_guess(guess, comparison)
    
    response = {
        "guess": {"title": guess["title"], "year": guess["year"], "score": guess["score"], "image": guess["image"]},
        "comparison": comparison,
        "is_correct": is_correct,
        "is_complete": game.is_complete,
        "is_won": game.is_won,
        "guesses_remaining": game.get_guesses_remaining(),
        "guess_count": len(game.guesses)
    }
    
    if game.is_complete:
        response["target"] = game.target
        response["duration"] = game.get_duration()
    
    return response


@router.post("/{game_id}/hint")
async def get_hint(game_id: str, request: HintRequest):
    """Get a hint (costs guesses)."""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    if game.is_complete:
        raise HTTPException(status_code=400, detail="Game is already complete")
    
    game.hint_penalty += game_config.anidle_hint_penalty
    target = game.target
    hint_value = None
    
    if request.hint_type == "genre":
        hint_value = target["genres"][0] if target["genres"] else "Unknown"
    elif request.hint_type == "year":
        year = target["year"]
        hint_value = f"{(year // 10) * 10}s" if year else "Unknown"
    elif request.hint_type == "studio":
        hint_value = target["studios"][0] if target["studios"] else "Unknown"
    else:
        raise HTTPException(status_code=400, detail="Invalid hint type")
    
    return {"hint_type": request.hint_type, "hint_value": hint_value, "guesses_remaining": game.get_guesses_remaining()}


@router.post("/{game_id}/giveup")
async def give_up(game_id: str):
    """Give up the current game."""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    game.is_complete = True
    game.is_won = False
    
    return {"target": game.target, "guess_count": len(game.guesses), "duration": game.get_duration()}


@router.get("/{game_id}/status")
async def get_status(game_id: str):
    """Get current game status."""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    return {
        "game_id": game_id,
        "guess_count": len(game.guesses),
        "guesses_remaining": game.get_guesses_remaining(),
        "is_complete": game.is_complete,
        "is_won": game.is_won,
        "difficulty": game.difficulty,
        "duration": game.get_duration()
    }


@router.get("/search")
async def search_anime(q: str, limit: int = None):
    """Search anime for autocomplete."""
    if not q or len(q.strip()) < 2:
        return []
    limit = limit or game_config.search_limit
    return await jikan.search_multiple_anime(q, limit)


@router.get("/config")
async def get_config():
    """Get current difficulty configuration."""
    try:
        from services.config_service import game_config
        return {
            "min_members": game_config.min_members,
            "difficulty_ranges": {
                diff: game_config.get_member_ranges(diff)
                for diff in ["easy", "normal", "hard", "expert", "crazy", "insanity"]
            }
        }
    except Exception as e:
        return {"error": str(e)}
