from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
import sys
import platform
from dotenv import load_dotenv
import os
import subprocess
import time
from typing import Optional, List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import random


# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Browser Automation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
USE_MOCK_RESPONSES = True  # Set to False to use real browser automation

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
AIML_API_KEY = os.environ.get("AIML_API_KEY")
AIML_API_ENDPOINT = os.environ.get("AIML_API_ENDPOINT")

# --- Brave configuration (macOS) ---
HOME = os.path.expanduser("~")
chrome_path = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
user_data_dir = os.path.join(HOME, "Library/Application Support/BraveSoftware/Brave-Browser/")
remote_debug_port = "9422"

# Controller setup - only import if not using mock
controller = None
if not USE_MOCK_RESPONSES:
    from browser_use import Agent, BrowserSession, Controller, ActionResult
    from langchain_openai import ChatOpenAI
    import litellm
    controller = Controller()

    @controller.action('Presses a specified keyboard key down and holds it.')
    async def press_keyboard_down(key: str, page) -> ActionResult:
        await page.keyboard.down(key)
        return ActionResult(extracted_content=f'Keyboard key "{key}" is now pressed down.')


# --- Mock Website Data ---
MOCK_WEBSITES = {
    "weather": {
        "url": "https://weather.com",
        "title": "Weather.com - Current Conditions",
        "content": """
        <div class="weather-card">
            <h1>San Francisco, CA</h1>
            <div class="temperature">68°F</div>
            <div class="condition">Partly Cloudy</div>
            <div class="details">
                <span>Humidity: 65%</span>
                <span>Wind: 12 mph W</span>
                <span>UV Index: 5</span>
            </div>
            <div class="forecast">
                <div class="day">Mon: 72°/58°</div>
                <div class="day">Tue: 70°/56°</div>
                <div class="day">Wed: 68°/54°</div>
            </div>
        </div>
        """,
        "summary": "Current weather in San Francisco: 68°F, Partly Cloudy. Humidity 65%, Wind 12 mph from the West."
    },
    "news": {
        "url": "https://news.ycombinator.com",
        "title": "Hacker News",
        "content": """
        <div class="news-feed">
            <article class="story">
                <h2>1. New AI Model Achieves Breakthrough in Code Generation</h2>
                <span class="meta">423 points | 156 comments | 3 hours ago</span>
            </article>
            <article class="story">
                <h2>2. Show HN: Open-source alternative to popular SaaS tools</h2>
                <span class="meta">287 points | 89 comments | 5 hours ago</span>
            </article>
            <article class="story">
                <h2>3. The Future of WebAssembly in 2026</h2>
                <span class="meta">198 points | 72 comments | 6 hours ago</span>
            </article>
            <article class="story">
                <h2>4. How We Scaled Our Database to Handle 1M Requests/sec</h2>
                <span class="meta">156 points | 45 comments | 8 hours ago</span>
            </article>
        </div>
        """,
        "summary": "Top stories: AI breakthrough in code generation (423 pts), Open-source SaaS alternative (287 pts), WebAssembly future (198 pts)."
    },
    "wikipedia": {
        "url": "https://wikipedia.org",
        "title": "Wikipedia - The Free Encyclopedia",
        "content": """
        <div class="wiki-article">
            <h1>Artificial Intelligence</h1>
            <p class="intro">Artificial intelligence (AI) is the simulation of human intelligence processes by machines,
            especially computer systems. These processes include learning, reasoning, and self-correction.</p>
            <h2>History</h2>
            <p>The field of AI research was founded at a workshop at Dartmouth College in 1956.</p>
            <h2>Applications</h2>
            <ul>
                <li>Natural Language Processing</li>
                <li>Computer Vision</li>
                <li>Robotics</li>
                <li>Expert Systems</li>
            </ul>
        </div>
        """,
        "summary": "Wikipedia article on Artificial Intelligence - covers history from 1956 Dartmouth workshop, and applications including NLP, Computer Vision, Robotics."
    },
    "stocks": {
        "url": "https://finance.yahoo.com",
        "title": "Yahoo Finance - Stock Market",
        "content": """
        <div class="market-summary">
            <h1>Market Summary</h1>
            <div class="indices">
                <div class="index positive">S&P 500: 5,234.18 (+0.82%)</div>
                <div class="index positive">NASDAQ: 16,891.45 (+1.12%)</div>
                <div class="index positive">DOW: 39,156.78 (+0.45%)</div>
            </div>
            <h2>Top Movers</h2>
            <div class="stocks">
                <div class="stock">NVDA: $892.45 (+4.2%)</div>
                <div class="stock">AAPL: $198.76 (+1.8%)</div>
                <div class="stock">MSFT: $421.32 (+2.1%)</div>
                <div class="stock">GOOGL: $156.89 (+1.5%)</div>
            </div>
        </div>
        """,
        "summary": "Markets up today. S&P 500 +0.82%, NASDAQ +1.12%, DOW +0.45%. Top movers: NVDA +4.2%, AAPL +1.8%, MSFT +2.1%."
    },
    "github": {
        "url": "https://github.com/trending",
        "title": "GitHub Trending Repositories",
        "content": """
        <div class="trending-repos">
            <h1>Trending Repositories</h1>
            <div class="repo">
                <h2>anthropics/claude-code</h2>
                <p>Official CLI tool for Claude AI assistant</p>
                <span class="stars">⭐ 12,456 stars today</span>
            </div>
            <div class="repo">
                <h2>openai/whisper</h2>
                <p>Robust Speech Recognition via Large-Scale Weak Supervision</p>
                <span class="stars">⭐ 8,234 stars today</span>
            </div>
            <div class="repo">
                <h2>vercel/next.js</h2>
                <p>The React Framework for the Web</p>
                <span class="stars">⭐ 5,678 stars today</span>
            </div>
        </div>
        """,
        "summary": "Trending on GitHub: claude-code (12.4k stars), whisper (8.2k stars), next.js (5.6k stars)."
    },
    "default": {
        "url": "https://example.com",
        "title": "Example Domain",
        "content": """
        <div class="example-page">
            <h1>Example Domain</h1>
            <p>This domain is for use in illustrative examples in documents.</p>
            <p>You may use this domain in literature without prior coordination or asking for permission.</p>
        </div>
        """,
        "summary": "Successfully loaded the requested webpage and extracted the content."
    }
}


