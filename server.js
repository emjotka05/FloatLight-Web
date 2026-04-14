require('dotenv').config() //for env

const stripeKey = process.env.STRIPE_SECRET_KEY
const webhookKey = process.env.WEBHOOK_SECRET_KEY
const priceID = process.env.FLOAT_LIGHT_PRICE_ID

const rateLimit = require('express-rate-limit')

const express = require('express') //server
const cors = require('cors') //cross-origin-reasource-sharing

const { sendStatusEmail, sendMailAdminNotification } = require('./mailer.js')
const stripe = require('stripe')(stripeKey)

const { dbCreateOrderWithCustomer, dbCheckOrderExists, dbGetOrderStatus, dbCancelOrder, dbReturnOrder, dbConfirmReturn, dbMarkOrderDelivery,
    dbOrderDelivered, dbGetCustomerBySession } = require('./database.js')


const app = express() //uruchamiamy silnik serwera

const checkoutLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: "Too many request from this IP, try again in 5 minutes." }
})

app.use(cors())

//robimy webhooka przed express.json(),
// bo chcemy dostac oryginal nie przetlumaczony na jsona,
// poniewaz to bedzie sygnatura od stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const payload = req.body
    const signature = req.headers['stripe-signature']

    let event

    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookKey)
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            let orderAlreadyExists = await dbCheckOrderExists(session.id)
            if (orderAlreadyExists) {
                console.warn("Ignoring the order duplicate. Returning from webhook with sending response status 200")
                res.status(200).send()
                return
            }
            console.log(session)
            
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
            const customerData = {
                customerEmail: session.customer_details.email,
                customerName: session.customer_details.name,
                customerAdress: session.customer_details.address,
                customerPhone: session.customer_details.phone
            }
            const orderData = {
                sessionId: session.id,
                productQuantity: lineItems.data[0].quantity
            }

            //dodanie do bazy
            await dbCreateOrderWithCustomer(customerData, orderData)
        
            sendStatusEmail(customerData.customerName, customerData.customerEmail, 'paid', orderData.sessionId)
            sendMailAdminNotification(customerData, orderData)

        }
        res.status(200).send()

    } catch (error) {
        res.status(400).send(`Error message: ${error.message}`)
    }
})

app.use(express.json())
app.use(express.static('public')) //potrzebujemy aby widziec pliki html,css....

//tutaj tworzymy sesje checkoutu i wysylamy link url tej sesji do frontendu
app.post('/checkout-session', checkoutLimiter, async (req, res) => {
    try {
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
                allowed_countries: ['PL', 'DE', 'FR', 'CZ', 'SK', 'LT', 'AT']
            },
            mode: 'payment',
            success_url: `http://localhost:3000/success.html`,
            cancel_url: `http://localhost:3000/cancel.html`,
            automatic_tax: { enabled: true }
        })
        res.json({ url: session.url })

    } catch (error) {
        console.error("Stripe Session Error:", error.message)
        res.status(500).json({ error: "Could not create checkout session. Please try again." })
    }
})

app.get('/get-order-status/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        const orderStatus = await dbGetOrderStatus(sessionId);
        if (orderStatus) {
            res.json({ status: orderStatus });
        } else {
            res.status(404).json({ error: "Order not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/cancel-order', checkoutLimiter, async (req, res) => {
    const sessionId = req.body.sessionId
    try {
        const orderStatus = await dbGetOrderStatus(sessionId)
        if (orderStatus !== 'paid') {
            return res.status(400).json({ error: "Order cannot be cancelled at this stage." });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId)
        const paymentIntentId = session.payment_intent;
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        })
        await dbCancelOrder(sessionId)
        const customer = await dbGetCustomerBySession(sessionId)
        if(customer) sendStatusEmail(customer.name, customer.email, 'cancelled', sessionId)

        res.json({ message: 'Order cancelled successfuly!' })

    } catch (error) {
        res.status(500).json({ error: `Server error: ${error.message}` })
    }
})

app.post('/return-order', checkoutLimiter, async (req, res) => {
    const sessionId = req.body.sessionId
    try {
        const orderStatus = await dbGetOrderStatus(sessionId)
        if (orderStatus !== 'delivered') {
            return res.status(400).json({ error: "Order cannot be returned at this stage." });
        }

        await dbReturnOrder(sessionId)
        const customer = await dbGetCustomerBySession(sessionId)
        if(customer) sendStatusEmail(customer.name, customer.email, 'in_return', sessionId)

        res.json({ message: 'Order return request sent successfuly!' })

    } catch (error) {
        res.status(500).json({ error: `Server error: ${error.message}` })
    }
})

app.get('/sim-admin-console-confirm-order/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId
    try {
        const orderStatus = await dbGetOrderStatus(sessionId)
        if (orderStatus !== 'in_return') {
            return res.status(400).json({ error: "Order return cannot be confirmed at this stage." });
        }
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        const paymentIntentId = session.payment_intent;
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        })
        await dbConfirmReturn(sessionId)

        const customer = await dbGetCustomerBySession(sessionId)
        if(customer) sendStatusEmail(customer.name, customer.email, 'returned', sessionId)

        res.json({ message: 'Order return confirmed and refunded successfuly!' })

    } catch (error) {
        res.status(500).json({ error: `Server error: ${error.message}` })
    }
})

app.get('/sim-admin-console-send-order/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId
    try {
        const orderStatus = await dbGetOrderStatus(sessionId)
        if (orderStatus !== 'paid') {
            return res.status(400).json({ error: "Order cannot be sent to delivery at this stage." });
        } 
        await dbMarkOrderDelivery(sessionId)

        const customer = await dbGetCustomerBySession(sessionId)
        if(customer) sendStatusEmail(customer.name, customer.email, 'in_delivery', sessionId)

        res.json({ message: 'Order status changed to in_delivery successfuly!' })

    } catch (error) {
        res.status(500).json({ error: `Server error: ${error.message}` })
    }
})

app.get('/sim-admin-console-order-delivered/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId
    try {
        const orderStatus = await dbGetOrderStatus(sessionId)
        if (orderStatus !== 'in_delivery') {
            return res.status(400).json({ error: "Order cannot be confirmed as delivered at this stage." });
        } 
        await dbOrderDelivered(sessionId)

        const customer = await dbGetCustomerBySession(sessionId)
        if(customer) sendStatusEmail(customer.name, customer.email, 'delivered', sessionId)

        res.json({ message: 'Order status changed to delivered successfuly!' })

    } catch (error) {
        res.status(500).json({ error: `Server error: ${error.message}` })
    }
})

app.get('/test', (req, res) => {
    res.json({ message: "FloatLight server is ready!" })
})

app.listen(3000, () => {
    console.log("Server works on: http://localhost:3000")
})