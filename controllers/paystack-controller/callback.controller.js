

const callback = async (req, res) => {
        try {
        const { trxref, reference } = req.query;
        
        if (!reference) {
            return res.status(400).send(`
                <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h2 style="color: #e74c3c;">Payment Error</h2>
                        <p>Payment reference is missing</p>
                        <a href="/" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go Back</a>
                    </body>
                </html>
            `);
        }

        // Return a success page with payment details
        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #27ae60;">Payment Successful!</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 400px;">
                        <p><strong>Transaction Reference:</strong> ${trxref}</p>
                        <p><strong>Payment Reference:</strong> ${reference}</p>
                        <p style="color: #666;">Your payment has been processed successfully.</p>
                    </div>
                    <a href="/" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Continue</a>
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Payment callback error:', error);
        res.status(500).send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #e74c3c;">Payment Error</h2>
                    <p>Something went wrong: ${error.message}</p>
                    <a href="/" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go Back</a>
                </body>
            </html>
        `);
    }
}


module.exports = {
    callback,
}