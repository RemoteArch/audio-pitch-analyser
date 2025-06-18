
// Fonction pour afficher le dashboard des audios analysés
const fetchAnalyzedAudios = async () => {
    try {
        const response = await fetch(`${BASE_URL}/all-analyse`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des fichiers analysés');
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur:', error);
        return [];
    }
};

function Dashboard() {
    const [analyzedFiles, setAnalyzedFiles] = React.useState([]);
    
    React.useEffect(() => {
        const loadFiles = async () => {
            const files = await fetchAnalyzedAudios();
            setAnalyzedFiles(files);
        };
        loadFiles();
    }, []);
    
    return (
        <div className="mt-12 container mx-auto px-4 py-8 max-w-6xl">
            <h2 className="text-3xl font-bold mb-6 text-indigo-600">Historique des analyses</h2>
            {analyzedFiles.length === 0 ? (
                <p className="text-gray-500 text-center">Aucun fichier audio analysé</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {analyzedFiles.map((file, index) => (
                        <div key={index} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                            <h3 className="font-semibold text-lg text-indigo-800 mb-2">{file}</h3>
                            <p className="text-gray-600 mb-4">Analysé le: {new Date(file.timestamp).toLocaleString()}</p>
                            <div className="text-3xl font-bold text-indigo-600 mb-2">{file.score}/10</div>
                            <button 
                                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                onClick={() => window.location.href = `${BASE_URL}/results/${file.result_file}`}
                            >
                                Voir les détails
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

