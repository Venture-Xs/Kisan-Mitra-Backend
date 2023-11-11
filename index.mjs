import dotenv from 'dotenv'
dotenv.config();
import express from 'express'

import { Farmerbot, Financebot } from './controllers/controller.mjs';
const app = express()

app.use(express.json());

app.get('/farmer/:prompt', Farmerbot)
app.get('/finance/:prompt', Financebot)

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})

