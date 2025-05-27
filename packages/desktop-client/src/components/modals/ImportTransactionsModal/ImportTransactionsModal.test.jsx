import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ImportTransactionsModal } from './ImportTransactionsModal';
import { send } from 'loot-core/platform/client/fetch';
import * as redux from '@desktop-client/redux';
import * as useSyncedPrefsMod from '@desktop-client/hooks/useSyncedPrefs';
import * as useCategoriesMod from '@desktop-client/hooks/useCategories';
import * as useDateFormatMod from '@desktop-client/hooks/useDateFormat';
import 'react-i18next'; // Mocked below

// --- Mocking Dependencies ---
vi.mock('loot-core/platform/client/fetch', () => ({
  send: vi.fn(),
}));

const mockDispatch = vi.fn();
vi.mock('@desktop-client/redux', async () => {
  const actual = await vi.importActual('@desktop-client/redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
    useSelector: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: str => str,
    i18n: { changeLanguage: () => new Promise(() => {}) },
  }),
  Trans: ({ children }) => children,
}));

vi.mock('@desktop-client/hooks/useSyncedPrefs', () => ({
  useSyncedPrefs: vi.fn(() => [{ /* prefs object */ }, vi.fn()]),
}));

vi.mock('@desktop-client/hooks/useCategories', () => ({
  useCategories: vi.fn(() => ({ list: [], grouped: [] })),
}));

vi.mock('@desktop-client/hooks/useDateFormat', () => ({
  useDateFormat: vi.fn(() => 'MM/dd/yyyy'),
}));

vi.mock('@desktop-client/queries/queriesSlice', () => ({
  importPreviewTransactions: vi.fn(() => ({ type: 'mock/importPreview', unwrap: vi.fn().mockResolvedValue([]) })),
  importTransactions: vi.fn(() => ({ type: 'mock/importTransactions', unwrap: vi.fn().mockResolvedValue(true) })),
  getPayees: vi.fn(() => ({ type: 'mock/getPayees' })),
}));

// --- Test Data ---
const mockAccountsList = [
  { id: 'acc1', name: 'Account 1 Name (Checking)', closed: false, account_id: 'OFX_ACC_1' },
  { id: 'acc2', name: 'Account 2 Name (Savings)', closed: false, account_id: 'OFX_ACC_2' },
  { id: 'acc3', name: 'Account 3 Name (Credit Card)', closed: false, account_id: 'OFX_ACC_3' },
];

const baseTransaction = {
  selected: true,
  isMatchedTransaction: false,
  account: null, // Important for conflict detection
  payee_name: 'Some Payee',
  imported_payee: 'Some Payee Raw',
  notes: 'Transaction notes',
  // Fields from OFX/QFX parsing
  extractedAccountNumber: null,
  extractedBankId: null,
  extractedAccountType: null,
  // Fields from QIF parsing
  extractedAccountName: null,
};

