
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

    const startRecording = async () => {
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

            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            setMediaRecorder(recorder);
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordingChunksRef.current.push(e.data);
                    console.log('Data available:', e.data.size, 'bytes');
                }
            };

            recorder.onstop = async () => {
                console.log('Recording stopped');
                const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
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
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        window.speechSynthesis.speak(utterance);
    };

    const renderResults = () => {
        if (!results) return null;

        // Nettoyer la réponse JSON de l'API en enlevant les backticks et 'json'
        const cleanJsonStr = results.ai_response.replace(/```json\n|```/g, '');
        const aiResponse = JSON.parse(cleanJsonStr);
        const analysisData = results.analyse_result;
        readFeedback(aiResponse.feedback);

        return (
            <div className="mt-8 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl shadow-xl">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-indigo-600 dark:text-indigo-400">Résultats de l'analyse</h2>
                
                <div className="mb-6 md:mb-8 bg-indigo-50 dark:bg-indigo-900/30 p-4 md:p-6 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                        <h3 className="text-xl md:text-2xl font-semibold text-indigo-900 dark:text-indigo-200 mb-2 sm:mb-0">Évaluation IA</h3>
                        <button
                            onClick={() => readFeedback(aiResponse.feedback)}
                            className="px-3 py-1.5 md:px-4 md:py-2 hidden bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg transition-colors"
                        >
                            🔊 Écouter le feedback
                        </button>
                    </div>
                    <div className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-3 md:mb-4">{aiResponse.note}/10</div>
                    <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg leading-relaxed">{aiResponse.feedback}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="metric-card bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="font-medium text-gray-600 dark:text-gray-400">Hauteur moyenne</div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{analysisData.pitch_mean.toFixed(2)} Hz</div>
                    </div>
                    <div className="metric-card bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="font-medium text-gray-600 dark:text-gray-400">Tempo</div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{analysisData.tempo[0].toFixed(0)} BPM</div>
                    </div>
                    <div className="metric-card bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="font-medium text-gray-600 dark:text-gray-400">Score rythmique</div>
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{(analysisData.rhythm_score * 100).toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-2xl md:text-4xl font-bold text-center mb-6 md:mb-8 text-indigo-900 dark:text-indigo-300">Analyseur de Performance Vocale</h1>
            
            <div className="flex justify-center mb-6 md:mb-8">
                <button
                    className={`record-button w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors ${isRecording ? 'animate-pulse bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                >
                    {isRecording ? (
                        <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="6" />
                        </svg>
                    )}
                </button>
            </div>
            
            <p className="text-center text-gray-600 dark:text-gray-300 text-sm md:text-base mb-6 md:mb-8">
                {isRecording ? 'Cliquez pour arrêter l\'enregistrement' : 'Cliquez pour commencer l\'enregistrement'}
            </p>

            {/* Audio preview and analyze button */}
            {audioPreviewUrl && (
                <div className="flex flex-col items-center mb-6">
                    <audio controls src={audioPreviewUrl} className="w-full max-w-md mb-2" />
                    <button
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow"
                        onClick={() => analyzeFile(file)}
                        disabled={isLoading}
                    >
                        Analyser ce fichier
                    </button>
                </div>
            )}
            
            <div
                className={`drop-zone border-2 border-dashed rounded-lg p-4 md:p-6 ${isDragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600'} max-w-xl mx-auto transition-colors`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                {isLoading ? (
                    <div className="flex flex-col items-center py-8">
                        <svg className="animate-spin w-10 h-10 md:w-12 md:h-12 text-indigo-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-4 text-gray-600 dark:text-gray-300">Analyse en cours...</p>
                    </div>
                ) : (
                    <div className="p-4 md:p-6">
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="fileInput"
                        />
                        <label
                            htmlFor="fileInput"
                            className="cursor-pointer block text-center"
                        >
                            <div className="text-base md:text-lg mb-2 text-gray-800 dark:text-gray-200">Déposez votre fichier audio ici</div>
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">ou cliquez pour sélectionner</div>
                        </label>
                    </div>
                )}
            </div>

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
