import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountEntity } from '../../types/models';
import * from '../db'; // Mocked
import { app as mainApp } from '../main-app'; // Mocked
import { findOrCreateAccountByDetails } from './account-utils';

// Mock the db module
vi.mock('../db', async () => ({
  updateAccount: vi.fn(),
  getAccount: vi.fn(), // Needed if we want to verify the account added to map in calling functions
}));

// Mock the mainApp handlers
vi.mock('../main-app', () => ({
  app: {
    handlers: {
      'account-create': vi.fn(),
      'rule-add': vi.fn(),
    },
  },
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});


describe('findOrCreateAccountByDetails', () => {
  let mockAccounts: AccountEntity[];

  beforeEach(() => {
    vi.clearAllMocks(); // Clears all mocks, including spies

    mockAccounts = [
      { id: 'acc_existing_1', name: 'Existing Checking', account_id: '123456789', offbudget: 0, closed: 0 },
      { id: 'acc_existing_2', name: 'Existing Savings', account_id: '987654321', offbudget: 0, closed: 0 },
    ] as AccountEntity[]; // Cast to AccountEntity[] as other fields are not needed for these tests

    // Reset console spies specifically if needed, though clearAllMocks should handle them
    // mockConsoleLog.mockClear();
    // mockConsoleWarn.mockClear();
    // mockConsoleError.mockClear();
  });

  it('Test 1: Finds Existing Account by extractedAccountNumber', async () => {
    const extractedAccountNumber = '123456789';
    const result = await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      null,
      mockAccounts,
    );

    expect(result).toBe('acc_existing_1');
    expect(mainApp.handlers['account-create']).not.toHaveBeenCalled();
    expect(mainApp.handlers['rule-add']).not.toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(`findOrCreateAccountByDetails: Found existing account by account_id: acc_existing_1 for number ${extractedAccountNumber}`);
  });

  it('Test 2: Creates New Account (Credit Card)', async () => {
    const extractedAccountNumber = 'NEW_CC_ACCOUNT_1234';
    const extractedAccountType = 'CREDITCARD';
    const newMockAccountId = 'new_mock_cc_id';

    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue(newMockAccountId);

    const result = await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      extractedAccountType,
      mockAccounts,
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledTimes(1);
    expect(mainApp.handlers['account-create']).toHaveBeenCalledWith({
      name: 'Credit Card ...1234',
      balance: 0,
      offBudget: false,
    });
    expect(db.updateAccount).toHaveBeenCalledWith({ id: newMockAccountId, account_id: extractedAccountNumber });
    expect(result).toBe(newMockAccountId);
    // Rule creation will be tested in Test 5
  });

  it('Test 3: Creates New Account (Investment, offBudget)', async () => {
    const extractedAccountNumber = 'NEW_INV_ACCOUNT_5678';
    const extractedAccountType = 'INVESTMENT';
    const newMockAccountId = 'new_mock_inv_id';

    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue(newMockAccountId);

    const result = await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      extractedAccountType,
      mockAccounts,
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledTimes(1);
    expect(mainApp.handlers['account-create']).toHaveBeenCalledWith({
      name: 'Investment ...5678',
      balance: 0,
      offBudget: true,
    });
    expect(db.updateAccount).toHaveBeenCalledWith({ id: newMockAccountId, account_id: extractedAccountNumber });
    expect(result).toBe(newMockAccountId);
  });

  it('Test 4: Creates New Account (no account type provided)', async () => {
    const extractedAccountNumber = 'NEW_GENERIC_ACCOUNT_9012';
    const newMockAccountId = 'new_mock_generic_id';

    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue(newMockAccountId);

    const result = await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      null, // No type
      mockAccounts,
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledTimes(1);
    expect(mainApp.handlers['account-create']).toHaveBeenCalledWith({
      name: 'Account ...9012',
      balance: 0,
      offBudget: false, // Default
    });
    expect(db.updateAccount).toHaveBeenCalledWith({ id: newMockAccountId, account_id: extractedAccountNumber });
    expect(result).toBe(newMockAccountId);
  });
  
  it('Test 5: Rule Creation on New Account Success', async () => {
    const extractedAccountNumber = 'NEW_RULE_ACCOUNT_3456';
    const extractedAccountType = 'CHECKING';
    const newMockAccountId = 'new_mock_rule_id';
    const last4Digits = extractedAccountNumber.slice(-4);

    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue(newMockAccountId);
    (mainApp.handlers['rule-add'] as ReturnType<typeof vi.fn>).mockResolvedValue(undefined); // Simulate successful rule add

    await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      extractedAccountType,
      mockAccounts,
    );

    expect(mainApp.handlers['rule-add']).toHaveBeenCalledTimes(1);
    expect(mainApp.handlers['rule-add']).toHaveBeenCalledWith({
      name: `Auto-assign: Acct ...${last4Digits} (Payee heuristic)`,
      stage: null,
      conditionsOp: 'and',
      conditions: [
        {
          field: 'imported_payee',
          op: 'contains',
          value: last4Digits,
          type: 'string',
        },
      ],
      actions: [
        {
          op: 'set',
          field: 'account',
          value: newMockAccountId,
          type: 'id',
        },
      ],
    });
  });

  it('Test 6: Handles Empty or Null extractedAccountNumber', async () => {
    const testCases = [null, undefined, ""];
    for (const testValue of testCases) {
      vi.clearAllMocks(); // Reset for each case
      const result = await findOrCreateAccountByDetails(
        testValue as string, // Cast to avoid TS error, handled by func
        null,
        null,
        mockAccounts,
      );
      expect(result).toBeNull();
      expect(mainApp.handlers['account-create']).not.toHaveBeenCalled();
      expect(mainApp.handlers['rule-add']).not.toHaveBeenCalled();
      if (testValue !== null && testValue !== undefined) { // Only warn for empty string
         expect(mockConsoleWarn).toHaveBeenCalledWith('findOrCreateAccountByDetails: extractedAccountNumber is empty or invalid.');
      }
    }
  });

  it('Test 7: Rule Creation Fails Gracefully', async () => {
    const extractedAccountNumber = 'NEW_RULE_FAIL_ACCOUNT_7890';
    const extractedAccountType = 'SAVINGS';
    const newMockAccountId = 'new_mock_rule_fail_id';
    const ruleAddError = new Error('Rule creation failed!');

    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue(newMockAccountId);
    (mainApp.handlers['rule-add'] as ReturnType<typeof vi.fn>).mockRejectedValue(ruleAddError);

    const result = await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      extractedAccountType,
      mockAccounts,
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledTimes(1);
    expect(db.updateAccount).toHaveBeenCalledWith({ id: newMockAccountId, account_id: extractedAccountNumber });
    expect(result).toBe(newMockAccountId); // Account creation should still succeed
    expect(mainApp.handlers['rule-add']).toHaveBeenCalledTimes(1); // It was attempted
    expect(mockConsoleError).toHaveBeenCalledWith(
      `findOrCreateAccountByDetails: Failed to create heuristic rule "Auto-assign: Acct ...7890 (Payee heuristic)" for new account ${newMockAccountId}:`,
      ruleAddError,
    );
  });
});

