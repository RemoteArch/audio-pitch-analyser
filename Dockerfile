# Utiliser une image officielle Python légère
FROM python:3.10-slim

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier et installer les dépendances Python
COPY requirements.txt .

# Installer pipenv ou pip si nécessaire (ici pip est déjà dispo)
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copier tous les fichiers de l'application
COPY . .

# Exposer le port utilisé par le serveur (Flask par défaut utilise 5000)
EXPOSE 5000

# Commande par défaut pour lancer le serveur
CMD ["python", "server.py"]
