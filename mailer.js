const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS

const nodemailer = require('nodemailer')
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    }
})

const { dbMarkEmailSent } = require('./database.js')

async function sendStatusEmail(customerName, customerEmail, status, sessionId) {
    let subject = "";
    let htmlContent = "";
    const manageUrl = `http://localhost:3000/manage.html?session=${sessionId}`

    switch (status) {
        case 'paid':
            subject = "FloatLight - Potwierdzenie zamówienia 💡";
            htmlContent = `<h2>Cześć ${customerName}! Dziękujemy za zakup!</h2><p>Otrzymaliśmy płatność, a Twój FloatLight już szykuje się do drogi.</p>`;
            break;
        case 'in_delivery':
            subject = "FloatLight - Twoja paczka jest w drodze! 🚚";
            htmlContent = `<h2>Dobre wieści, ${customerName}!</h2><p>Przekazaliśmy Twoją paczkę kurierowi. Lada chwila będzie u Ciebie.</p>`;
            break;
        case 'delivered':
            subject = "FloatLight - Paczka dostarczona 📦";
            htmlContent = `<h2>${customerName}, Twój FloatLight jest już z Tobą!</h2><p>Mamy nadzieję, że Ci się podoba. Gdybyś jednak chciał go zwrócić, użyj linku poniżej.</p>`;
            break;
        case 'in_return':
            subject = "FloatLight - Instrukcje zwrotu 🔄";
            htmlContent = `<h2>Otrzymaliśmy Twoje zgłoszenie zwrotu.</h2><p>Spakuj bezpiecznie lampę i odeślij ją na adres naszego magazynu. Gdy tylko ją odbierzemy, zlecimy zwrot środków.</p>`;
            break;
        case 'returned':
            subject = "FloatLight - Zwrot zakończony 💳";
            htmlContent = `<h2>Pieniądze wracają do Ciebie!</h2><p>Odebraliśmy Twoją paczkę. Pełny zwrot środków został zlecony na Twoje konto (może to zająć do 3-5 dni roboczych).</p>`;
            break;
        case 'cancelled':
            subject = "FloatLight - Zamówienie anulowane ❌";
            htmlContent = `<h2>Zamówienie zostało pomyślnie anulowane.</h2><p>Twoje pieniądze zostały zwrócone przez system Stripe.</p>`;
            break;
        default:
            console.log("Nieznany status zamówienia, mail nie został wysłany.");
            return;
    }

    const finalHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            ${htmlContent}
            <div style="text-align: center; margin: 30px 0;">
                <a href="${manageUrl}" style="background-color: #2c3e50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Zarządzaj swoim zamówieniem
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 14px;">Pozdrawiamy,<br><strong>Zespół FloatLight</strong></p>
        </div>
    `;

    const mailOptions = {
        from: emailUser,
        to: customerEmail,
        subject: subject,
        html: finalHtml
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log(`Powiadomienie [${status}] do ${customerEmail} wysłane!`)
        if(status === 'paid') {
            await dbMarkEmailSent(sessionId) 
        }
    } catch (error) {
        console.error(`Błąd wysyłki maila do ${customerEmail}: ${error.message}`)
    }
}

async function sendMailAdminNotification(customerData, orderData){
    //emailHtml ai generated ;p
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2c3e50;">🚨 Nowe Zamówienie: FloatLight!</h2>
        <p>Hura! Ktoś właśnie zapłacił za zamówienie. Czas wziąć się do pracy.</p>
        
        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px; color: #d87d4a;">Szczegóły Zamówienia</h3>
        <ul style="list-style-type: none; padding: 0;">
            <li style="margin-bottom: 5px;"><strong>ID Sesji:</strong> ${orderData.sessionId}</li>
            <li style="margin-bottom: 5px;"><strong>Ilość sztuk:</strong> <span style="font-size: 18px; color: #27ae60; font-weight: bold;">${orderData.productQuantity}x FloatLight</span></li>
        </ul>

        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px; color: #d87d4a;">Dane Klienta</h3>
        <ul style="list-style-type: none; padding: 0;">
            <li style="margin-bottom: 5px;"><strong>Imię i nazwisko:</strong> ${customerData.customerName}</li>
            <li style="margin-bottom: 5px;"><strong>Email:</strong> ${customerData.customerEmail}</li>
            <li style="margin-bottom: 5px;"><strong>Telefon:</strong> ${customerData.customerPhone || 'Nie podano'}</li>
        </ul>

        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px; color: #d87d4a;">Adres Wysyłki</h3>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 13px; overflow-x: auto; border: 1px solid #ddd;">${JSON.stringify(customerData.customerAddress, null, 2)}</pre>
        
        <p style="font-size: 14px; margin-top: 30px; text-align: center;">Pakuj paczkę i nadawaj! 🚀</p>
    </div>`

    const mailOptions = {
    from: emailUser,
    to: emailUser,
    replyTo: customerData.customerEmail,
    subject: `New Order!`,
    html: emailHtml
}
    try{
        await transporter.sendMail(mailOptions)
        console.log(`Mail to admin send succesfully!`)
    }catch(error){
        console.error(` Error while sending mail to admin. Error: ${mailError.message}`)
    }


}

module.exports = { sendStatusEmail, sendMailAdminNotification }

