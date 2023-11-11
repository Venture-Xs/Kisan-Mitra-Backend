import dotenv from 'dotenv'
import express from 'express'

dotenv.config();
const app = express()

app.use(express.json());

app.get('/', async (req, res) => {
    res.send("Kisan Mitra Backend")
})

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})

