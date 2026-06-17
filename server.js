// ============================================================
// Avaliacao Final - API REST de Catalogo de Filmes e Series
// ============================================================
//
// Implementa este servidor do zero usando:
//
// - express
// - dotenv
// - mysql2/promise
//
// A base de dados, a tabela e os dados iniciais devem ser criados
// no MySQL Workbench com o ficheiro database.sql.
//
// Rotas obrigatorias:
//
// GET    /api/estado
// GET    /api/filmes
// GET    /api/filmes/:id
// POST   /api/filmes
// PUT    /api/filmes/:id
// PATCH  /api/filmes/:id/visto
// DELETE /api/filmes/:id
//
// Testa tudo no Postman, Thunder Client ou Bruno.

require("dotenv").config()
const express = require("express")
const app = express()
const mysql = require("mysql2/promise")
const PORT = 3000

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

app.use(express.json())

// MIDDLEWARE que vai buscar o log da hora em que houve alterações no servidor
app.use((req, res, next) => {
  const hora = new Date().toLocaleTimeString("pt-PT")
  console.log(`[${hora}] ${req.method} ${req.url}`)
  next()
})  

// VALIDAÇÕES DENTRO DO SERVIDOR DE TODOS OS DADOS DO BODY
function validarFilmes(req, res, next) {
  const generosValidos = ["ficcao", "acao", "drama", "animacao", "comedia", "documentario", "terror", "outro"]
  const tiposValidos = ["filme", "serie"]
  const { titulo, realizador, genero, ano, tipo, avaliacao, visto } = req.body


  if (titulo === undefined || realizador === undefined || genero === undefined || ano === undefined || tipo === undefined) {
    return res.status(400).json({ erro: "Preencher campos obrigatórios: titulo, realizador, genero, ano, tipo" })
  }

  const tituloLimpo = String(titulo).trim()
  const realizadorLimpo = String(realizador).trim()
  const anoNumero = Number(ano)
  const generoLimpo = String(genero).trim().toLowerCase()
  const anoAtual = new Date().getFullYear()
  const tipoLimpo = String(tipo).trim()

  if (tituloLimpo.length < 2) {
    return res.status(400).json({ erro: "Título obrigatório (mais que 2 caracteres)" })
  }
  if (realizadorLimpo.length === 0) {
    return res.status(400).json({ erro: "realizador obrigatório" })
  }
  if (isNaN(anoNumero) || anoNumero < 1900 || anoNumero > anoAtual) {
    return res.status(400).json({ erro: `Ano inválido (entre 1900 e ${anoAtual})` })
  }
  if (!generosValidos.includes(generoLimpo)) {
    return res.status(400).json({ erro: "Genero inválido" })
  }
  if (!tiposValidos.includes(tipoLimpo)) {
    return res.status(400).json({ erro: "Tipo inválido" })
  }

  // Tratamento da avaliação opcional (valida apenas se for enviada)
  let avaliacaoTratada = null
  if (avaliacao !== undefined && avaliacao !== null && avaliacao !== "") {
    const numAvaliacao = Number(avaliacao)
    if (isNaN(numAvaliacao) || numAvaliacao < 1 || numAvaliacao > 5) {
      return res.status(400).json({ erro: "A avaliação deve ser um número entre 1 e 5" })
    }
    avaliacaoTratada = numAvaliacao
  }

  const vistoTratado = visto === true || visto === 1 || visto === "true"

  
  req.body = {
    titulo: tituloLimpo,
    realizador: realizadorLimpo,
    ano: anoNumero,
    genero: generoLimpo,
    tipo: tipoLimpo,
    avaliacao: avaliacaoTratada,
    visto: vistoTratado ? 1 : 0 
  }
  next()
}

// GET | /api | API ativa
app.get("/api", async (req, res, next) => {
  try {
    const mensagem = { mensagem: "API ativa" }
    res.json(mensagem)
  } catch (erro) {
    next(erro)
  }
})

// GET | /api/estado | Estado do servidor e da Base de Dados
app.get("/api/estado", async (req, res, next) => {
  try {
    // Testa a ligação com o MySQL
    await pool.execute("SELECT 1")
    
    res.status(200).json({
      status: "online",
      database: "ligado",
      timestamp: new Date().toISOString()
    })
  } catch (erro) {
    // Se a base de dados falhar, avisa no estado da resposta
    res.status(500).json({
      status: "online",
      database: "desligado",
      erro: "Não foi possível ligar à base de dados"
    })
  }
})

