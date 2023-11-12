import dotenv from 'dotenv'
dotenv.config();
import express from 'express'

import { Farmerbot, Financebot, getCredit } from './controllers/controller.mjs';
import { verifyToken } from './middleware/middleware.mjs';
const app = express()

const loanApplicants = []

app.use(express.json());
// app.use(verifyToken)
app.get('/farmer/:prompt', Farmerbot)
app.get('/finance/:bankName/:prompt', Financebot)
app.get('/credit', getCredit);

app.post('/applyLoan', (req, res) => {
    const name = req.body.name;
    const loanAmount = req.body.loanAmount;
    const location = req.body.location;
    const crop = req.body.crop;
    const risk = req.body.risk;
    loanApplicants.push({ name, loanAmount, risk, location, crop });
})

app.get('/getLoans', (req, res) => {
    res.send(loanApplicants)
})







app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})

