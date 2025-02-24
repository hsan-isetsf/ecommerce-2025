
const mongoose =require("mongoose")
const MessageSchema = new mongoose.Schema({ 
    text: String, 
    response: String 
});
module.exports= mongoose.model("Message", MessageSchema);