describe('ImportTransactionsModal', () => {
  const defaultProps = {
    filename: 'test.ofx', // Default to OFX, can override per test
    accountId: null, // Default to 'All Accounts'
    onImported: vi.fn(),
    // Modal component usually requires a modalProps from ModalStack
    modalProps: {
      currentOptions: {},
      currentName: "import-transactions",
      stack: [{ name: "import-transactions", options: {} }],
      isHidden: false,
      isOpaque: true,
      onClose: vi.fn(),
      onPush: vi.fn(),
      onReplace: vi.fn(),
      onPop: vi.fn(),
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redux.useSelector.mockReturnValue({ list: mockAccountsList }); // Default for state.queries.accounts

    // Default mock for send
    send.mockImplementation(async (messageType, args) => {
      if (messageType === 'transactions-parse-file') {
        return { errors: [], transactions: [] }; // Default empty transactions
      }
      if (messageType === 'transactions-find-potential-accounts') {
        return { potentialAccountIds: [] }; // Default no conflicts
      }
      if (messageType === 'accounts-get') { // Should not be called if useSelector works
        return mockAccountsList;
      }
      // Mock for importPreviewTransactions, which is called by getImportPreview
      if (mockDispatch && mockDispatch.mock.calls.some(call => call[0]?.type === 'mock/importPreview')) {
         return []; // Default for unwrap
      }
      return {};
    });
    
    // Mock for importPreviewTransactions thunk
    mockDispatch.mockImplementation(action => {
      if (typeof action === 'function') { // It's a thunk
        const unwrap = vi.fn().mockResolvedValue([]); // Mock unwrap for importPreviewTransactions
        return action(mockDispatch, vi.fn(), undefined).then(() => ({ unwrap }));
      }
      return Promise.resolve({ unwrap: vi.fn().mockResolvedValue([]) }); // Default for other actions
    });
  });

  // Helper to set up parsing with specific transactions
  const setupParseFileMock = (transactions) => {
    send.mockImplementation(async (messageType, args) => {
      if (messageType === 'transactions-parse-file') {
        return { errors: [], transactions: JSON.parse(JSON.stringify(transactions)) };
      }
      if (messageType === 'transactions-find-potential-accounts') {
        // Default for this helper, can be overridden by individual tests
        return { potentialAccountIds: [] }; 
      }
      if (messageType === 'accounts-get') {
         return mockAccountsList;
      }
      return {};
    });
  };

  describe('Scenario 1: No Conflicts', () => {
    it('Test 1.1: Single Account Import - no conflict detection', async () => {
      const transactionsToParse = [
        { ...baseTransaction, trx_id: 't1', date: '2023-01-01', amount: -1000 },
      ];
      setupParseFileMock(transactionsToParse);

      render(<ImportTransactionsModal {...defaultProps} accountId="acc1" />);
      
      await waitFor(() => expect(screen.getByText('Import transactions (OFX)')).toBeVisible());
      await waitFor(() => expect(screen.queryByText('No transactions found')).toBeNull());
      
      expect(send).not.toHaveBeenCalledWith('transactions-find-potential-accounts');
      expect(screen.queryByText('Resolve Transaction Conflicts')).toBeNull();
      const importButton = screen.getByRole('button', { name: /Import \d+ transactions/i });
      expect(importButton).toBeEnabled();
    });

    it("Test 1.2: 'All Accounts' Import - No Ambiguity", async () => {
      const transactionsToParse = [
        { ...baseTransaction, trx_id: 't1', date: '2023-01-01', amount: -1000, extractedAccountNumber: 'OFX_ACC_1' },
        { ...baseTransaction, trx_id: 't2', date: '2023-01-02', amount: -500, payee_name: 'Unique Payee' },
      ];
      send.mockImplementation(async (messageType, args) => {
        if (messageType === 'transactions-parse-file') {
          return { errors: [], transactions: JSON.parse(JSON.stringify(transactionsToParse)) };
        }
        if (messageType === 'transactions-find-potential-accounts') {
          if (args.extractedAccountNumber === 'OFX_ACC_1') return { potentialAccountIds: ['acc1'] };
          if (args.payeeName === 'Unique Payee') return { potentialAccountIds: ['acc2'] };
          return { potentialAccountIds: [] };
        }
        return {};
      });

      render(<ImportTransactionsModal {...defaultProps} accountId={null} />);
      await waitFor(() => expect(screen.queryByText('No transactions found')).toBeNull(), { timeout: 2000 });

      expect(screen.queryByText('Resolve Transaction Conflicts')).toBeNull();
      const importButton = screen.getByRole('button', { name: /Import \d+ transactions/i });
      expect(importButton).toBeEnabled();
    });
  });

  describe('Scenario 2: Conflict Detection and UI', () => {
    const conflictedTransactions = [
      { ...baseTransaction, trx_id: 'c_t1', date: '2023-02-01', payee_name: 'Conflicted Vendor 1', amount: -1500, extractedAccountNumber: 'CONFLICT_ACC' },
      { ...baseTransaction, trx_id: 'c_t2', date: '2023-02-02', payee_name: 'Vendor Normal', amount: -500, extractedAccountNumber: 'OFX_ACC_3' },
    ];

    beforeEach(() => {
      send.mockImplementation(async (messageType, args) => {
        if (messageType === 'transactions-parse-file') {
          return { errors: [], transactions: JSON.parse(JSON.stringify(conflictedTransactions)) };
        }
        if (messageType === 'transactions-find-potential-accounts') {
          if (args?.extractedAccountNumber === 'CONFLICT_ACC') {
            return { potentialAccountIds: ['acc1', 'acc2'] }; // Conflict for c_t1
          }
          if (args?.extractedAccountNumber === 'OFX_ACC_3') {
            return { potentialAccountIds: ['acc3'] }; // No conflict for c_t2
          }
          return { potentialAccountIds: [] };
        }
        return {};
      });
    });

    it('Test 2.1: Detects Conflicts (All Accounts)', async () => {
      render(<ImportTransactionsModal {...defaultProps} accountId={null} />);
      
      await waitFor(() => expect(screen.getByText('Resolve Transaction Conflicts')).toBeVisible());
      expect(screen.getByText(/Conflicted Vendor 1/)).toBeVisible();
      // Check that "Vendor Normal" (c_t2) is in the main table, not conflict section, by ensuring only one conflict selector
      const conflictSelects = screen.getAllByRole('combobox');
      expect(conflictSelects.length).toBe(1); // Only one conflict item (c_t1)
    });

    it('Test 2.2: Renders Conflict Resolution UI', async () => {
      render(<ImportTransactionsModal {...defaultProps} accountId={null} />);

      await waitFor(() => expect(screen.getByText('Resolve Transaction Conflicts')).toBeVisible());
      
      expect(screen.getByText(/Conflicted Vendor 1/)).toBeVisible();
      // Amount formatting depends on Intl, this is a basic check
      expect(screen.getByText(val => val.includes('-15.00') || val.includes('-1,500.00'))).toBeVisible(); 

      const selectDropdown = screen.getAllByRole('combobox')[0];
      expect(selectDropdown).toBeVisible();
      fireEvent.mouseDown(selectDropdown);
      await waitFor(() => {
        expect(screen.getByText('Account 1 Name (Checking)')).toBeVisible(); // Option text
        expect(screen.getByText('Account 2 Name (Savings)')).toBeVisible();  // Option text
      });
      
      const importButton = screen.getByRole('button', { name: /Import \d+ transactions/i });
      expect(importButton).toBeDisabled();
      
      const confirmButton = screen.getByRole('button', { name: 'Confirm Resolutions' });
      expect(confirmButton).toBeVisible();
      expect(confirmButton).toBeDisabled();
    });
  });
  
  describe('Scenario 3: Conflict Resolution Flow', () => {
    const singleConflictTransaction = [
      { ...baseTransaction, trx_id: 'res_t1', date: '2023-03-01', payee_name: 'Resolvable Vendor', amount: -2500, extractedAccountNumber: 'RESOLVE_ME' },
    ];

    beforeEach(() => {
      send.mockImplementation(async (messageType, args) => {
        if (messageType === 'transactions-parse-file') {
          return { errors: [], transactions: JSON.parse(JSON.stringify(singleConflictTransaction)) };
        }
        if (messageType === 'transactions-find-potential-accounts') {
          if (args?.extractedAccountNumber === 'RESOLVE_ME') {
            return { potentialAccountIds: ['acc1', 'acc2'] };
          }
          return { potentialAccountIds: [] };
        }
        return {};
      });
    });

    it('Test 3.1: User Resolves a Conflict', async () => {
      render(<ImportTransactionsModal {...defaultProps} accountId={null} />);
      await waitFor(() => expect(screen.getByText('Resolve Transaction Conflicts')).toBeVisible());

      const selectDropdown = screen.getByRole('combobox');
      // Simulate selecting 'acc1'
      // For antd-like Select, this involves clicking to open, then clicking the option.
      // For a simple HTML select, fireEvent.change is enough.
      // Assuming the Select component updates its value internally upon choosing an option.
      // The actual mechanism might require finding the option and clicking it.
      // Let's assume a simple fireEvent.change works for the mocked Select.
      fireEvent.change(selectDropdown, { target: { value: 'acc1' } });
      
      const confirmButton = screen.getByRole('button', { name: 'Confirm Resolutions' });
      await waitFor(() => expect(confirmButton).toBeEnabled());
    });

    it('Test 3.2: "Confirm Resolutions" Button Click', async () => {
      render(<ImportTransactionsModal {...defaultProps} accountId={null} />);
      await waitFor(() => expect(screen.getByText('Resolve Transaction Conflicts')).toBeVisible());

      const selectDropdown = screen.getByRole('combobox');
      fireEvent.change(selectDropdown, { target: { value: 'acc1' } }); // Resolve the conflict

      const confirmButton = screen.getByRole('button', { name: 'Confirm Resolutions' });
      await waitFor(() => expect(confirmButton).toBeEnabled());
      
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Resolve Transaction Conflicts')).toBeNull();
      });
      
      const importButton = screen.getByRole('button', { name: /Import \d+ transactions/i });
      expect(importButton).toBeEnabled();
      // Further assertion: The `onImport` prop would eventually be called with transactions where
      // `res_t1` has its `account` property set to 'acc1'. This requires spying on `onImport`
      // or checking the arguments if `onImport` is called immediately.
      // For now, UI change is the primary assertion.
    });
  });
});