// Test for title casing, assuming title is imported from './title'
// This test is only relevant if title is used, which it might be if accountType is not one of the explicitly handled ones.
// The provided code for findOrCreateAccountByDetails in the prompt does use title,
// so this test remains relevant.
vi.mock('./title', () => ({
  title: vi.fn(str => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()),
}));
import { title } from './title'; // Import after mock setup

describe('findOrCreateAccountByDetails - Account Naming with title()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mainApp.handlers['account-create'] as ReturnType<typeof vi.fn>).mockResolvedValue('some_new_id');
    (db.updateAccount as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mainApp.handlers['rule-add'] as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('Creates New Account with title-cased type when type is unknown', async () => {
    const extractedAccountNumber = 'NEW_UNKNOWN_TYPE_1122';
    const extractedAccountType = 'OTHERTYPE'; // An "unknown" type
    
    await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      extractedAccountType,
      [], // No existing accounts
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledWith({
      name: 'Othertype ...1122', // Assuming title function works as mocked
      balance: 0,
      offBudget: false,
    });
    expect(title).toHaveBeenCalledWith('OTHERTYPE');
  });

   it('Creates New Account with default "Account" name if type is null and not otherwise determined', async () => {
    const extractedAccountNumber = 'NEW_NO_TYPE_3344';
    
    await findOrCreateAccountByDetails(
      extractedAccountNumber,
      null,
      null, // No type
      [], // No existing accounts
    );

    expect(mainApp.handlers['account-create']).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Account ...3344',
      }),
    );
  });
});
