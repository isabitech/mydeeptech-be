incoming feature payout to our freelancers, concerning unpaidInvoices

Create API endpoint for 
- bulk authorize payment (to authorize all unpaid invoices to paid at once, and send a payment mail to all the dtusers)

- generate bulk transfer csv ( to generate Paystack csv for unpaid invoices in paystack format for Nigerian freelancers )

 Step 1 - include bank code for Nigerian freelancers in their payment information from  the backend.
paystack bank codes (slugs)

{ value: "Access Bank", label: "Access Bank", bank-code: "access-bank" },
                              { value: "Fidelity Bank", label: "Fidelity Bank", bankCode: "fidelity-bank" },
                              { value: "First Bank of Nigeria", label: "First Bank of Nigeria", bankCode: "first-bank-of-nigeria" },
                              { value: "Guaranty Trust Bank", label: "Guaranty Trust Bank (GTBank)", bankCode: "guaranty-trust-bank" },
                              { value: "United Bank for Africa", label: "United Bank for Africa (UBA)", bankCode: "united-bank-for-africa" },
                              { value: "Zenith Bank", label: "Zenith Bank", bankCode: "zenith-bank" },
                              { value: "Ecobank Nigeria", label: "Ecobank Nigeria", bankCode: "ecobank-nigeria" },
                              { value: "Union Bank of Nigeria", label: "Union Bank of Nigeria", bankCode: "union-bank-of-nigeria" },
                              { value: "Stanbic IBTC Bank", label: "Stanbic IBTC Bank", bankCode: "union-bank-of-nigeria" },
                              { value: "Sterling Bank", label: "Sterling Bank", bankCode: "sterling-bank" },
                              { value: "Wema Bank", label: "Wema Bank", bankCode: "wema-bank" },
                              { value: "Polaris Bank", label: "Polaris Bank", bankCode: "polaris-bank" },
                              { value: "Kuda Bank", label: "Kuda Bank", bankCode: "kuda-bank" },
                              { value: "VFD Microfinance Bank", label: "VFD Microfinance Bank", bankCode: "vfd" },
                              { value: "Opay", label: "Opay", bankCode: "paycom" },
                              { value: "PalmPay", label: "PalmPay", bankCode: "palmpay" },
                              { value: "Moniepoint", label: "Moniepoint", bankCode: "moniepoint-mfb-ng" }


step 2 -  a USD to Naira conversion (backend as well) to get the payout rate., 
we will be using exchangeratesapi.io

THE CSV Template

CSV Template for paystack, for bulk transfer generations for Nigerian freelancers
Transfer Amount	Transfer Note (Optional)	Transfer Reference (Optional)	Recipient Code (This overrides all other details if available)	Bank Code or Slug	Account Number	Account Name (Optional)	Email Address (Optional)
							
Naira conversion = {invoiceAmount(USD) converted to Naira }	 {invoice.description} for the dtUser	{invoice.invoiceNumber}	//Leave empty	{dtUserId.payment_info.bank_code}	{dtUserId.payment_info.account_number}	{dtUserId.payment_info.account_name}	{dtUserId.email}
