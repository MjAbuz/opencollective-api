import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';

import models from '../../../models';
import * as TransactionLib from '../../common/transactions';
import { TransactionType } from '../enum/TransactionType';
import { idEncode } from '../identifiers';
import { Amount } from '../object/Amount';
import { Expense } from '../object/Expense';
import { Order } from '../object/Order';
import { PaymentMethod } from '../object/PaymentMethod';

import { Account } from './Account';

const TransactionPermissions = new GraphQLObjectType({
  name: 'TransactionPermissions',
  description: 'Fields for the user permissions on an transaction',
  fields: {
    canRefund: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Whether the current user can edit the transaction',
      resolve: TransactionLib.canRefund,
    },
    canDownloadInvoice: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Whether the current user can download this transaction's invoice",
      resolve: TransactionLib.canDownloadInvoice,
    },
  },
});

export const Transaction = new GraphQLInterfaceType({
  name: 'Transaction',
  description: 'Transaction interface shared by all kind of transactions (Debit, Credit)',
  fields: () => {
    return {
      id: {
        type: new GraphQLNonNull(GraphQLString),
      },
      legacyId: {
        type: new GraphQLNonNull(GraphQLInt),
      },
      uuid: {
        type: GraphQLString,
      },
      type: {
        type: TransactionType,
      },
      description: {
        type: GraphQLString,
      },
      amount: {
        type: new GraphQLNonNull(Amount),
      },
      netAmount: {
        type: new GraphQLNonNull(Amount),
      },
      platformFee: {
        type: new GraphQLNonNull(Amount),
      },
      hostFee: {
        type: Amount,
      },
      paymentProcessorFee: {
        type: Amount,
      },
      host: {
        type: Account,
      },
      fromAccount: {
        type: Account,
      },
      toAccount: {
        type: Account,
      },
      giftCardEmitterAccount: {
        type: Account,
      },
      createdAt: {
        type: GraphQLDateTime,
      },
      updatedAt: {
        type: GraphQLDateTime,
      },
      expense: {
        type: Expense,
      },
      order: {
        type: Order,
      },
      isRefunded: {
        type: GraphQLBoolean,
      },
      isRefund: {
        type: GraphQLBoolean,
      },
      paymentMethod: {
        type: PaymentMethod,
      },
      permissions: {
        type: TransactionPermissions,
      },
    };
  },
});

export const TransactionFields = () => {
  return {
    id: {
      type: new GraphQLNonNull(GraphQLString),
      resolve(transaction) {
        return idEncode(transaction.id, 'transaction');
      },
    },
    legacyId: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve(transaction) {
        return transaction.id;
      },
    },
    uuid: {
      type: GraphQLString,
    },
    type: {
      type: TransactionType,
      resolve(transaction) {
        return transaction.type;
      },
    },
    description: {
      type: GraphQLString,
      resolve(transaction) {
        return transaction.description;
      },
    },
    amount: {
      type: new GraphQLNonNull(Amount),
      resolve(transaction) {
        return { value: transaction.amount, currency: transaction.currency };
      },
    },
    netAmount: {
      type: new GraphQLNonNull(Amount),
      resolve(transaction) {
        return {
          value: transaction.netAmountInCollectiveCurrency,
          currency: transaction.currency,
        };
      },
    },
    platformFee: {
      type: new GraphQLNonNull(Amount),
      resolve(transaction) {
        return {
          value: transaction.platformFeeInHostCurrency || 0,
          currency: transaction.hostCurrency,
        };
      },
    },
    hostFee: {
      type: new GraphQLNonNull(Amount),
      resolve(transaction) {
        return {
          value: transaction.hostFeeInHostCurrency || 0,
          currency: transaction.hostCurrency,
        };
      },
    },
    paymentProcessorFee: {
      type: new GraphQLNonNull(Amount),
      resolve(transaction) {
        return {
          value: transaction.paymentProcessorFeeInHostCurrency || 0,
          currency: transaction.hostCurrency,
        };
      },
    },
    host: {
      type: Account,
      resolve(transaction) {
        return transaction.getHostCollective();
      },
    },
    createdAt: {
      type: GraphQLDateTime,
      resolve(transaction) {
        return transaction.createdAt;
      },
    },
    updatedAt: {
      type: GraphQLDateTime,
      resolve(transaction) {
        // Transactions are immutable right?
        return transaction.createdAt;
      },
    },
    expense: {
      type: Expense,
      resolve(transaction, _, req) {
        if (transaction.ExpenseId) {
          return req.loaders.Expense.byId.load(transaction.ExpenseId);
        } else {
          return null;
        }
      },
    },
    order: {
      type: Order,
      resolve(transaction, _, req) {
        if (transaction.OrderId) {
          return req.loaders.Order.byId.load(transaction.OrderId);
        } else {
          return null;
        }
      },
    },
    isRefunded: {
      type: GraphQLBoolean,
      resolve(transaction) {
        return transaction.RefundTransactionId !== null;
      },
    },
    isRefund: {
      type: GraphQLBoolean,
    },
    paymentMethod: {
      type: PaymentMethod,
      resolve(transaction) {
        return models.PaymentMethod.findByPk(transaction.PaymentMethodId);
      },
    },
    permissions: {
      type: new GraphQLNonNull(TransactionPermissions),
      description: 'The permissions given to current logged in user for this transaction',
      async resolve(transaction) {
        return transaction; // Individual fields are set by TransactionPermissions's resolvers
      },
    },
    giftCardEmitterAccount: {
      type: Account,
      description: '',
      async resolve(transaction, _, req) {
        return transaction.UsingVirtualCardFromCollectiveId
          ? await req.loaders.Collective.byId.load(transaction.UsingVirtualCardFromCollectiveId)
          : null;
      },
    },
  };
};
