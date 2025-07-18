import librosa
import numpy as np
from librosa.sequence import dtw
from sklearn.preprocessing import MinMaxScaler
from pydub import AudioSegment
import os



config = {
    'pitch_weight': 0.3,
    'tempo_weight': 0.2,
    'rhythm_weight': 0.2,
    'timbre_weight': 0.15,
    'energy_weight': 0.15,
    'excellent_threshold': 85,
    'good_threshold': 70,
    'min_freq': librosa.note_to_hz('C2'),
    'max_freq': librosa.note_to_hz('C7'),
    'vibrato_threshold': 0.5
}

# Charger la configuration personnalisée si elle existe
# config = load_config(config_path) if config_path else default_config

# Initialiser le scaler pour la normalisation
scaler = MinMaxScaler()

def load_config( config_path):
    try:
        with open(config_path, 'r') as f:
            return {**default_config, **json.load(f)}
    except:
        return default_config

def note_name_to_freq(note_name):
    """Convertit un nom de note musicale en fréquence (ex: A4 → 440 Hz)"""
    if note_name is None or note_name == '':
        return None
    try:
        return librosa.note_to_hz(note_name)
    except ValueError:
        return None

def freq_to_note_name(freq):
    """Convertit une fréquence en note musicale (ex: 440 Hz → A4)"""
    if freq <= 0 or np.isnan(freq):
        return None
    note_num = int(np.round(librosa.hz_to_midi(freq)))
    return librosa.midi_to_note(note_num)

def analyze_vibrato(pitch_seq, sr):
    """Analyse le vibrato dans une séquence de hauteurs"""
    if len(pitch_seq) < 2:
        return 0.0
    
    # Calculer les variations de hauteur
    pitch_diff = np.diff(pitch_seq)
    
    # Détecter les oscillations régulières
    zero_crossings = np.where(np.diff(np.signbit(pitch_diff)))[0]
    if len(zero_crossings) < 2:
        return 0.0
    
    # Calculer la fréquence moyenne des oscillations
    vibrato_rate = sr / np.mean(np.diff(zero_crossings))
    
    # Un bon vibrato est généralement entre 4-8 Hz
    vibrato_score = 1.0 - min(abs(vibrato_rate - 6) / 4, 1.0)
    return vibrato_score

def analyze_timbre(y, sr):
    """Analyse avancée du timbre"""
    # Calculer le spectrogramme
    D = np.abs(librosa.stft(y))
    
    # Extraire diverses caractéristiques du timbre
    spectral_centroid = np.mean(librosa.feature.spectral_centroid(S=D, sr=sr))
    spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(S=D, sr=sr))
    spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(S=D, sr=sr))
    
    # Normaliser et combiner les caractéristiques
    features = np.array([spectral_centroid, spectral_bandwidth, spectral_rolloff]).reshape(1, -1)
    normalized_features = scaler.fit_transform(features)
    
    return np.mean(normalized_features)

def analyze_rhythm(y, sr, tempo):
    """Analyse avancée du rythme"""
    # Détecter les temps (beats)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    
    # Calculer la régularité des temps
    if len(beats) > 1:
        beat_intervals = np.diff(beats)
        rhythm_regularity = 1.0 - np.std(beat_intervals) / np.mean(beat_intervals)
    else:
        rhythm_regularity = 0.0
    
    # Calculer la force des temps
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    pulse_clarity = np.mean(onset_env)
    
    return (rhythm_regularity + min(pulse_clarity, 1.0)) / 2

def convert_to_wav(src_path, dst_path, sample_rate=44100):
    """
    Convertit un fichier audio (webm, ogg, mp3, etc.) en wav.
    Utilise directement ffmpeg pour la conversion.
    src_path: chemin du fichier source
    dst_path: chemin du fichier wav de sortie
    sample_rate: fréquence d'échantillonnage cible (par défaut 44100 Hz)
    """
    import subprocess
    cmd = ["ffmpeg", "-y", "-i", src_path, "-ar", str(sample_rate), "-ac", "1", dst_path]
    subprocess.run(cmd, check=True,shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return dst_path

# === Exemple d'utilisation ===
def numpy_to_serializable(obj):
    """Convertit les objets numpy en types Python standards pour la sérialisation JSON"""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.float32) or isinstance(obj, np.float64):
        return float(obj)
    elif isinstance(obj, np.int32) or isinstance(obj, np.int64):
        return int(obj)
    elif isinstance(obj, dict):
        return {k: numpy_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [numpy_to_serializable(item) for item in obj]
    return obj


def extract_audio_features(audio_path, duration=None):
    """Extrait les caractéristiques audio avancées"""
    try:
        y, sr = librosa.load(audio_path, duration=duration)
    except:
        convert_to_wav(audio_path , audio_path+'.wav')
        y, sr = librosa.load(audio_path+'.wav', duration=duration)

    
    # Analyse de hauteur (pitch) avec pYIN
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=config['min_freq'],
        fmax=config['max_freq']
    )
    
    pitch_mean = np.nanmean(f0[voiced_flag])
    pitch_seq = np.nan_to_num(f0, nan=0.0)
    
    # Analyse du tempo et du rythme
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    rhythm_score = analyze_rhythm(y, sr, tempo)
    
    # Analyse du timbre
    timbre_score = analyze_timbre(y, sr)
    
    # Analyse du vibrato
    vibrato_score = analyze_vibrato(pitch_seq[voiced_flag], sr)
    
    # Analyse de l'énergie
    rms = librosa.feature.rms(y=y)
    energy = np.mean(rms)
    
    # MFCC pour analyse supplémentaire du timbre
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfccs_mean = np.mean(mfccs, axis=1)

    return {
        'pitch_mean': pitch_mean,
        'pitch_seq': pitch_seq,
        'tempo': tempo,
        'rhythm_score': rhythm_score,
        'timbre_score': timbre_score,
        'vibrato_score': vibrato_score,
        'energy': energy,
        'mfccs_mean': mfccs_mean,
        'y': y,
        'sr': sr
    }


