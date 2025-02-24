const express = require('express');
const axios = require('axios'); // 🔥 Import d'Axios
const Message = require('../models/message');
const Article=require("../models/article")
const router = express.Router();
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

module.exports = router;
