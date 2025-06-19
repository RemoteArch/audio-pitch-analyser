
function Home() {
    const [isRecording, setIsRecording] = React.useState(false);
    const [mediaRecorder, setMediaRecorder] = React.useState(null);
    // Use a ref to collect audio chunks during each recording session
    const recordingChunksRef = React.useRef([]);
    const [file, setFile] = React.useState(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = React.useState(null); // For previewing audio
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [results, setResults] = React.useState(null);
    const [error, setError] = React.useState(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('audio/')) {
            setFile(droppedFile);
            setAudioPreviewUrl(URL.createObjectURL(droppedFile));
            setResults(null);
            setError(null);
            // Do not analyze immediately, wait for user to confirm
        } else {
            setError('Veuillez déposer un fichier audio valide');
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setAudioPreviewUrl(URL.createObjectURL(selectedFile));
            setResults(null);
            setError(null);
            // Do not analyze immediately, wait for user to confirm
        }
    };

    const analyzeFile = async (audioFile) => {
        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            let name = audioFile.name != undefined || audioFile.name ? audioFile.name : 'name.webm'
            const response = await fetch(`${BASE_URL}/analyze?name=${encodeURIComponent(name)}`, {
                method: 'POST',
                body: audioFile
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'analyse');
            }

            const data = await response.json();
            if ('error' in data) {
                setError(data.error);
            } else {
                setResults(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const stopSpeechSynthesis = () => {
        // Arrêter toute synthèse vocale en cours
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };
    
    const startRecording = async () => {
        // Arrêter la synthèse vocale si elle est en cours
        stopSpeechSynthesis();
        
        recordingChunksRef.current = []; // Reset before starting new recording
        try {
            // Check if running in a secure context
            if (!window.isSecureContext) {
                throw new Error('L\'accès au microphone nécessite un contexte sécurisé (HTTPS ou localhost)');
            }

            // Check for MediaDevices API support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('L\'API MediaDevices n\'est pas supportée par votre navigateur');
            }

            console.log('Requesting microphone access...');
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Microphone access granted:', stream.getAudioTracks()[0].label);

            // Fonction pour vérifier les types MIME supportés
            const getSupportedMimeType = () => {
                const types = [
                    'audio/webm',
                    'audio/mp4',
                    'audio/ogg',
                    'audio/wav',
                    ''
                ];
                
                for (let type of types) {
                    try {
                        if (!type || MediaRecorder.isTypeSupported(type)) {
                            console.log('Supported MIME type found:', type || 'browser default');
                            return type; // Retourner le premier type supporté
                        }
                    } catch (e) {
                        console.log('Error checking support for', type, e);
                    }
                }
                
                // Si aucun type spécifié n'est supporté, laissez le navigateur choisir
                console.log('No specified MIME type supported, using browser default');
                return '';
            };
            
            const mimeType = getSupportedMimeType();
            const options = mimeType ? { mimeType } : {};
            
            console.log('Creating MediaRecorder with options:', options);
            const recorder = new MediaRecorder(stream, options);
            setMediaRecorder(recorder);
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordingChunksRef.current.push(e.data);
                    console.log('Data available:', e.data.size, 'bytes');
                }
            };

            recorder.onstop = async () => {
                console.log('Recording stopped');
                // Utiliser le même type MIME que celui utilisé pour l'enregistrement, ou un format par défaut
                // Important: utiliser recorder (variable locale) au lieu de mediaRecorder (état React qui peut être null)
                const mimeType = recorder.mimeType || 'audio/webm';
                console.log('Creating blob with MIME type:', mimeType);
                const audioBlob = new Blob(recordingChunksRef.current, { type: mimeType });
                console.log('Created blob:', audioBlob.size, 'bytes');
                setFile(audioBlob);
                setAudioPreviewUrl(URL.createObjectURL(audioBlob));
                setResults(null);
                setError(null);
                // Do not analyze immediately, wait for user to confirm
                recordingChunksRef.current = [];
                // Stop all tracks in the stream to release the microphone
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Track stopped:', track.label);
                });
            };

            recorder.start(1000); // Collect data every second
            console.log('Recording started');
            setIsRecording(true);
        } catch (error) {
            // Log detailed error information
            console.error('Error accessing microphone:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                error: error
            });

            let errorMessage = 'Erreur d\'accès au microphone: ';
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Accès refusé. Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur:\n' +
                    '1. Cliquez sur l\'icône de cadenas/info à gauche de la barre d\'adresse\n' +
                    '2. Trouvez les paramètres du microphone\n' +
                    '3. Sélectionnez "Autoriser"\n\n' +
                    'Si le problème persiste, essayez de:\n' +
                    '- Rafraîchir la page\n' +
                    '- Vérifier que d\'autres applications n\'utilisent pas le microphone\n' +
                    '- Redémarrer le navigateur';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Aucun microphone détecté. Veuillez:\n' +
                    '1. Vérifier que votre microphone est bien connecté\n' +
                    '2. Vérifier qu\'il est sélectionné comme périphérique par défaut\n' +
                    '3. Réessayer après avoir connecté un microphone';
            } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
                errorMessage += 'Le microphone est peut-être utilisé par une autre application.\n' +
                    'Veuillez fermer les autres applications qui pourraient utiliser le microphone.';
            } else if (!window.isSecureContext) {
                errorMessage += 'L\'accès au microphone nécessite une connexion sécurisée (HTTPS).\n' +
                    'Veuillez utiliser HTTPS ou localhost.';
            } else {
                errorMessage += `${error.message}\n` +
                    'Type d\'erreur: ' + error.name;
            }
            
            setError(errorMessage);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const readFeedback = (text) => {
        // Arrêter toute synthèse vocale précédente
        stopSpeechSynthesis();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        window.speechSynthesis.speak(utterance);
    };

    const renderResults = () => {
        if (!results) return null;

        // Extraire la réponse AI qui peut être un objet ou une chaîne formatée
        let aiResponse;
        if (typeof results.ai_response === 'object') {
            // Si c'est déjà un objet (nouveau format après correction du serveur)
            if (results.ai_response.content) {
                // Format avec content (réponse complète de l'API)
                const content = results.ai_response.content;
                // Extraire le JSON du contenu formaté s'il y a des backticks
                if (content.includes('```json')) {
                    const cleanJsonStr = content.replace(/```json\n|```/g, '');
                    aiResponse = JSON.parse(cleanJsonStr);
                } else {
                    // Essayer de parser directement si c'est un JSON sans formatage
                    try {
                        aiResponse = JSON.parse(content);
                    } catch {
                        // Fallback: utiliser un objet par défaut si le parsing échoue
                        aiResponse = {
                            note: 5,
                            feedback: content
                        };
                    }
                }
            } else {
                // L'objet est déjà au bon format
                aiResponse = results.ai_response;
            }
        } else {
            // Ancien format: chaîne à nettoyer et parser
            const cleanJsonStr = results.ai_response.replace(/```json\n|```/g, '');
            aiResponse = JSON.parse(cleanJsonStr);
        }
        const analysisData = results.analyse_result;
        readFeedback(aiResponse.feedback);

        return (
            <div className="mt-8 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-900/30 p-6 md:p-8 rounded-xl shadow-xl border border-indigo-100 dark:border-indigo-800">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-indigo-600 dark:text-indigo-400">Résultats de l'analyse</h2>
                
                <div className="mb-6 md:mb-8 bg-indigo-50 dark:bg-indigo-900/30 p-4 md:p-6 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                        <h3 className="text-xl md:text-2xl font-semibold text-indigo-900 dark:text-indigo-200 mb-2 sm:mb-0">
                            <span role="img" aria-label="star" className="mr-2">🌟</span> Ton Résultat
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => readFeedback(aiResponse.feedback)}
                                className="px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-1"
                            >
                                <span role="img" aria-label="sound">🔊</span> Écouter
                            </button>
                            <button
                                onClick={stopSpeechSynthesis}
                                className="px-3 py-1.5 md:px-4 md:py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1"
                            >
                                <span role="img" aria-label="stop">🛑</span> Stop
                            </button>
                        </div>
                    </div>
                    <div className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-3 md:mb-4">{aiResponse.note}/10</div>
                    <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg leading-relaxed">{aiResponse.feedback}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    <div className="metric-card bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/40 shadow-md">
                        <div className="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1">
                            <span role="img" aria-label="musical-note">🎵</span> Ta Hauteur
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{analysisData.pitch_mean.toFixed(2)} Hz</div>
                    </div>
                    <div className="metric-card bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/40 shadow-md">
                        <div className="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1">
                            <span role="img" aria-label="metronome">⏱️</span> Ton Rythme
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{analysisData.tempo[0].toFixed(0)} BPM</div>
                    </div>
                    <div className="metric-card bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/40 shadow-md">
                        <div className="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1">
                            <span role="img" aria-label="star">⭐</span> Précision
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{(analysisData.rhythm_score * 100).toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-2xl md:text-4xl font-bold text-center mb-6 md:mb-8 text-indigo-900 dark:text-indigo-300">
                <span role="img" aria-label="microphone" className="inline-block mr-2">🎤</span> 
                Ta Voix en Action!
            </h1>
            <p className="text-center text-lg md:text-xl font-light mb-6 text-indigo-600 dark:text-indigo-400">Chante et découvre ton talent!</p>
            
            <div className="flex justify-center mb-6 md:mb-8">
                <div className="record-container relative">
                    <button
                        className={`record-button w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center bg-gradient-to-br ${isRecording ? 'from-red-500 to-red-700 animate-pulse shadow-lg shadow-red-500/50' : 'from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'} transition-all duration-300 transform hover:scale-105 shadow-lg`}
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? (
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="6" />
                            </svg>
                        )}
                    </button>
                    {isRecording && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                            <span className="text-xs font-bold text-white">REC</span>
                        </div>
                    )}
                </div>
            </div>
            
            <p className="text-center text-gray-600 dark:text-gray-300 text-lg mb-6 md:mb-8 font-medium">
                {isRecording ? '🔴 Enregistrement en cours... Clique pour arrêter!' : '🎵 Prêt à chanter? Appuie sur le bouton!'}
            </p>

            {/* Audio preview and analyze button */}
            {audioPreviewUrl && (
                <div className="flex flex-col items-center mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl shadow-md">
                    <p className="text-lg font-medium text-indigo-700 dark:text-indigo-300 mb-3">🎵 Ton enregistrement est prêt!</p>
                    <audio controls src={audioPreviewUrl} className="w-full max-w-md mb-4 rounded-lg" />
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg shadow-lg shadow-indigo-500/30 transform transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 font-medium"
                        onClick={() => analyzeFile(file)}
                        disabled={isLoading}
                    >
                        <span role="img" aria-label="magic">✨</span> Analyse magique!
                    </button>
                </div>
            )}
            
            {/* Section de chargement - visible uniquement pendant l'analyse */}
            {isLoading && (
                <div className="flex flex-col items-center py-8 mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-xl mx-auto">
                    <svg className="animate-spin w-10 h-10 md:w-12 md:h-12 text-indigo-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-600 dark:text-gray-300">Analyse en cours...</p>
                </div>
            )}

            {error && (
                <div className="mt-4 p-3 md:p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg max-w-xl mx-auto">
                    {error.split('\n').map((line, i) => (
                        <p key={i} className="mb-2 last:mb-0 text-sm md:text-base">{line}</p>
                    ))}
                </div>
            )}

            {renderResults()}
        </div>
    );
}
