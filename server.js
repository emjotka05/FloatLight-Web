require('dotenv').config()
const express = require('express')
const cors = require('cors')

const stripeKey = process.env.STRIPE_SECRET_KEY
const priceID = process.env.FLOAT_LIGHT_PRICE_ID
const stripe = require('stripe')(stripeKey)

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static('public'))

app.post('/checkout-session', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price : `${priceID}`,
                quantity : 1,
            },
        ],
        shipping_address_collection: {
            allowed_countries: ['PL']
        },
        mode: 'payment',
        success_url: `http://localhost:3000/index.html`,
        cancel_url: `http://localhost:3000/store.html`,
        automatic_tax: {enabled: true},
    })
    res.json({ url: session.url })
})

app.get('/test', (req, res) => {
    res.json({ message: "FloatLight server is ready!" })
})

app.listen(3000, () => {
    console.log("Server works on: http://localhost:3000")
})