def get_mock_response(task: str) -> Dict[str, Any]:
    """Generate a mock response based on the task keywords."""
    task_lower = task.lower()

    if any(word in task_lower for word in ["weather", "temperature", "forecast"]):
        site = MOCK_WEBSITES["weather"]
    elif any(word in task_lower for word in ["news", "hacker news", "hn", "headlines"]):
        site = MOCK_WEBSITES["news"]
    elif any(word in task_lower for word in ["wiki", "wikipedia", "search", "what is"]):
        site = MOCK_WEBSITES["wikipedia"]
    elif any(word in task_lower for word in ["stock", "market", "finance", "price"]):
        site = MOCK_WEBSITES["stocks"]
    elif any(word in task_lower for word in ["github", "trending", "repository", "repo"]):
        site = MOCK_WEBSITES["github"]
    else:
        site = MOCK_WEBSITES["default"]

    return {
        "url": site["url"],
        "title": site["title"],
        "html_content": site["content"],
        "summary": site["summary"],
        "steps_taken": [
            f"Navigated to {site['url']}",
            "Waited for page to load",
            "Extracted page content",
            "Analyzed and summarized results"
        ]
    }

# Pydantic models
class TaskRequest(BaseModel):
    task: str
    use_llm_cleaning: bool = True

class TaskResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    html_content: Optional[str] = None
    steps: Optional[List[str]] = None

# Helpers
def close_all_chrome():
    print("Closing all Brave processes...")
    try:
        os.system("pkill -f 'Brave Browser'")
        time.sleep(2)
        print("All Brave processes closed.")
    except Exception as e:
        print(f"Error closing Brave: {e}")


