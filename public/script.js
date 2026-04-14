
/*  !!!!!!VERSION WITHOUT BACKEND!!!!!!!!
const actionButtons = document.querySelectorAll(".action-btn")

actionButtons.forEach(actionButton => {
    actionButton.addEventListener("click", ()=> {
        if(actionButton.id === "stripe-btn"){
            const newTab = window.open("https://buy.stripe.com/test_eVq4gz9Xb7FK6cX4Y8gMw00", '_blank')
        }else{
            window.location.href ="store.html"
        }
    })

*/

/*!!!!VERSION WITH BACKEND!!!!*/
const actionButtons = document.querySelectorAll(".action-btn")
const observedElements = document.querySelectorAll(".observed")
const orderStatusEl = document.getElementById("MP-h2-order-status")
const buttonWrapperEl = document.getElementById("MP-button-wrapper")




const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting){
            console.log("observed element")
            entry.target.classList.add("show")
        }else{
            entry.target.classList.remove("show")
        }
    })
}, {})

observedElements.forEach((el) => {
    observer.observe(el)
})

actionButtons.forEach(actionButton => {
    actionButton.addEventListener("click", () => {
        if (actionButton.id === "stripe-btn") {
            requestSession()
        } else if (actionButton.id === 'go-back-btn') {
            window.location.href = "index.html"
        }
        else {
            window.location.href = "store.html"
        }
    })
})


document.addEventListener('DOMContentLoaded', async () => {
    const paramsString = window.location.search
    const searchParams = new URLSearchParams(paramsString)
    const sessionId = searchParams.get("session")
    if(!sessionId){
        orderStatusEl.textContent = 'Error while loading the order status...'
        return
    }
    const url = '/get-order-status/' + sessionId
    try {
        const response = await fetch(url, {method: "GET"})
        const orderStatus = await response.json()
        const status = orderStatus.status
        if (status === 'paid') {
            orderStatusEl.textContent = 'Status: Paid - Preparing for shipment'
            buttonWrapperEl.innerHTML = '<button id="cancel-order-btn" class="action-btn">Cancel Order</button>'
            const cancelBtn = document.getElementById("cancel-order-btn")
            cancelBtn.addEventListener('click', () => cancelOrder(sessionId))
        } 
        else if (status === 'in_delivery') {
            orderStatusEl.textContent = 'Status: In Delivery - Your product will be soon at your house.'
        } 
        else if (status === 'delivered') {
            orderStatusEl.textContent = 'Status: Delivered - Your product has been succesfully delivered.'
            buttonWrapperEl.innerHTML = '<button id="return-order-btn" class="action-btn">Return Order</button>'
            const returnBtn = document.getElementById("return-order-btn")
            returnBtn.addEventListener('click', () => returnOrder(sessionId))
        } 
        else if (status === 'cancelled') {
            orderStatusEl.textContent = 'Status: Order cancelled. You refund will soon arrive!'
        } 
        else if (status === 'in_return') {
            orderStatusEl.textContent = 'Status: In Return'
        } 
        else if (status === 'returned') {
            orderStatusEl.textContent = 'Status: Returned & Refunded'
        } 
        else {
            orderStatusEl.textContent = 'Error while loading the order status...'
            console.log("Wrong status in database")
        }

    }catch(error){
        console.error('Error while loading status and loading page')
    }
})


async function cancelOrder(sessionId){
    const url = '/cancel-order'
    try{
        const response = await fetch(url, {method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({sessionId: sessionId})
        })
        if(response.ok){
            window.location.reload();
        }else {
            orderStatusEl.textContent = 'Error while cancelling the order...'
        }
    }catch(error){
        orderStatusEl.textContent = 'Error while cancelling the order...'
    }
}

async function returnOrder (sessionId) {
    const url = '/return-order'
    try{
        const response = await fetch(url, {method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({sessionId: sessionId})
        })
        if(response.ok){
            window.location.reload();
        }else {
            orderStatusEl.textContent = 'Error...'
        }
    }catch(error){
        orderStatusEl.textContent = 'Error...'
    }
}

async function requestSession() {
    const url = `http://localhost:3000/checkout-session`
    try {
        const response = await fetch(url, {method: "POST"})

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`)
        }

        const result = await response.json()
        console.log(result)
        window.location.href = `${result.url}`

    } catch (error) {
        console.log(error.message)
        alert("Server error, try again later.")
    }

}