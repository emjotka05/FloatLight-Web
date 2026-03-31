require('dotenv').config() //for env

const stripeKey = process.env.STRIPE_SECRET_KEY
const webhookKey = process.env.WEBHOOK_SECRET_KEY
const priceID = process.env.FLOAT_LIGHT_PRICE_ID

const express = require('express') //server
const cors = require('cors') //cross-origin-reasource-sharing
const { sendMailFunc } = require('./mailer.js')
const stripe = require('stripe')(stripeKey)

const app = express() //uruchamiamy silnik serwera

app.use(cors())

//robimy webhooka przed epress.json(),
// bo chcemy dostac oryginal nie przetlumaczony na jsona,
// poniewaz to bedzie sygnatura od stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const payload = req.body
    const signature = req.headers['stripe-signature']

    let event

    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookKey)
        if (event.type === 'checkout.session.completed') {
            let session = event.data.object
            console.log(session)
            let customerEmail = session.customer_details.email
            let customerName = session.customer_details.name

            sendMailFunc(customerName, customerEmail)
        }
        res.status(200).send()

    } catch (error) {
        res.status(400).send(`Error message: ${error.message}`)
    }
})

app.use(express.json())
app.use(express.static('public')) //potrzebujemy aby widziec pliki html,css....

//tutaj tworzymy sesje checkoutu i wysylamy link url tej sesji do frontendu
app.post('/checkout-session', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price: `${priceID}`,
                quantity: 1,
            },
        ],
        shipping_address_collection: {
            allowed_countries: ['PL']
        },
        mode: 'payment',
        success_url: `http://localhost:3000/success.html`,
        cancel_url: `http://localhost:3000/cancel.html`,
        automatic_tax: { enabled: true },
    })
    res.json({ url: session.url })
})

app.get('/test', (req, res) => {
    res.json({ message: "FloatLight server is ready!" })
})

app.listen(3000, () => {
    console.log("Server works on: http://localhost:3000")
})