def start_chrome():
    print("Starting Brave with remote debugging...")
    try:
        # kill any running Brave
        close_all_chrome()

        # FIXED: Lock files are inside the specific profile directory, not the user_data_dir
        profile_path = os.path.join(user_data_dir, "Profile 1")
        for lock in ("LOCK", "SingletonLock"):
            fn = os.path.join(profile_path, lock)
            if os.path.exists(fn):
                try:
                    os.remove(fn)
                    print(f"Removed stale {lock} from profile directory")
                except OSError as e:
                    print(f"Error removing lock file {fn}: {e}")

        # Command to launch Brave with your "abdolla" profile
        chrome_cmd = [
            chrome_path,
            f"--remote-debugging-port={remote_debug_port}",
            f"--user-data-dir={user_data_dir}",
            "--profile-directory=Profile 1",
            "--no-first-run",
            "--no-default-browser-check",
        ]

        subprocess.Popen(chrome_cmd)
        print(f"Attempting to start Brave on port {remote_debug_port} with profile 'Profile 1'...")
        time.sleep(5)

    except Exception as e:
        print(f"Error starting Brave: {e}")
        raise



def get_cleaned_task(task: str) -> str:
    if USE_MOCK_RESPONSES:
        return task
    try:
        response = litellm.completion(
            model="openai/nvidia/llama-3.1-nemotron-70b-instruct",
            api_key=AIML_API_KEY,
            api_base="https://api.aimlapi.com/v2",
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI agent that controls a web browser...",
                },
                {
                    "role": "user",
                    "content": task,
                },
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"LLM cleaning failed: {e}")
        return task

async def execute_browser_task(task: str) -> str:
    try:
        await asyncio.sleep(5)
        browser_session = BrowserSession(cdp_url=f"http://127.0.0.1:{remote_debug_port}")
        print("Connecting to Brave using gpt-4o...")
        agent = Agent(
            task=task,
            llm=ChatOpenAI(
                model="gpt-4o",
                api_key=OPENAI_API_KEY,
                base_url="https://api.openai.com/v1",
            ),
            browser_session=browser_session,
            controller=controller,
        )
        result = await agent.run()
        return str(result)
    except Exception as e:
        print(f"Agent error: {e}")
        raise

# Routes
@app.get("/")
async def root():
    return {"message": "Browser Automation API is running", "mock_mode": USE_MOCK_RESPONSES}

@app.get("/sample-queries")
async def get_sample_queries():
    """Return sample queries that work with mock mode."""
    return {
        "queries": [
            {"category": "Weather", "query": "What's the weather like today?", "description": "Get current weather conditions"},
            {"category": "News", "query": "Show me the latest tech news", "description": "View trending stories from Hacker News"},
            {"category": "Finance", "query": "Check the stock market", "description": "View market indices and top movers"},
            {"category": "Wikipedia", "query": "What is artificial intelligence?", "description": "Search Wikipedia for information"},
            {"category": "GitHub", "query": "Show trending repositories on GitHub", "description": "View popular open source projects"},
        ]
    }

@app.post("/execute-task", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    try:
        # Use mock responses for Unity desktop testing
        if USE_MOCK_RESPONSES:
            # Simulate some processing time
            await asyncio.sleep(random.uniform(0.5, 1.5))
            mock_data = get_mock_response(request.task)
            return TaskResponse(
                success=True,
                result=mock_data["summary"],
                url=mock_data["url"],
                title=mock_data["title"],
                html_content=mock_data["html_content"],
                steps=mock_data["steps_taken"]
            )

        # Real browser automation (when USE_MOCK_RESPONSES is False)
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")
        start_chrome()

        task_to_execute = request.task
        if request.use_llm_cleaning and AIML_API_KEY:
            task_to_execute = get_cleaned_task(task_to_execute)
            print(f"Cleaned task: {task_to_execute}")

        result = await execute_browser_task(task_to_execute)
        close_all_chrome()
        return TaskResponse(success=True, result=result)
    except Exception as e:
        if not USE_MOCK_RESPONSES:
            close_all_chrome()
        return TaskResponse(success=False, error=f"Error: {str(e)}")

@app.post("/start-chrome")
async def start_chrome_endpoint():
    try:
        start_chrome()
        return {"message": "Brave started", "port": remote_debug_port}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Brave: {e}")

@app.post("/stop-chrome")
async def stop_chrome_endpoint():
    try:
        close_all_chrome()
        return {"message": "Brave stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop Brave: {e}")

# Main
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)