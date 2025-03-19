// Fonction pour générer la requête MongoDB via LLaMA
const axios = require("axios");
const { ObjectId } = require("mongodb")
const generateMongoQuery = async (userQuery) => {
    try {
        if (!userQuery || typeof userQuery !== "string") {
            throw new Error("La requête utilisateur est invalide.");
        }

        console.log(" Envoi de la requête à LLaMA...");

        const response = await axios.post(process.env.OLLAMA_API_URL, {
            model: process.env.OLLAMA_MODEL,
            stream: false,
            prompt: `
Tu es un expert en bases de données et NLP. Analyse la requête utilisateur et génère une requête MongoDB au format JSON.
N'inclus que du JSON, sans texte explicatif.

### Exemples :
- "Trouve-moi l'article avec la référence ABC123"
  → { "filter": { "reference": "ABC123" } }
  
- "Quels sont les articles dont la désignation contient 'Samsung' ?"
  → { "filter": { "designation": { "$regex": "Samsung", "$options": "i" } } }
  
- "Affiche les articles entre 300€ et 800€"
  → { "filter": { "prix": { "$gte": 300, "$lte": 800 } } }
  
- "Liste les articles avec un stock entre 5 et 50 unités"
  → { "filter": { "qtestock": { "$gte": 5, "$lte": 50 } } }
  
- "Quels sont les 5 articles les plus populaires ?"
  → { "sort": { "ventes": -1 }, "limit": 5 }

- "Montre-moi les articles triés du moins cher au plus cher"
  → { "sort": { "prix": 1 } }

- "Quels sont les articles avec scategorieID: 6393390123558fd3b55b5acc ?"
  → { "filter": { "scategorieID": "6393390123558fd3b55b5acc" } }

### Requête :
"${userQuery}"
            `,
            max_tokens: 150,
        });

        console.log(" Réponse brute de LLaMA:", response.data);

        const queryIntent = response.data.response?.trim();
        if (!queryIntent) {
            throw new Error("Réponse invalide de LLaMA.");
        }

        console.log(" Interprétation LLaMA:", queryIntent);

        let parsedQuery;
        try {
            parsedQuery = JSON.parse(queryIntent);
        } catch (jsonError) {
            console.error(" Erreur de parsing JSON:", jsonError);
            return { filter: {} };
        }

        //  Fonction de correction avancée
        function correctMongoQuery(query) {
            if (!query.filter) return query;
        
            // Supprimer la vérification inutile de `categorieID`
            if (query.filter.$and && Array.isArray(query.filter.$and)) {
                query.filter.$and = query.filter.$and.filter(condition => {
                    if (typeof condition !== "object" || Object.keys(condition).length === 0) {
                        return false; // Supprime les objets vides
                    }
        
                    for (let key in condition) {
                        if (key === "categorieID") {
                            delete condition[key]; // Supprime `categorieID`
                        }
                    }
                    return Object.keys(condition).length > 0;
                });
        
                // Si après nettoyage, $and est vide, on le supprime
                if (query.filter.$and.length === 0) {
                    delete query.filter.$and;
                }
            }
        
            // Correction spécifique pour `scategorieID`
            if (query.filter.scategorieID) {
                let id = query.filter.scategorieID;
                if (typeof id !== "string") {
                    console.log(" Correction `scategorieID` non valide :", id);
                    delete query.filter.scategorieID; // Supprime l'ID incorrect
                } else if (id.match(/^[0-9a-fA-F]{24}$/)) {
                    query.filter.scategorieID = new ObjectId(id); // Convertit en `ObjectId`
                }
            }
        
            return query;
        }
        const correctedQuery = correctMongoQuery(parsedQuery);
        console.log(" Requête corrigée :", JSON.stringify(correctedQuery, null, 2));
        return correctedQuery;

    } catch (error) {
        console.error(" Erreur lors de la génération de la requête:", error.message);
        return { filter: {} };
    }
};
module.exports = {generateMongoQuery};
