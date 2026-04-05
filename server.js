require('dotenv').config() //for env

const stripeKey = process.env.STRIPE_SECRET_KEY
const webhookKey = process.env.WEBHOOK_SECRET_KEY
const priceID = process.env.FLOAT_LIGHT_PRICE_ID
const db_user = process.env.DB_USER 
const db_password = process.env.DB_PASSWORD
const db_host = process.env.DB_HOST
const db_port = process.env.DB_PORT
const db_name = process.env.DB_NAME

const express = require('express') //server
const cors = require('cors') //cross-origin-reasource-sharing

const { sendMailFunc } = require('./mailer.js')
const stripe = require('stripe')(stripeKey)

const { Pool } = require('pg')
const pool = new Pool({
    user: db_user,
    host: db_host,
    database: db_name,
    password: db_password,
    port: db_port
})

const app = express() //uruchamiamy silnik serwera

pool.query('SELECT NOW()', (err, res) => {
    if(err){console.log(err.message)}else{console.log("PostgreSQL database connected.")}
})

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
            let sessionId = session.id
            let customerEmail = session.customer_details.email
            let customerName = session.customer_details.name
            const lineItems = await stripe.checkout.sessions.listLineItems(sessionId)
            let productQuantity = lineItems.data[0].quantity
            const customerNameSplit = customerName.split(' ')
            const queryAddCustomer = 'insert into Customers (first_name, last_name, email) values ($1, $2, $3) returning customer_id'
            const valuesCustomer = [customerNameSplit[0], customerNameSplit[1], customerEmail]
            const resultCustomer = await pool.query(queryAddCustomer, valuesCustomer)
            const queryAddOrder = 'insert into Orders (customer_id, product_id, quantity, status, session_id) values ($1, $2, $3, $4, $5) returning order_id'
            const valuesOrder = [resultCustomer.rows[0].customer_id, 1, productQuantity, 'paid',sessionId]
            const resultOrder = await pool.query(queryAddOrder, valuesOrder)
            sendMailFunc(customerName, customerEmail)

            //TODO clean server.js and add database.js
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
                price: priceID,
                quantity: 1,
                adjustable_quantity: { 
                    enabled: true,
                    minimum: 1,
                    maximum: 99,
                },
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