

// Fonction pour récupérer la liste des fichiers analysés
const fetchAnalyzedAudios = async () => {
    try {
        const response = await fetch(`${BASE_URL}/all-analyse`);
        if (!response.ok) throw new Error("Erreur lors de la récupération des fichiers");
        const filenames = await response.json();
        // Transformer les noms de fichiers en objets avec les propriétés qu'on va utiliser
        return filenames.map(filename => ({
            filename,
            loaded: false,  // Indique si les résultats ont déjà été chargés
            results: null   // Contiendra les résultats une fois chargés
        }));
    } catch (error) {
        console.error("Erreur:", error);
        return [];
    }
};

// Fonction pour récupérer les résultats d'un fichier audio spécifique
const fetchFileResults = async (filename) => {
    try {
        const response = await fetch(`${BASE_URL}/results?name=${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error("Erreur lors de la récupération des résultats");
        return await response.json();
    } catch (error) {
        console.error(`Erreur pour ${filename}:`, error);
        return null;
    }
};

function Dashboard() {
    // État pour stocker les fichiers audio avec leurs résultats
    const [audioFiles, setAudioFiles] = React.useState([]);
    // État pour gérer les fichiers dont les résultats sont affichés
    const [expandedFiles, setExpandedFiles] = React.useState({});
    // État pour gérer le chargement global et par fichier
    const [loading, setLoading] = React.useState(true);
    const [loadingFiles, setLoadingFiles] = React.useState({});
    
    // Fonction pour basculer l'affichage des résultats d'un fichier
    const toggleExpand = async (filename) => {
        // Inverser l'état d'expansion
        setExpandedFiles(prev => ({
            ...prev,
            [filename]: !prev[filename]
        }));
        
        // Si on ouvre le fichier et que les résultats ne sont pas encore chargés, les charger
        const file = audioFiles.find(f => f.filename === filename);
        if (file && !file.loaded && !loadingFiles[filename]) {
            // Marquer comme en cours de chargement
            setLoadingFiles(prev => ({ ...prev, [filename]: true }));
            
            try {
                // Charger les résultats
                const results = await fetchFileResults(filename);
                const cleanJsonStr = results.ai_response.content.replace(/```json\n|```/g, '');
                const aiResponse = JSON.parse(cleanJsonStr);
                results.ai_response = aiResponse;
                // Mettre à jour les résultats dans notre état
                setAudioFiles(files => 
                    files.map(f => 
                        f.filename === filename 
                            ? { ...f, results, loaded: true } 
                            : f
                    )
                );
            } catch (error) {
                console.error(`Erreur de chargement pour ${filename}:`, error);
                // Marquer comme chargé même en cas d'erreur pour éviter les tentatives répétées
                setAudioFiles(files => 
                    files.map(f => 
                        f.filename === filename 
                            ? { ...f, loaded: true } 
                            : f
                    )
                );
            } finally {
                // Terminer le chargement
                setLoadingFiles(prev => ({ ...prev, [filename]: false }));
            }
        }
    };
    
    // Charger la liste des fichiers audio au montage du composant
    React.useEffect(() => {
        const loadFiles = async () => {
            setLoading(true);
            try {
                const files = await fetchAnalyzedAudios();
                setAudioFiles(files);
            } catch (error) {
                console.error('Erreur lors du chargement:', error);
            } finally {
                setLoading(false);
            }
        };
        
        loadFiles();
    }, []);
    
    return (
        <div className="mt-12 container mx-auto px-4 py-8 max-w-6xl">
            <h2 className="text-3xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">Historique des analyses</h2>
            
            {/* Chargement initial */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 dark:border-indigo-400"></div>
                </div>
            )}
            
            {/* Aucun fichier */}
            {!loading && audioFiles.length === 0 && (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-300 text-lg">Aucun fichier audio analysé</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Enregistrez d'abord un audio pour voir l'historique</p>
                </div>
            )}
            
            {/* Liste des fichiers */}
            {!loading && audioFiles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {audioFiles.map((file) => (
                        <div key={file.filename} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                            {/* Carte principale avec audio */}
                            <div className="p-4">
                                {/* Lecteur audio - pas de clic global ici */}
                                <div className="mb-3">
                                    <div className="flex items-center space-x-2">
                                        <audio 
                                            controls 
                                            className="w-full"
                                            src={`${BASE_URL}/audio?name=${encodeURIComponent(file.filename)}`}
                                        >
                                            Votre navigateur ne supporte pas l'élément audio.
                                        </audio>
                                        
                                        {/* Bouton de téléchargement avec stopPropagation */}
                                        <button 
                                            className="p-2 bg-indigo-100 dark:bg-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-700 rounded-full transition-colors flex-shrink-0"
                                            title="Télécharger l'audio"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`${BASE_URL}/audio?name=${encodeURIComponent(file.filename)}`, '_blank');
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Bouton toggle - séparé du lecteur audio */}
                                <div 
                                    className="flex justify-center cursor-pointer py-1 px-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                    onClick={() => toggleExpand(file.filename)}
                                >
                                    <button className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                                        <span>{expandedFiles[file.filename] ? 'Masquer l\'analyse' : 'Voir l\'analyse'}</span>
                                        <svg 
                                            xmlns="http://www.w3.org/2000/svg" 
                                            className={`h-5 w-5 ml-1 transition-transform duration-300 ${expandedFiles[file.filename] ? 'rotate-180' : ''}`} 
                                            viewBox="0 0 20 20" 
                                            fill="currentColor"
                                        >
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Résultats en dessous (visible seulement si étendu) */}
                            {expandedFiles[file.filename] && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/30 border-t border-indigo-100 dark:border-indigo-800/50 p-4">
                                    {/* Indicateur de chargement */}
                                    {(loadingFiles[file.filename] || (!file.loaded && !file.results)) && (
                                        <div className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                                        </div>
                                    )}
                                    
                                    {/* Affichage des résultats */}
                                    {file.results && (
                                        <div className="text-sm">
                                            {/* Résultat AI */}
                                            <div className="mb-4">
                                                <div className="text-indigo-700 dark:text-indigo-300 font-medium mb-1 flex items-center">
                                                    <span role="img" aria-label="star" className="mr-1">✨</span> 
                                                    Note globale
                                                </div>
                                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                                                    {file.results.ai_response?.note || "--"}/10
                                                </div>
                                                <p className="text-gray-700 dark:text-gray-300">
                                                    {file.results.ai_response?.feedback || "Aucun retour disponible"}
                                                </p>
                                            </div>
                                            
                                            {/* Métriques audio */}
                                            {file.results.analyse_result && (
                                                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800/30">
                                                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                        <div className="text-xs text-gray-600 dark:text-gray-400">Hauteur</div>
                                                        <div className="font-bold text-indigo-700 dark:text-indigo-300">
                                                            {file.results.analyse_result.pitch_mean?.toFixed(2) || "--"} Hz
                                                        </div>
                                                    </div>
                                                    <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                                        <div className="text-xs text-gray-600 dark:text-gray-400">Rythme</div>
                                                        <div className="font-bold text-indigo-700 dark:text-indigo-300">
                                                            {file.results.analyse_result.tempo?.[0]?.toFixed(0) || "--"} BPM
                                                        </div>
                                                    </div>
                                                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                        <div className="text-xs text-gray-600 dark:text-gray-400">Précision</div>
                                                        <div className="font-bold text-indigo-700 dark:text-indigo-300">
                                                            {file.results.analyse_result.rhythm_score ? 
                                                                `${(file.results.analyse_result.rhythm_score * 100).toFixed(0)}%` : "--"}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Gestion d'erreur */}
                                    {file.loaded && !file.results && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-center">
                                            Impossible de charger les résultats pour ce fichier
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