// GET | /api/filmes | Listar todos os filmes
app.get("/api/filmes", async (req, res, next) => {
  try {
    const query = "SELECT * FROM filmes"
    const [filmes] = await pool.execute(query)
    res.status(200).json(filmes)
  } catch (erro) {
    next(erro)
  }
})

// GET | /api/filmes/:id | Obter filme por ID
app.get("/api/filmes/:id", async (req, res, next) => {
  const id = Number(req.params.id)
  try {
    const query = "SELECT * FROM filmes WHERE id = ?"
    const [filmes] = await pool.execute(query, [id])
    if (filmes.length === 0) {
      return res.status(404).json({ mensagem: "Este filme não existe!" })
    }
    res.status(200).json(filmes[0])
  } catch (erro) {
    next(erro)
  }
})

// POST | /api/filmes | Adicionar novo filme
app.post("/api/filmes", validarFilmes, async (req, res, next) => {
  // CORREÇÃO: Incluídos os campos "tipo" e "avaliacao" no INSERT
  const { titulo, realizador, ano, genero, tipo, avaliacao, visto } = req.body
  try {
    const query = "INSERT INTO filmes (titulo, realizador, ano, genero, tipo, avaliacao, visto) VALUES (?, ?, ?, ?, ?, ?, ?)"
    await pool.execute(query, [titulo, realizador, ano, genero, tipo, avaliacao, visto])
    res.status(201).json({ mensagem: "Filme criado com sucesso!" })
  } catch (erro) {
    next(erro)
  }
})

// PUT | /api/filmes/:id | Atualizar filmes
app.put("/api/filmes/:id", validarFilmes, async (req, res, next) => {
  const id = Number(req.params.id)
  try {
    const query = "SELECT * FROM filmes WHERE id = ?"
    const [filmes] = await pool.execute(query, [id])
    if (filmes.length === 0) {
      return res.status(404).json({ mensagem: "Este filme não existe!" })
    }

    // CORREÇÃO: Incluídos os campos "tipo" e "avaliacao" no UPDATE
    const { titulo, realizador, ano, genero, tipo, avaliacao, visto } = req.body
    const query2 = "UPDATE filmes SET titulo = ?, realizador = ?, ano = ?, genero = ?, tipo = ?, avaliacao = ?, visto = ? WHERE id = ?"
    await pool.execute(query2, [titulo, realizador, ano, genero, tipo, avaliacao, visto, id])

    res.status(200).json({ mensagem: "Filme alterado com sucesso" })
  } catch (erro) {
    next(erro)
  }
})

// PATCH | /api/filmes/:id/visto | Alterar visto
app.patch("/api/filmes/:id/visto", async (req, res, next) => {
  const id = Number(req.params.id)
  try {
    const query = "SELECT * FROM filmes WHERE id = ?"
    const [filmes] = await pool.execute(query, [id])
    
    if (filmes.length === 0) {
      return res.status(404).json({ mensagem: "Filme não existe!" })
    }

    const novoValor = SampleCheckVisto(filmes[0].visto)
    const query2 = "UPDATE filmes SET visto = ? WHERE id = ?"
    await pool.execute(query2, [novoValor, id])
   
    res.status(200).json({ mensagem: `Visto alterado com sucesso` })
  } catch (erro) {
    next(erro)
  }
})

function SampleCheckVisto(valorAtual) {
  return valorAtual ? 0 : 1;
}

// DELETE | /api/filmes/:id | Apagar filme
app.delete("/api/filmes/:id", async (req, res, next) => {
  const id = Number(req.params.id)
  try {
    const query = "SELECT * FROM filmes WHERE id = ?"
    const [filmes] = await pool.execute(query, [id])
    if (filmes.length === 0) {
      return res.status(404).json({ erro: "filme não encontrado" })
    }

    const query2 = "DELETE FROM filmes WHERE id = ?"
    await pool.execute(query2, [id])
    res.status(200).json({ mensagem: "filme eliminado com sucesso!" })
  } catch (erro) {
    next(erro)
  }
})

// ROTA 404 (Not Found)
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada!", rota: req.url })
})

// ERROR HANDLER GLOBAL
app.use((erro, req, res, next) => {
  console.error("Erro capturado:", erro.message || erro)
  res.status(500).json({ erro: "Erro no servidor!" })
})

// Inicialização do Servidor
app.listen(PORT, async () => {
  console.log(`O servidor está a rolar na porta ${PORT}`)
  try {
    await pool.execute("SELECT 1")
    console.log("Ligado à base de dados com sucesso")
  } catch (error) {
    console.log("Erro ao ligar à base de dados:", error)
  }
})
