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
    queryMarkEmailSent: 'update Orders set email_sent = true where session_id = $1 ',
    queryCheckOrderExists: 'select count (*) from Orders where session_id = $1',
    queryGetCustomerByEmail: 'select customer_id from Customers where email = $1',
    queryGetOrderStatus: 'select status from Orders where session_id = $1',
    queryCancelOrder: `update Orders set status = 'cancelled' where session_id = $1`,
    queryReturnOrder: `update Orders set status = 'in_return' where session_id = $1`,
    queryConfirmReturn: `update Orders set status = 'returned' where session_id = $1`,
    queryOrderDelivery: `update Orders set status = 'in_delivery' where session_id = $1`,
    queryOrderDelivered: `update Orders set status = 'delivered' where session_id = $1`,
    queryGetCustomerBySession: `select c.first_name, c.email from Customers c join Orders o on c.customer_id = o.customer_id where o.session_id = $1`,
    queryUpdateCustomerName: `update Customers set first_name = $1, last_name = $2 where customer_id = $3`
}
async function dbGetOrderStatus(sessionId) {
    try {
        const result = await pool.query(dbQueries.queryGetOrderStatus, [sessionId])
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0].status;
    } catch (error) {
        console.error(`Failed to get order status for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbCancelOrder(sessionId) {
    try {
        await pool.query(dbQueries.queryCancelOrder, [sessionId])
    } catch (error) {
        console.error(`Failed to cancel order status for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbReturnOrder(sessionId) {
    try {
        await pool.query(dbQueries.queryReturnOrder, [sessionId])
    } catch (error) {
        console.error(`Failed to return order status for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbConfirmReturn(sessionId) {
    try {
        await pool.query(dbQueries.queryConfirmReturn, [sessionId])
    } catch (error) {
        console.error(`Failed to confirm order for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbMarkOrderDelivery(sessionId) {
    try {
        await pool.query(dbQueries.queryOrderDelivery, [sessionId])
    } catch (error) {
        console.error(`Failed to confirm order for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbOrderDelivered(sessionId) {
    try {
        await pool.query(dbQueries.queryOrderDelivered, [sessionId])
    } catch (error) {
        console.error(`Failed to confirm order for this session: ${sessionId}:`, error.message)
        throw error
    }
}

async function dbCheckOrderExists(sessionId) {
    try {
        let result = await pool.query(dbQueries.queryCheckOrderExists, [sessionId])
        let orderCount = Number(result.rows[0].count)
        return orderCount > 0
    } catch (error) {
        console.error(`Failed to check if order exists for this session: ${sessionId}:`, error.message)
        throw error
    }
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
        await pool.query(dbQueries.queryMarkEmailSent, [sessionId])
    } catch (error) {
        console.error(`Error while marking email_sent for ${sessionId}:`, error.message)
    }
}

async function dbCreateOrderWithCustomer(customerData, orderData) {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')
        let customerId

        const getCustomer = await client.query(dbQueries.queryGetCustomerByEmail, [customerData.customerEmail])

        if (getCustomer.rows.length > 0) {
            customerId = getCustomer.rows[0].customer_id
            const { firstName, lastName } = extractNames(customerData.customerName);
            await client.query(dbQueries.queryUpdateCustomerName, [firstName, lastName, customerId])
        } else {
            const { firstName, lastName } = extractNames(customerData.customerName)
            const valuesCustomer = [firstName, lastName, customerData.customerEmail]
            const resultCustomer = await client.query(dbQueries.queryAddCustomer, valuesCustomer)
            customerId = resultCustomer.rows[0].customer_id
        }
        const valuesOrder = [customerId, 1, orderData.productQuantity, 'paid', orderData.sessionId]
        await client.query(dbQueries.queryAddOrder, valuesOrder)

        await client.query('COMMIT')
    } catch (error) {
        console.error("Transaction error, retrieving changes:", error)
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

async function dbGetCustomerBySession(sessionId) {
    try {
        const result = await pool.query(dbQueries.queryGetCustomerBySession, [sessionId]);
        if (result.rows.length === 0) {
            return null;
        }
        return {
            name: result.rows[0].first_name,
            email: result.rows[0].email
        };
    } catch (error) {
        console.error(`Failed to get customer info for session: ${sessionId}:`, error.message);
        throw error;
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

module.exports = {
    dbAddCustomer,
    dbAddOrder,
    dbCreateOrderWithCustomer,
    dbMarkEmailSent,
    dbCheckOrderExists,
    dbGetOrderStatus,
    dbCancelOrder,
    dbReturnOrder,
    dbConfirmReturn,
    dbMarkOrderDelivery,
    dbOrderDelivered,
    dbGetCustomerBySession
}