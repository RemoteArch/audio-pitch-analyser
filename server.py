from flask import Flask, redirect, request, jsonify
from flask_cors import CORS
import os
import subprocess
import uuid
import json
from werkzeug.utils import secure_filename
from utils.audio_anlyser import getFeaturesJson
import dotenv
dotenv.load_dotenv()
import requests
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

def call_ai_agent(analysis_data , dest_analyse_data):    
    system_prompt = """
    Tu es un coach vocal expert qui analyse les performances de chant.
    Basé sur les données d'analyse audio fournies, donne une note sur 10 
    et des conseils en moins de mots personnalisés pour aider l'utilisateur à s'améliorer.
    Réponds uniquement au format JSON avec les champs "note" et "feedback".
    """    
    try:
        response = requests.post(
            "https://wbsiz.clientxp.com/openai",
            json={
                "messages": json.dumps(analysis_data),
                "system": system_prompt,
            }
        )
        # Decode bytes to string, then parse as JSON
        return response.content.decode('utf-8')
    except Exception as e:
        print(f"Erreur lors de l'appel à l'API OpenAI: {str(e)}")
        return json.dumps({"note": 0, "feedback": "Oups je galere a repondre"})

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    try:
        # Générer un nom de fichier unique
        filename = request.args.get('name')
        if not filename:
            return jsonify({"error":"filename not defined"})
        filename = secure_filename(filename)
        unique_filename = f"{str(uuid.uuid4())}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        save_path = os.path.join(RESULTS_FOLDER, unique_filename + '.json')
        
        with open(filepath , 'wb') as file:
            file.write(request.data)
        
        results = getFeaturesJson(filepath)

        ai_response = call_ai_agent(results)
        data = {}
        # Make sure ai_response is properly loaded as JSON if it's a JSON string
        try:
            data['ai_response'] = json.loads(ai_response)
        except json.JSONDecodeError:
            data['ai_response'] = ai_response  # Keep as string if not valid JSON
        data['analyse_result'] = results

        with open(save_path, 'w') as f:
            json.dump(data, f)
        return jsonify(data), 200
    
    except subprocess.CalledProcessError as e:
        return jsonify({'error': f'Erreur lors de l\'analyse: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@app.route('/all-analyse')
def results():
    files = os.listdir(UPLOAD_FOLDER)
    return jsonify(files)

@app.route('/')
def index():
    return redirect('./static/index.html')

if __name__ == '__main__':
    app.run(port=5000 , host="0.0.0.0")
