import librosa
import numpy as np
from librosa.sequence import dtw


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

def extract_notes_from_pitch_sequence(pitch_seq):
    """Renvoie la séquence de noms de notes chantées"""
    return [freq_to_note_name(f) for f in pitch_seq if f > 0]

def extract_audio_features(audio_path, duration=None):
    y, sr = librosa.load(audio_path, duration=duration)
    
    f0, _, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
    pitch_mean = np.nanmean(f0)
    pitch_seq = np.nan_to_num(f0, nan=0.0)

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfccs_mean = np.mean(mfccs, axis=1)

    rms = librosa.feature.rms(y=y)
    energy = np.mean(rms)

    return {
        'pitch_mean': pitch_mean,
        'pitch_seq': pitch_seq,
        'tempo': tempo,
        'mfccs_mean': mfccs_mean,
        'energy': energy,
        'y': y,
        'sr': sr
    }

def compare_performance(user_features, ref_features):
    pitch_diff = abs(user_features['pitch_mean'] - ref_features['pitch_mean'])
    tempo_diff = abs(user_features['tempo'] - ref_features['tempo'])
    energy_diff = abs(user_features['energy'] - ref_features['energy'])

    D, wp = dtw(user_features['pitch_seq'].reshape(-1, 1),
                ref_features['pitch_seq'].reshape(-1, 1),
                metric='euclidean')
    alignment_cost = D[-1, -1]

    score = 100
    score -= pitch_diff * 0.5
    score -= tempo_diff * 1.0
    score -= alignment_cost * 0.05
    score -= energy_diff * 100

    score = max(0, min(score, 100))

    if score >= 85:
        verdict = "🎤 Excellente performance !"
    elif score >= 70:
        verdict = "👍 Bonne performance, quelques ajustements possibles."
    else:
        verdict = "⚠️ Performance à améliorer."

    return {
        'pitch_diff': pitch_diff,
        'tempo_diff': tempo_diff,
        'energy_diff': energy_diff,
        'alignment_cost': alignment_cost,
        'score': score,
        'verdict': verdict
    }

# === Exemple d'utilisation ===
# user_path = "chant_user.wav"
# ref_path = "original_song.wav"
# user = extract_audio_features(user_path)
# ref = extract_audio_features(ref_path)
# result = compare_performance(user, ref)
# print(result)
