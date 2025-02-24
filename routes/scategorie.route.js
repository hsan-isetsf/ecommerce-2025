const express = require('express'); 
const router = express.Router(); 
const SCategorie=require("../models/scategorie") 
// afficher la liste des s/categories. 
router.get('/', async (req, res, )=> { 
try { 
const scat = await SCategorie.find({}, null, {sort: {'_id': -1}}).populate("categorieID")
res.status(200).json(scat); 
} catch (error) { 
res.status(404).json({ message: error.message }); 
} 
}); 

router.post('/', async (req, res) =>  { 
   
    const newSCategorie = new SCategorie(req.body) 
    try { 
    await newSCategorie.save(); 
    res.status(200).json(newSCategorie ); 
    } catch (error) { 
    res.status(404).json({ message: error.message }); 
    } 
    });

    // modifier une s/catégorie 
router.put('/:scategorieId', async (req, res)=> { 
    try { 
    const scat1 = await SCategorie.findByIdAndUpdate( 
    req.params.scategorieId, 
    { $set: req.body }, 
    { new: true } 
    ); 
    res.status(200).json(scat1); 
    } catch (error) { 
    res.status(404).json({ message: error.message }); 
    } 
    });
    // Supprimer une s/catégorie 
router.delete('/:scategorieId', async (req, res)=> { 
    const  id  = req.params.scategorieId; 
    await SCategorie.findByIdAndDelete(id); 
    res.json({ message: "sous categorie deleted successfully." }); 
    });
module.exports=router