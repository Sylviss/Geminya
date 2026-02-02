Here is a comprehensive summary of the current project state, architectural changes, and logic implementations to bring the new agent up to speed.

### **Project Overview**
We are migrating the **Geminya Discord Bot**'s mini-games (Anidle, Guess Anime, Guess Character) from standard Discord `cogs` (text/embed commands) into a **Discord Activity** (Web-based interactive iframe).

**Architecture:** Hybrid Approach
1.  **Original Bot:** Python (`discord.py`) - Keeps running core commands.
2.  **Activity Backend:** Python (`FastAPI`) - Handles game logic, located in `activity/backend`.
3.  **Activity Frontend:** React (`Vite` + `Tailwind`) - The visual game interface, located in `activity/frontend`.
4.  **Database:** PostgreSQL (Shared between Bot and Activity).

---

### **Recent Major Changes**

#### **1. Database & Data Sourcing**
*   **New Table:** `anime_mappings` was created to link IDs between sources (MAL ID $\leftrightarrow$ TMDB ID $\leftrightarrow$ AniList ID).
*   **Sync Script:** `sync_anime_lists.py` was created to populate `anime_mappings` using the `Fribb/anime-lists` repo.
    *   *Latest Action:* Logic updated to **sync ALL entries** regardless of whether they exist in the local `series` table.
*   **Metadata Source:** The `series` table (existing bot table) contains metadata (Name, Score, Members), while `anime_mappings` is strictly for ID translation.

#### **2. Game Logic & Difficulty Overhaul**
We moved away from "Score-based" difficulty to **"Member-count (Popularity) based"** difficulty.
*   **Config:** `activity/backend/config.yml` defines member ranges for difficulties (Easy, Normal, Hard, Expert, Crazy, Insanity).
*   **Logic:** Games now select anime based on `members` count from Jikan/Database to ensure "Easy" anime are actually recognizable.

#### **3. Specific Game Implementations**

**A. Guess Anime (Heavily Reworked)**
*   **Flow:**
    1.  **Selection:** Select Random Anime via **Jikan API** (filtered by member count from config).
    2.  **Mapping:** Look up the MAL ID in the `anime_mappings` table to get the **TMDB ID**.
    3.  **Assets:** Fetch screenshots from **TMDB API**.
*   **Screenshot Logic (Specific Rules):**
    *   Images 1, 2, 3: Prefer **Episode Stills** (fallback to Backdrop).
    *   Image 4: Prefers **Backdrop** (fallback to Still).
    *   **Constraint:** Anime must have at least **4 valid images** to be playable.
*   **TMDB Service:** Implemented to handle "TV Show" vs "Movie" logic and fetch specific episode stills (`/tv/{id}/season/{s}/episode/{e}/images`).

**B. Anidle**
*   Uses Jikan API directly but applies the new **Member-count difficulty config**.
*   Frontend updated to fix UI layout (drop-up menus, genre overflow).

**C. Guess Character**
*   Uses Jikan API.
*   Frontend/Backend updated to include **deduplication** (prevent duplicate characters/anime in options).

---

### **Current Technical Stack Status**

*   **Backend (`activity/backend`):**
    *   `routers/`: `guess_anime.py`, `anidle.py`, `guess_character.py`.
    *   `services/`:
        *   `jikan_service.py`: Handles selection via Jikan API.
        *   `tmdb_service.py`: Handles screenshot fetching (requires `TMDB_API_KEY` in `secrets.json`).
        *   `database_service.py`: Connects to shared Postgres.
*   **Frontend (`activity/frontend`):**
    *   Fully functional React pages for all 3 games.
    *   UI improvements: Drop-up menus, screenshot galleries, result screens.

### **Immediate Context for Next Actions**
1.  **Sync Script:** The `sync_anime_lists.py` was just modified to import *all* mappings. You may need to verify the database population or handle edge cases if the mapping data is messy.
2.  **Integration:** The backend and frontend are separated. The Discord Bot cogs (`cogs/commands/`) still exist but are effectively legacy for these specific games; the goal is to fully rely on the Activity versions.
3.  **TMDB:** We confirmed TMDB offers "Stills" (per episode) and "Backdrops". The code handles the distinction between TV and Movie types in the mapping table.

**Goal:** Ensure the backend successfully serves the games using the new data flow (Jikan -> DB Mapping -> TMDB) and that the sync script populates the database correctly.