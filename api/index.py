import sys
from pathlib import Path

# Vercel executa a partir de /var/task/api — garante import do pacote app/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app  # noqa: E402
