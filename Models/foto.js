const mongoose=require('mongoose')
const Foto= mongoose.model('Foto',{
    name:String,

})
module.exports=Foto