def getFeaturesJson(audio_path):
    features = extract_audio_features(audio_path , None)
    filtered_features = {k: v for k, v in features.items() if k not in ['y', 'sr']}
    serializable_features = numpy_to_serializable(filtered_features)
    return serializable_features

def compare_performance( user_features, ref_features):
    """Compare les performances avec une analyse détaillée"""
    # Différence de hauteur
    pitch_diff = abs(user_features['pitch_mean'] - ref_features['pitch_mean'])
    pitch_score = max(0, 100 - pitch_diff * 0.5)
    
    # Différence de tempo et rythme
    tempo_diff = abs(user_features['tempo'] - ref_features['tempo'])
    tempo_score = max(0, 100 - tempo_diff * 1.0)
    
    # Score de rythme
    rhythm_score = 100 * (1 - abs(user_features['rhythm_score'] - ref_features['rhythm_score']))
    
    # Alignement temporel (DTW)
    D, wp = dtw(
        user_features['pitch_seq'].reshape(-1, 1),
        ref_features['pitch_seq'].reshape(-1, 1),
        metric='euclidean'
    )
    alignment_score = max(0, 100 - D[-1, -1] * 0.05)
    
    # Comparaison du timbre
    timbre_score = 100 * (1 - abs(user_features['timbre_score'] - ref_features['timbre_score']))
    
    # Différence d'énergie
    energy_diff = abs(user_features['energy'] - ref_features['energy'])
    energy_score = max(0, 100 - energy_diff * 100)
    
    # Score de vibrato
    vibrato_score = 100 * (1 - abs(user_features['vibrato_score'] - ref_features['vibrato_score']))
    
    # Calcul du score final pondéré
    final_score = (
        config['pitch_weight'] * pitch_score +
        config['tempo_weight'] * tempo_score +
        config['rhythm_weight'] * rhythm_score +
        config['timbre_weight'] * timbre_score +
        config['energy_weight'] * energy_score
    )
    
    final_score = max(0, min(final_score, 100))
    
    # Déterminer le verdict
    if final_score >= config['excellent_threshold']:
        verdict = "🎤 Excellente performance !"
        details = "Très bonne maîtrise de la hauteur, du rythme et de l'expression."
    elif final_score >= config['good_threshold']:
        verdict = "👍 Bonne performance"
        details = "Bonne exécution globale avec quelques points à améliorer."
    else:
        verdict = "⚠️ Performance à améliorer"
        details = "Des ajustements sont nécessaires pour la hauteur, le rythme ou l'expression."
    
    return {
        'score': final_score,
        'verdict': verdict,
        'details': details,
        'components': {
            'pitch_score': pitch_score,
            'tempo_score': tempo_score,
            'rhythm_score': rhythm_score,
            'timbre_score': timbre_score,
            'energy_score': energy_score,
            'vibrato_score': vibrato_score,
            'alignment_score': alignment_score
        }
    }


if __name__ == "__main__":
    import sys
    import os
    import time
    import json

    def print_usage():
        print("Usage:")
        print(f"  {os.path.basename(sys.argv[0])} <fichier_audio>            : Analyser un seul fichier")
        print(f"  {os.path.basename(sys.argv[0])} <fichier1> <fichier2>     : Comparer deux fichiers")
        sys.exit(1)

    # Vérifier les arguments
    if len(sys.argv) <= 2:
        print_usage()

    try:
        if len(sys.argv) == 3:
            # Analyse d'un seul fichier
            audio_path = sys.argv[1]
            save_path = sys.argv[2]
            if not os.path.exists(audio_path):
                print(f"Erreur: Le fichier {audio_path} n'existe pas")
                sys.exit(1)
            timestamp = time.time()
            features = getFeaturesJson(audio_path)
            open(save_path , 'w').write(json.dumps(features))
        else:
            print_usage()

    except Exception as e:
        print(f"Erreur lors de l'analyse: {str(e)}")
        sys.exit(1)
