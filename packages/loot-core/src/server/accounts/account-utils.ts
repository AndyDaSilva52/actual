// @ts-strict-ignore
import { AccountEntity } from '../../types/models';
import * as db from '../db';
import { app as mainApp } from '../main-app'; // To access 'account-create' and 'rule-add' handlers
// import { title } from './title'; // Not used in this version of the function

/**
 * Finds an existing account based on the extracted account number or creates a new one.
 * @param extractedAccountNumber The account number extracted from the imported file.
 * @param extractedBankId The bank ID extracted (currently not used for matching/creation but available).
 * @param extractedAccountType The account type extracted (e.g., CHECKING, SAVINGS, CREDITCARD).
 * @param allAccounts An array of all existing account entities.
 * @returns The ID of the found or newly created account, or null if criteria are not met or creation fails.
 */
export async function findOrCreateAccountByDetails(
  extractedAccountNumber: string,
  extractedBankId: string | null | undefined,
  extractedAccountType: string | null | undefined,
  allAccounts: AccountEntity[], // This is the list of existing accounts
): Promise<string | null> {
  if (!extractedAccountNumber || typeof extractedAccountNumber !== 'string' || extractedAccountNumber.trim() === '') {
    console.warn('findOrCreateAccountByDetails: extractedAccountNumber is empty or invalid.');
    return null;
  }

  // 1. Search Existing Accounts
  const existingAccount = allAccounts.find(
    acc => acc.account_id === extractedAccountNumber,
  );

  if (existingAccount) {
    console.log(`findOrCreateAccountByDetails: Found existing account by account_id: ${existingAccount.id} for number ${extractedAccountNumber}`);
    return existingAccount.id;
  }

  // 2. Create New Account (if no match)
  let accountName = `Account ...${extractedAccountNumber.slice(-4)}`;
  if (extractedAccountType) {
    let typePrefix = extractedAccountType;
    // Basic capitalization for common types
    if (extractedAccountType.toLowerCase() === 'creditcard') {
      typePrefix = 'Credit Card';
    } else if (extractedAccountType.toLowerCase() === 'checking') {
      typePrefix = 'Checking';
    } else if (extractedAccountType.toLowerCase() === 'savings') {
      typePrefix = 'Savings';
    } else if (extractedAccountType.toLowerCase() === 'moneymrkt') {
      typePrefix = 'Money Market';
    } else if (extractedAccountType.toLowerCase() === 'investment') {
      typePrefix = 'Investment';
    } else {
      // Capitalize first letter for other types
      typePrefix = extractedAccountType.charAt(0).toUpperCase() + extractedAccountType.slice(1).toLowerCase();
    }
    accountName = `${typePrefix} ...${extractedAccountNumber.slice(-4)}`;
  }

  // Determine offBudget status (example heuristic)
  let offBudget = false;
  if (extractedAccountType && extractedAccountType.toLowerCase() === 'investment') {
    offBudget = true;
  }
  // Add other heuristics for offBudget if necessary (e.g., loan, mortgage)

  try {
    console.log(`findOrCreateAccountByDetails: Creating new account: ${accountName} for number ${extractedAccountNumber}`);
    const newAccountId: string | null = await mainApp.handlers['account-create']({
      name: accountName,
      balance: 0, // Initial balance, can be adjusted by first import
      offBudget,
    });

    if (newAccountId) {
      // 3. Update the new account's account_id with the extracted number
      // This is crucial for finding this account again using its real account number
      await db.updateAccount({ id: newAccountId, account_id: extractedAccountNumber });
      console.log(`findOrCreateAccountByDetails: Updated new account ${newAccountId} with account_id: ${extractedAccountNumber}`);

      // 4. Create an account rule
      try {
        const last4Digits = extractedAccountNumber.slice(-4);
        const rule = {
          stage: null, // Explicitly set stage if needed, or let handler default
          conditionsOp: 'and',
          conditions: [
            {
              field: 'imported_payee', // Using imported_payee as a heuristic
              op: 'contains',
              value: last4Digits,
              type: 'string',
            },
          ],
          actions: [
            {
              op: 'set',
              field: 'account',
              value: newAccountId,
              type: 'id',
            },
          ],
          // Add a name to the rule for easier identification by the user
          name: `Auto-assign: Acct ...${last4Digits} (Payee heuristic)`,
        };
        await mainApp.handlers['rule-add'](rule);
        console.log(`findOrCreateAccountByDetails: Created heuristic rule for new account ${newAccountId} (Acct ...${last4Digits})`);
      } catch (ruleError) {
        console.error(`findOrCreateAccountByDetails: Failed to create rule for new account ${newAccountId} (account number ending ...${extractedAccountNumber.slice(-4)}):`, ruleError);
        // Do not let rule creation failure stop the process
      }
      return newAccountId;
    } else {
      console.error(`findOrCreateAccountByDetails: Account creation returned no ID for ${accountName}.`);
      return null;
    }
  } catch (accountCreationError) {
    console.error(`findOrCreateAccountByDetails: Failed to create account for number ending ...${extractedAccountNumber.slice(-4)}:`, accountCreationError);
    return null;
  }
}
