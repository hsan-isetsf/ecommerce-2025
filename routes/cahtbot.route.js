const express = require('express');
const axios = require('axios'); // 🔥 Import d'Axios
const Message = require('../models/message');
const Article=require("../models/article")
const router = express.Router();
const mongoose = require('mongoose');


router.use(express.json());

//  Route pour envoyer une question à Ollama
router.post("/ask", async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: " Question requise" });

          //Envoi de la requête à Ollama avec axios
        const { data } = await axios.post(process.env.OLLAMA_API_URL, {
            model: process.env.OLLAMA_MODEL,
            prompt: question,
            stream: false // On veut une réponse complète
        }, {
            headers: { "Content-Type": "application/json" }
        });

        if (!data || !data.response) throw new Error("Réponse invalide d'Ollama");

        const responseText = data.response;
        console.log(`Réponse Ollama: ${responseText}`);

        // Sauvegarde dans MongoDB
        const newMessage = new Message({ text: question, response: responseText });
        await newMessage.save();

        res.json({ question, response: responseText });
    } catch (error) {
        console.error("Erreur:", error.message);
        res.status(500).json({ error: "Erreur interne", details: error.message });
    }
});

// API pour récupérer les messages stockés
router.get("/messages", async (req, res) => {
    try {
        const messages = await Message.find();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: "Erreur de récupération", details: error.message });
    }
});
router.post("/query-article", async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: "❌ Question requise" });

        console.log(`Requête reçue: ${question}`);

        //  Envoi à Ollama pour extraire les informations (ex: code article, nom...)
        const { data } = await axios.post(process.env.OLLAMA_API_URL, {
            model: process.env.OLLAMA_MODEL,
            prompt: `Analyse cette question et extrait les informations utiles sous format JSON:
            Question: "${question}"
             Réponds uniquement avec un JSON, sans texte en dehors. Exemples valides :
            {"reference": "12345", "designation": "iPhone 14"}
            {"reference": "MacBook Pro", "designation": "Ordinateurs"}
            ---
            NE RAJOUTE AUCUN TEXTE, RÉPONDS SEULEMENT AVEC LE JSON.`,
            stream: false
        }, { headers: { "Content-Type": "application/json" } });

        //  Vérification de la réponse d'Ollama
        if (!data || !data.response) throw new Error("Réponse invalide de Ollama");

        //  Extraction des informations depuis la réponse d'Ollama
        const extractedInfo = JSON.parse(data.response);
        console.log(` Infos extraites:`, extractedInfo);

        // Construction de la requête MongoDB dynamiquement
        let searchQuery = {};
        if (extractedInfo.reference) searchQuery.reference = extractedInfo.reference;
        if (extractedInfo.designation) searchQuery.designation = new RegExp(extractedInfo.designation, "i"); // Recherche insensible à la casse
        if (extractedInfo.scategorieID) searchQuery.scategorieID = extractedInfo.scategorieID;

        console.log(` Requête MongoDB:`, searchQuery);

        // Requête dans la collection "articles"
        const articles = await Article.find(searchQuery);

        //  Vérification si aucun article trouvé
        if (articles.length === 0) return res.json({ response: "Aucun article correspondant trouvé." });

        //  Formatage de la réponse
        const formattedResponse = articles.map(a => ` ${a.designation} - ${a.prix}€ (reference: ${a.reference})`).join("\n");

        res.json({ question, response: formattedResponse });
    } catch (error) {
        console.error("Erreur:", error.message);
        res.status(500).json({ error: "Erreur interne", details: error.message });
    }
});


async function generateMongoQuery(userQuery) {
    try {
        if (!userQuery || typeof userQuery !== "string") {
            throw new Error("La requête utilisateur est invalide.");
        }

        const llamaResponse = await axios.post(process.env.OLLAMA_API_URL, {
            model: process.env.OLLAMA_MODEL,
            stream: false, // On veut une réponse complète
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

- "Quels sont les articles de la catégorie Informatique ?"
  → { "categorie": "Informatique" }

### Requête :
"${userQuery}"
            `,
            max_tokens: 150,
        });

        if (!llamaResponse.data || !llamaResponse.data.text) {
            throw new Error("Réponse invalide de LLaMA.");
        }

        const queryIntent = llamaResponse.data.text.trim();
        console.log("🎯 Interprétation LLaMA:", queryIntent);

        // Vérification de JSON valide
        try {
            return JSON.parse(queryIntent);
        } catch (jsonError) {
            console.error("❌ Erreur de parsing JSON:", jsonError);
            return { filter: {} };
        }
    } catch (error) {
        console.error("❌ Erreur lors de la génération de la requête:", error);
        return { filter: {} }; // Requête vide en cas d'erreur
    }
}// ✅ Route de requête dynamique avec LLaMA 3
router.post("/query", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Aucune requête fournie." });

        console.log("📝 Requête reçue:", text);

        // 🔥 Générer la requête MongoDB via LLaMA 3
        const mongoQuery = await generateMongoQuery(text);

        // Extraction des paramètres
        const query = mongoQuery.filter || {};
        const sort = mongoQuery.sort || {};
        const limit = mongoQuery.limit ? parseInt(mongoQuery.limit) : 10;
        const skip = mongoQuery.skip ? parseInt(mongoQuery.skip) : 0;

        // ✅ Attendre la connexion avant d’accéder à la collection
        await mongoose.connection.asPromise();

        const collection = mongoose.connection.db.collection("articles");
        let result;

        // Vérifie si la requête concerne une catégorie et applique un $lookup si nécessaire
        if (mongoQuery.categorie) {
            result = await collection.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "categorieID",
                        foreignField: "_id",
                        as: "categorie_details"
                    }
                },
                {
                    $match: { "categorie_details.name": mongoQuery.categorie }
                },
                {
                    $project: {
                        reference: 1,
                        designation: 1,
                        prix: 1,
                        qtestock: 1,
                        ventes: 1,
                        "categorie_details.name": 1
                    }
                },
                { $sort: sort },
                { $skip: skip },
                { $limit: limit }
            ]).toArray();
        } else {
            result = await collection.find(query).sort(sort).skip(skip).limit(limit).toArray();
        }

        res.json({ result });
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});
    
module.exports = router;
