require('dotenv').config()
const db_user = process.env.DB_USER
const db_password = process.env.DB_PASSWORD
const db_host = process.env.DB_HOST
const db_port = process.env.DB_PORT
const db_name = process.env.DB_NAME

const { Pool } = require('pg')
const pool = new Pool({
    user: db_user,
    host: db_host,
    database: db_name,
    password: db_password,
    port: db_port
})

pool.query('SELECT NOW()', (err, res) => {
    if (err) { console.log(err.message) } else { console.log("PostgreSQL database connected.") }
})

const dbQueries = {
    queryAddCustomer: 'insert into Customers (first_name, last_name, email) values ($1, $2, $3) returning customer_id',
    queryAddOrder: 'insert into Orders (customer_id, product_id, quantity, status, session_id) values ($1, $2, $3, $4, $5) returning order_id',
    queryMarkEmailSent: 'update Orders set email_sent = true where session_id = $1 '
}



async function dbAddCustomer(customerName, customerEmail) {
    try {
        const { firstName, lastName } = extractNames(customerName)
        const values = [firstName, lastName, customerEmail]
        const result = await pool.query(dbQueries.queryAddCustomer, values)
        return result.rows[0].customer_id
    } catch (error) {
        console.error(`Failed to add customer ${customerEmail}:`, error.message)
        throw error
    }
}

async function dbAddOrder(customerId, productQuantity, sessionId) {
    try {
        const values = [customerId, 1, productQuantity, 'paid', sessionId]
        return await pool.query(dbQueries.queryAddOrder, values)
    } catch (error) {
        console.error(`Failed to add order for session ${sessionId}:`, error.message)
        throw error
    }
}

async function dbMarkEmailSent(sessionId) {
    try {
        await pool.query(dbQueries.queryMarkEmailSent, [sessionId]);
    } catch (error) {
        console.error(`Error while marking email_sent for ${sessionId}:`, error.message);
    }
}

async function dbCreateOrderWithCustomer(customerData, orderData) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN')

        const { firstName, lastName } = extractNames(customerData.customerName)
        const valuesCustomer = [firstName, lastName, customerData.customerEmail]
        const resultCustomer = await client.query(dbQueries.queryAddCustomer, valuesCustomer)
        const customerId = resultCustomer.rows[0].customer_id
        const valuesOrder = [customerId, 1, orderData.productQuantity, 'paid', orderData.sessionId]
        await client.query(dbQueries.queryAddOrder, valuesOrder)

        await client.query('COMMIT')
    } catch (error) {
        console.error("Transaction error, retrieving changes:", error);
        await client.query('ROLLBACK')
        throw error;
    } finally {
        client.release();
    }
}

function extractNames(name) {
    const customerNameSplit = name.trim().split(/\s+/)
    let lastName = ''
    const firstName = customerNameSplit[0]
    if (customerNameSplit.length === 1) {
        lastName = 'not provided'
    }
    else {
        lastName = customerNameSplit.slice(1).join('-')
    }
    return { firstName, lastName }
}

module.exports = { dbAddCustomer, dbAddOrder, dbCreateOrderWithCustomer, dbMarkEmailSent }