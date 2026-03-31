
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

actionButtons.forEach(actionButton => {
    actionButton.addEventListener("click", () => {
        if(actionButton.id === "stripe-btn"){
            requestSession()
        }else if(actionButton.id === 'go-back-btn'){
            window.location.href = "index.html"
        }
        else{
            window.location.href = "store.html"
        }
    })
})

async function requestSession() {
    const url = `http://localhost:3000/checkout-session`
    try{
        const response = await fetch(url,{
            method : "POST"
        })

        if(!response.ok){
        throw new Error(`Response status: ${response.status}`)
        }

        const result = await response.json()
        console.log(result)
        window.location.href = `${result.url}`

    }catch(error){
        console.log(error.message)
    }
      
}