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
COPY requirements-correct.txt requirements.txt

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste des fichiers
COPY . .

# Créer les répertoires nécessaires
RUN mkdir -p uploads results

# Exposer le port
EXPOSE 5000

# Variables d'environnement par défaut
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Commande par défaut
CMD ["python", "server.py"]
