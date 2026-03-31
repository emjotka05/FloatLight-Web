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

async function sendMailFunc(customerName, customerEmail) {
    const emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #d87d4a;">Hello ${customerName}! Thank you for your FloatLight order! 💡</h2>
                <p>We've successfully received your payment and our team is already preparing your package.</p>
                <p>We will send you another update as soon as your <strong>FloatLight</strong> is shipped and on its way to you.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 14px; color: #777;">If you have any questions, simply reply to this email.</p>
                <p style="font-size: 14px;">Best regards,<br><strong>The FloatLight Team</strong></p>
            </div>`
            
    const mailOptions = {
        from: emailUser,
        to: customerEmail,
        subject: "FloatLight order confirmation.",
        html: emailHtml
    }
    try{
        await transporter.sendMail(mailOptions)
        console.log(`Mail to ${customerEmail} send succesfully!`)
    }catch(mailError){
        console.log(` Error while sending mail to ${customerEmail}. Error: ${mailError.message}`)
    }   
}

module.exports = { sendMailFunc }

