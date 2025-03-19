const express=require('express')
const mongoose=require('mongoose')
const dotenv=require("dotenv")
const cors=require("cors")
const app=express()
const CategorieRouter=require("./routes/categorie.route")
const ScategorieRouter=require("./routes/scategorie.route")
const chatbotRouter=require("./routes/cahtbot.route")
const articleRouter =require("./routes/article.route")
const UserRouter=require("./routes/user.route")
const chatbotRequeteRouter = require("./routes/chatbot-requetes.route");
const paymentRouter = require("./routes/payment.route");
const path = require('path');
app.use(express.json())
app.use(cors())
dotenv.config()

//connexion a la base de données

mongoose.connect(process.env.DATABASECLOUD)
.then(()=>{console.log("connexion a la base de données réussie")})
.catch((error)=>{console.log("Impossible de se connecter à la base de données",error)
process.exit()
})

app.use("/api/categories",CategorieRouter)
app.use("/api/scategories",ScategorieRouter)
app.use("/api/chat",chatbotRouter)
app.use('/api/articles', articleRouter);
app.use("/api/users",UserRouter)
app.use('/api/chatbot', chatbotRequeteRouter);
app.use('/api/payment', paymentRouter);
//dist reactjs
app.use(express.static(path.join(__dirname, './client/build'))); 
app.get('*', (req, res) => { res.sendFile(path.join(__dirname,
'./client/build/index.html')); });
app.listen(process.env.PORT,function(){
console.log(`serveur is listen on port ${process.env.PORT}`)
})
module.exports = app;