FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CUDA_VISIBLE_DEVICES="" \
    NVIDIA_VISIBLE_DEVICES=none \
    HF_HOME=/hf_cache \
    TRANSFORMERS_CACHE=/hf_cache/transformers \
    TORCH_HOME=/hf_cache/torch \
    PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

# Install PyTorch from the CPU-only wheel index first. The second install keeps
# the already-satisfied CPU torch packages while installing the app dependencies.
RUN python -m pip install --upgrade pip \
    && python -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && python -m pip install -r requirements.txt \
    && python -m pip check \
    && python -c "import importlib.metadata as m, sys, torch; bad=[d.metadata['Name'] for d in m.distributions() if d.metadata['Name'].lower().startswith(('nvidia', 'cuda'))]; assert torch.version.cuda is None, f'CUDA torch installed: {torch.version.cuda}'; assert not bad, f'GPU packages installed: {bad}'; print('CPU-only Python dependencies verified')"

COPY app ./app

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /app/cache /app/chroma_data /app/data /hf_cache \
    && chown -R appuser:appuser /app /hf_cache

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
