# Utiliser une image Python officielle
FROM python:3.10-slim

# Installer les dépendances système nécessaires pour librosa
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY requirements.txt requirements.txt

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste des fichiers
COPY . .

# Exposer le port
EXPOSE 5000

# Commande par défaut
CMD ["python", "server.py"]
