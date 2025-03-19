const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {Ollama} = require("@langchain/community/llms/ollama");

// Initialisation du modèle LLaMA via Ollama
const llama = new Ollama({
  model: "llama3",
  baseUrl: "http://localhost:11434"
}); 

// Fonction pour obtenir la liste des collections
async function getCollections() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map(col => col.name);
  } catch (error) {
    console.error("Erreur lors de la récupération des collections:", error);
    return [];
  }
}

// Fonction pour extraire le JSON d'une réponse texte
function extractJSON(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      throw new Error("Aucun JSON trouvé dans la réponse");
    }
    
    const jsonStr = text.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Erreur lors de l'extraction du JSON:", error);
    // La collection sera validée plus tard
    return {
      intent: "list",
      collection: "",
      query: {}
    };
  }
}

// Fonction pour détecter l'intention et générer la requête MongoDB
async function analyzeIntent(userQuestion) {
    const availableCollections = await getCollections();
    console.log("Collections disponibles:", availableCollections);
  
    const prompt = `
      Tu es un assistant qui analyse des questions en français et génère des requêtes MongoDB appropriées.
      Les collections disponibles dans la base de données sont: ${availableCollections.join(', ')}.
      
      Réponds UNIQUEMENT avec un objet JSON valide au format suivant:
      {
        "intent": "list|search|aggregate",
        "collection": "nom_de_la_collection",
        "query": {}
      }
      
      Pour les agrégations, utilise ce format:
      {
        "intent": "aggregate",
        "collection": "nom_de_la_collection",
        "query": [
          {"$sort": {"champ": -1}},
          {"$limit": 1}
        ]
      }
      
      Exemples de requêtes valides:
      1. Pour lister tous les éléments: {"query": {}}
      2. Pour chercher par nom: {"query": {"nom": {"$regex": "terme", "$options": "i"}}}
      3. Pour trouver le maximum: {"intent": "aggregate", "query": [{"$sort": {"champ": -1}}, {"$limit": 1}]}
      
      Important:
      - Choisis la collection appropriée parmi celles listées ci-dessus
      - La requête doit être une requête MongoDB valide
      - Pour les tris et maximums, utilise les agrégations
      
      Question: ${userQuestion}
    `;
  
    try {
      console.log("Envoi du prompt Llama...");
      const response = await llama.call(prompt);
      console.log("Réponse brute du modèle:", response);
      
      const analysis = extractJSON(response);
      console.log("Analyse extraite:", analysis);
      
      // Validation de la collection
      if (!analysis.collection || !availableCollections.includes(analysis.collection)) {
        console.warn(`Collection invalide ou non spécifiée: ${analysis.collection}`);
        if (availableCollections.length > 0) {
          analysis.collection = availableCollections[0];
          console.log(`Utilisation de la collection par défaut: ${analysis.collection}`);
        } else {
          throw new Error("Aucune collection disponible dans la base de données");
        }
      }
      
      return analysis;
    } catch (error) {
      console.error("Erreur lors de l'analyse de l'intention:", error);
      if (availableCollections.length === 0) {
        throw new Error("Aucune collection disponible dans la base de données");
      }
      return {
        intent: "list",
        collection: availableCollections[0],
        query: {}
      };
    }
  }
  
  // Fonction pour générer une réponse contextuelle
async function generateResponse(data, userQuestion) {
    const prompt = `
      Question de l'utilisateur: ${userQuestion}
      Données trouvées (${data.length} résultats): ${JSON.stringify(data)}
      
      Génère une réponse naturelle en français basée sur ces données.
      Si aucune donnée n'est trouvée, indique-le poliment.
      Si plusieurs éléments sont trouvés, fais-en un résumé clair.
      
      Important:
      - Réponds en français
      - Sois concis mais informatif
      - N'inclus pas de détails techniques sur la requête
      - Format: texte simple, pas de JSON
    `;
  
    try {
      console.log("Génération de la réponse...");
      const response = await llama.call(prompt);
      return response.trim();
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse:", error);
      return "Désolé, je n'ai pas pu générer une réponse appropriée. Veuillez réessayer.";
    }
  }
  
  // La route pour gérer les agrégations
  router.post('/chat', async (req, res) => {
    try {
      const userQuestion = req.body.question;
      
      if (!userQuestion) {
        return res.status(400).json({
          success: false,
          error: 'La question est requise'
        });
      }
  
      console.log("Question reçue:", userQuestion);
      
      // Analyse de l'intention
      const analysis = await analyzeIntent(userQuestion);
      console.log("Analyse finale:", analysis);
      
      // Exécution de la requête MongoDB
      let data;
      if (analysis.intent === 'aggregate') {
        data = await mongoose.connection.db
          .collection(analysis.collection)
          .aggregate(analysis.query)
          .toArray();
      } else {
        data = await mongoose.connection.db
          .collection(analysis.collection)
          .find(analysis.query)
          .toArray();
      }
      
      console.log(`${data.length} résultats trouvés dans la collection ${analysis.collection}`);
      
      // Génération de la réponse
      const response = await generateResponse(data, userQuestion);
  
      res.json({ 
        success: true, 
        response,
        debug: { 
          intent: analysis.intent,
          collection: analysis.collection,
          query: analysis.query,
          resultCount: data.length
        }
      });
  
    } catch (error) {
      console.error('Erreur:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Une erreur est survenue lors du traitement de votre demande.',
        details: error.message
      });
    }
  });

module.exports = router;
