from flask import Flask, redirect, request, jsonify
from flask_cors import CORS
import os
import subprocess
import uuid
import json
from werkzeug.utils import secure_filename

import dotenv
dotenv.load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join('static','uploads')
RESULTS_FOLDER = os.path.join('static','results')
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}

# Créer le dossier uploads s'il n'existe pas
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def call_ai_agent(analysis_data):
    import openai
    import json
    
    system_prompt = """
    Tu es un coach vocal expert qui analyse les performances de chant.
    Basé sur les données d'analyse audio fournies, donne une note sur 10 
    et des conseils personnalisés pour aider l'utilisateur à s'améliorer.
    Réponds uniquement au format JSON avec les champs "note" et "feedback".
    """

    # Configuration de l'API OpenAI
    openai.api_key = os.getenv("KEY")
    
    try:
        # Appel à l'API OpenAI avec la nouvelle syntaxe (>=1.0.0)
        client = openai.OpenAI(api_key=os.getenv("KEY"))
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(analysis_data)}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        # Extraction de la réponse
        return response.choices[0].message.content
    except Exception as e:
        print(f"Erreur lors de l'appel à l'API OpenAI: {str(e)}")
        return json.dumps({"note": 0, "feedback": "Oups je galere a repondre"})

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    # Vérifier si un fichier a été envoyé
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier audio envoyé'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Aucun fichier sélectionné'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Format de fichier non supporté'}), 400

    try:
        # Générer un nom de fichier unique
        filename = secure_filename(file.filename)
        unique_filename = f"{str(uuid.uuid4())}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        save_path = os.path.join(RESULTS_FOLDER, unique_filename + '.json')
        
        # Sauvegarder le fichier
        file.save(filepath)
        
        # Exécuter l'analyse
        analyzer_path = os.path.join(os.path.dirname(__file__), 'audio-anlyser-correct.py')
        subprocess.run(['python', analyzer_path, filepath, save_path], check=True)
        
        # Lire les résultats
        with open(save_path, 'r') as f:
            results = json.load(f)

        ai_response = call_ai_agent(results)
        data = {}
        data['ai_response'] = ai_response
        data['analyse_result'] = results

        with open(save_path, 'w') as f:
            json.dump(data, f)
        return jsonify(data)
    
    except subprocess.CalledProcessError as e:
        return jsonify({'error': f'Erreur lors de l\'analyse: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@app.route('/')
def index():
    return redirect('./static/index.html')

if __name__ == '__main__':
    app.run(port=5000 , host="0.0.0.0")
