import { q, Query, QueryState } from '../../shared/query';
import {
  AccountEntity,
  CategoryGroupEntity,
  PayeeEntity,
  TransactionEntity,
} from '../../types/models';
import { createApp } from '../app';
import { aqlQuery } from '../aql';
import { mutator } from '../mutators';
import { undoable } from '../undo';

import * as db from '../db';
import { exportQueryToCSV, exportToCSV } from './export/export-to-csv';
import { parseFile, ParseFileOptions } from './import/parse-file';
import { mergeTransactions } from './merge';

import { batchUpdateTransactions } from '.';

type FindPotentialAccountsArgs = {
  payeeName?: string;
  importedPayee?: string;
  extractedAccountNumber?: string;
  // amount?: number; // Not used in this version, but could be for future heuristics
  // date?: string;   // Not used in this version
};

export type TransactionHandlers = {
  'transactions-batch-update': typeof handleBatchUpdateTransactions;
  'transaction-add': typeof addTransaction;
  'transaction-update': typeof updateTransaction;
  'transaction-delete': typeof deleteTransaction;
  'transactions-parse-file': typeof parseTransactionsFile;
  'transactions-export': typeof exportTransactions;
  'transactions-export-query': typeof exportTransactionsQuery;
  'transactions-merge': typeof mergeTransactions;
  'get-earliest-transaction': typeof getEarliestTransaction;
  'transactions-find-potential-accounts': typeof findPotentialAccountsForTransaction;
};

async function findPotentialAccountsForTransaction(
  args: FindPotentialAccountsArgs,
): Promise<{ potentialAccountIds: string[] }> {
  const allAccounts = await db.getAccounts({ closed: false });
  const potentialAccountIds = new Set<string>();

  // Primary Matching - Extracted Account Number
  if (args.extractedAccountNumber && args.extractedAccountNumber.trim() !== '') {
    for (const acc of allAccounts) {
      if (acc.account_id === args.extractedAccountNumber) {
        potentialAccountIds.add(acc.id);
      }
    }
  }

  // Secondary Matching - Payee's Last Used Account (if no primary match)
  if (potentialAccountIds.size === 0 && args.payeeName) {
    const payee = await db.getPayeeByName(args.payeeName);
    if (payee && payee.transfer_acct == null) {
      const lastTransaction = await db.first<{ account: string }>(
        'SELECT account FROM transactions WHERE payee = ? AND account IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1',
        [payee.id],
      );
      if (lastTransaction && lastTransaction.account) {
        potentialAccountIds.add(lastTransaction.account);
      }
    }
  }
  
  // Optional: Tertiary Matching - Imported Payee's Last Used Account (if still no matches)
  // This could be useful if the `payeeName` was a renamed payee and `importedPayee` holds the original.
  if (potentialAccountIds.size === 0 && args.importedPayee && args.importedPayee !== args.payeeName) {
    const importedPayeeEntity = await db.getPayeeByName(args.importedPayee);
    if (importedPayeeEntity && importedPayeeEntity.transfer_acct == null) {
      const lastTransactionForImportedPayee = await db.first<{ account: string }>(
        'SELECT account FROM transactions WHERE payee = ? AND account IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1',
        [importedPayeeEntity.id],
      );
      if (lastTransactionForImportedPayee && lastTransactionForImportedPayee.account) {
        potentialAccountIds.add(lastTransactionForImportedPayee.account);
      }
    }
  }

  return { potentialAccountIds: Array.from(potentialAccountIds) };
}


async function handleBatchUpdateTransactions({
  added,
  deleted,
  updated,
  learnCategories,
}: Parameters<typeof batchUpdateTransactions>[0]) {
  const result = await batchUpdateTransactions({
    added,
    updated,
    deleted,
    learnCategories,
  });

  return result;
}

async function addTransaction(transaction: TransactionEntity) {
  await handleBatchUpdateTransactions({ added: [transaction] });
  return {};
}

async function updateTransaction(transaction: TransactionEntity) {
  await handleBatchUpdateTransactions({ updated: [transaction] });
  return {};
}

async function deleteTransaction(transaction: Pick<TransactionEntity, 'id'>) {
  await handleBatchUpdateTransactions({ deleted: [transaction] });
  return {};
}

async function parseTransactionsFile({
  filepath,
  options,
}: {
  filepath: string;
  options: ParseFileOptions;
}) {
  return parseFile(filepath, options);
}

async function exportTransactions({
  transactions,
  accounts,
  categoryGroups,
  payees,
}: {
  transactions: TransactionEntity[];
  accounts: AccountEntity[];
  categoryGroups: CategoryGroupEntity[];
  payees: PayeeEntity[];
}) {
  return exportToCSV(transactions, accounts, categoryGroups, payees);
}

async function exportTransactionsQuery({
  query: queryState,
}: {
  query: QueryState;
}) {
  return exportQueryToCSV(new Query(queryState));
}

async function getEarliestTransaction() {
  const { data } = await aqlQuery(
    q('transactions')
      .options({ splits: 'none' })
      .orderBy({ date: 'asc' })
      .select('*')
      .limit(1),
  );
  return data[0] || null;
}

export const app = createApp<TransactionHandlers>();

app.method(
  'transactions-batch-update',
  mutator(undoable(handleBatchUpdateTransactions)),
);
app.method('transactions-merge', mutator(undoable(mergeTransactions)));

app.method('transaction-add', mutator(addTransaction));
app.method('transaction-update', mutator(updateTransaction));
app.method('transaction-delete', mutator(deleteTransaction));
app.method('transactions-parse-file', mutator(parseTransactionsFile));
app.method('transactions-export', mutator(exportTransactions));
app.method('transactions-export-query', mutator(exportTransactionsQuery));
app.method('get-earliest-transaction', getEarliestTransaction);
app.method('transactions-find-potential-accounts', findPotentialAccountsForTransaction);
