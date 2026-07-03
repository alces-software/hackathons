import torch
from diffusers import Flux2KleinPipeline
from fastapi import FastAPI
from pydantic import BaseModel
import io
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
import time

pipe = None
generation_lock = asyncio.Lock()

def load_model():
    global pipe
    if pipe is None:
        print("Loading FLUX.2 Klein 4B distilled model (CPU, float32)...")
        print("This will take a while on first run — downloading weights...")
        pipe = Flux2KleinPipeline.from_pretrained(
            "black-forest-labs/FLUX.2-klein-4B",
            torch_dtype=torch.float32,
        ).to("cpu")
        print("Model loaded successfully!")

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield

app = FastAPI(lifespan=lifespan)

class GenerateRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 4
    guidance_scale: float = 1.0
    seed: int | None = None

@app.post("/generate")
async def generate(req: GenerateRequest):
    # Wait if another generation is in progress
    async with generation_lock:
        generator = None
        if req.seed is not None:
            generator = torch.Generator(device="cpu").manual_seed(req.seed)

        start = time.time()
        image = pipe(
            prompt=req.prompt,
            height=req.height,
            width=req.width,
            guidance_scale=req.guidance_scale,
            num_inference_steps=req.num_inference_steps,
            generator=generator,
        ).images[0]
        elapsed = time.time() - start
        print(f"Generated in {elapsed:.1f}s")

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipe is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6006)
