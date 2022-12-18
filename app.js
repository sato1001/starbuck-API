require('dotenv').config()
const express = require('express')
const mongoose=require('mongoose')
const bcrypt = require('bcrypt')
const jwt=require('jsonwebtoken')
const cors=require('cors')
const fileUpload = require("express-fileupload");
const path = require("path");

const filesPayloadExists = require('./Models/filesPayloadExists');
const fileExtLimiter = require('./Models/fileExtLimiter');
const fileSizeLimiter = require('./Models/fileSizeLimiter');
const app=express()

// dotenv.config();
//Conectar ao Banco de Dados
//mongoose.connect(process.env.DB_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true },() => 
//    console.log('Conectado ao Banco de Dados!')
//);

app.use(express.json())
app.use(cors())

const verifyJWT = (req, res, next) => {
  const auth = req.headers.authorization;

  if(!auth) return res.status(401).json({ message: 'Token é obrigatório' });

  const [, token] = auth.split(' ');
  
  jwt.verify(token, process.env.SECRET, function(err, decoded) {
    if (err) return res.status(400).json({ message: 'Token inválido' });
    // se tudo estiver ok, salva no request para uso posterior
    req.userId = decoded.id;
    next();
  });
}

const User=require('./Models/users')
const foto=require('./Models/foto')
const Foto = require('./Models/foto')

app.use('/files', express.static('files'));

app.get('/', (req, res)=>{
    res.status(200).json({msg:"Bem vindo!"})
})
//Private Route
app.get("/user/:id",checkToken, async(req,res)=>{
    const id = req.params.id
    const user=await User.findById(id,'-password')
    if(!user){
        return res.status(404).json({msg:'Usuario não localizado'})
    }
    res.status(200).json({user})
})

function checkToken(req,res,next){
    const authHeader = req.headers['authorization']
    const token=authHeader&&authHeader.split(" ")[1]
    if(!token){
        return res.status(401).json({msg:'Acesso negado!'})
    }
    try{
        const secret = process.env.SECRET
        jwt.verify(token,secret)
        next()
    }catch(error){
        res.status(400).json({msg: "Token invalido"})
    }
}

//Create User
app.post('/auth/register', async(req,res)=>{
    const{name,email,password,confirmpassword}=req.body;
    if(!name){
        return res.status(422).json({msg:'O nome é obrigatorio'})
    }if(!email){
        return res.status(422).json({msg:'O email é obrigatorio'})
    }if(!password){
        return res.status(422).json({msg:'Senha é obrigatoria'})
    }if(password!=confirmpassword){
        return res.status(422).json({msg:'Senhas diferentes'})
    }
    const userExists = await User.findOne({email:email})
    if(userExists){
        return res.status(422).json({msg:'Usuario ja existente'})
    }
    const salt=await bcrypt.genSalt(12)
    const passwordHash=await bcrypt.hash(password,salt)
    const user= new User({
        name,
        email,
        password:passwordHash,
        admin:false
    })
    
    try{
        await user.save()
        res.status(201).json({msg:'Usuario criado com sucesso!'})
    }catch(error){
        console.log(error)
        res
           .status(500)
           .json({
               msg:'Erro com o servidor tente mais tarde'
            })
    }
})

//Login
app.post("/auth/login", async(req,res)=>{
    const {email,password}=req.body
    //validações
    if(!email){
        return res.status(422).json({msg:'O email é obrigatório'})
    }if(!password){
        return res.status(422).json({msg:'Senha é obrigatória'})
    }
    const user = await User.findOne({email:email})
    if(!user){
        return res.status(422).json({msg:'Usuario não encontrado'})
    }
    const checkPassword=await bcrypt.compare(password, user.password)
    if(!checkPassword){
        return res.status(422).json({msg:'Senha invalida'})
    }
    try{
        const admin=user.admin||false
        const secret=process.env.SECRET
        const token=jwt.sign({
            id:user._id,
        },
            secret,
        )
        res.status(200).json({msg:'Autenticado com sucesso',token,admin})
    }catch(err){
        console.log(error)
        res
           .status(500)
           .json({
               msg:'Erro com o servidor tente mais tarde'
       })
    }
})

//Upload
app.get("/fotos", async(req,res)=>{
    const URL=process.env.URL;
    const fotos= await Foto.find();
    
    const response=fotos.map((foto)=>{
        foto=foto.toObject();
        foto.url=URL+"/files/"+foto.name;
        
        return foto;
    })
    return res.json(response);

})
app.post('/upload',checkToken,fileUpload({ createParentPath: true }),
filesPayloadExists,
fileExtLimiter(['.png', '.jpg', '.jpeg']),
fileSizeLimiter, async(req,res)=>{
    const files = req.files
        console.log(files)
        
        Object.keys(files).forEach(key => {
            const filepath = path.join(__dirname, 'files', files[key].name)
            files[key].mv(filepath, (err) => {
                if (err) return res.status(500).json({ status: "error", message: err })
            })
            const foto=new Foto({
                name:files[key].name,
            })
            foto.save();
        })
    return res.json({ status: 'success', message: Object.keys(files).toString() })
})

const dbUser=process.env.DB_USER
const dbPassword=process.env.DB_PASS

mongoose.connect(`mongodb+srv://${dbUser}:${dbPassword}@cluster0.ytjffvs.mongodb.net/?retryWrites=true&w=majority`)
.then(()=>{
    app.listen(3000)
    console.log(`conectou`)
}).catch((err)=>console.log(err))
