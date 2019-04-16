import paypalAdaptive from './adaptiveGateway';
import config from 'config';
import uuidv1 from 'uuid/v1';
import logger from '../../lib/logger';

/**
 * PayPal paymentProvider
 * Provides a oAuth flow to creates a payment method that can be used to pay up to $2,000 USD or equivalent
 */

export default {
  features: {
    recurring: false,
    paymentMethod: true, // creates a payment method that can be used to pay up to $2,000 USD or equivalent
  },

  fees: async ({ amount, currency, host }) => {
    if (host.currency === currency)
      /*
        Paypal fees can vary from 2.9% + $0.30 to as much as 5% (maybe higher)
        with 2.9%, we saw a collective go in negative. Changing minimum to 3.9% to
        reduce risk of negative balance (and taking on some risk of an expense not
        able to be paid out)
       */
      return 0.039 * amount + 30;
    else {
      return 0.05 * amount + 30;
    }
  },

  pay: async (collective, expense, email, preapprovalKey) => {
    const uri = `/${collective.slug}/expenses/${expense.id}`;
    const expenseUrl = config.host.website + uri;
    const amount = expense.amount / 100;
    const payload = {
      // Note: if we change this to 'PAY', payment will complete in one step
      // but we won't get any info on fees or conversion rates.
      // By creating payment, we get that info in the first response.
      actionType: 'CREATE',
      // TODO does PayPal accept all the currencies that we support in our expenses?
      currencyCode: expense.currency,
      feesPayer: 'SENDER',
      memo: `Reimbursement from ${collective.name}: ${expense.description}`,
      trackingId: [uuidv1().substr(0, 8), expense.id].join(':'),
      preapprovalKey,
      returnUrl: `${expenseUrl}?result=success&service=paypal`,
      cancelUrl: `${expenseUrl}?result=cancel&service=paypal`,
      receiverList: {
        receiver: [
          {
            email,
            amount,
            paymentType: 'SERVICE',
          },
        ],
      },
    };
    const createPaymentResponse = await paypalAdaptive.pay(payload);
    const executePaymentResponse = await paypalAdaptive.executePayment(createPaymentResponse.payKey);
    return { createPaymentResponse, executePaymentResponse };
  },

  // Returns the balance in the currency of the paymentMethod
  getBalance: async paymentMethod => {
    try {
      const resp = await paypalAdaptive.preapprovalDetails(paymentMethod.token);
      const initialBalance = parseFloat(resp.maxTotalAmountOfAllPayments);
      const totalSpent = parseFloat(resp.curPaymentsAmount);
      return { amount: (initialBalance - totalSpent) * 100, currency: paymentMethod.currency };
    } catch (e) {
      logger.error('getBalance for PayPal pre-approval failed', e);
      return { balance: 0, currency: paymentMethod.currency };
    }
  },
};
