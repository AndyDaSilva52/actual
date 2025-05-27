import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Stack } from '@actual-app/components/stack';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import deepEqual from 'deep-equal';

import { send } from 'loot-core/platform/client/fetch';
import { amountToInteger } from 'loot-core/shared/util';

import { CheckboxOption } from './CheckboxOption';
import { DateFormatSelect } from './DateFormatSelect';
import { FieldMappings } from './FieldMappings';
import { InOutOption } from './InOutOption';
import { MultiplierOption } from './MultiplierOption';
import { Transaction } from './Transaction';
import {
  applyFieldMappings,
  dateFormats,
  parseAmountFields,
  parseDate,
  stripCsvImportTransaction,
} from './utils';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
} from '@desktop-client/components/common/Modal';
import { SectionLabel } from '@desktop-client/components/forms';
import {
  TableHeader,
  TableWithNavigator,
} from '@desktop-client/components/table';
import { useCategories } from '@desktop-client/hooks/useCategories';
import { useDateFormat } from '@desktop-client/hooks/useDateFormat';
import { useSyncedPrefs } from '@desktop-client/hooks/useSyncedPrefs';
import {
  getPayees,
  importPreviewTransactions,
  importTransactions,
} from '@desktop-client/queries/queriesSlice';
import { useDispatch, useSelector } from '@desktop-client/redux';
import {เงิน} from '@actual-app/icons/v1'; // Using a placeholder for currency icon, replace if a better one exists

function getFileType(filepath) {
  const m = filepath.match(/\.([^.]*)$/);
  if (!m) return 'ofx';
  const rawType = m[1].toLowerCase();
  if (rawType === 'tsv') return 'csv';
  return rawType;
}

function getInitialDateFormat(transactions, mappings) {
  if (transactions.length === 0 || mappings.date == null) {
    return 'yyyy mm dd';
  }

  const transaction = transactions[0];
  const date = transaction[mappings.date];

  const found =
    date == null
      ? null
      : dateFormats.find(f => parseDate(date, f.format) != null);
  return found ? found.format : 'mm dd yyyy';
}

function getInitialMappings(transactions) {
  if (transactions.length === 0) {
    return {};
  }

  const transaction = stripCsvImportTransaction(transactions[0]);
  const fields = Object.entries(transaction);

  function key(entry) {
    return entry ? entry[0] : null;
  }

  const dateField = key(
    fields.find(([name]) => name.toLowerCase().includes('date')) ||
      fields.find(([, value]) => String(value)?.match(/^\d+[-/]\d+[-/]\d+$/)),
  );

  const amountField = key(
    fields.find(([name]) => name.toLowerCase().includes('amount')) ||
      fields.find(([, value]) => String(value)?.match(/^-?[.,\d]+$/)),
  );

  const categoryField = key(
    fields.find(([name]) => name.toLowerCase().includes('category')),
  );

  const payeeField = key(
    fields.find(([name]) => name.toLowerCase().includes('payee')) ||
      fields.find(
        ([name]) =>
          name !== dateField && name !== amountField && name !== categoryField,
      ),
  );

  const notesField = key(
    fields.find(([name]) => name.toLowerCase().includes('notes')) ||
      fields.find(
        ([name]) =>
          name !== dateField &&
          name !== amountField &&
          name !== categoryField &&
          name !== payeeField,
      ),
  );

  const inOutField = key(
    fields.find(
      ([name]) =>
        name !== dateField &&
        name !== amountField &&
        name !== payeeField &&
        name !== notesField,
    ),
  );

  return {
    date: dateField,
    amount: amountField,
    payee: payeeField,
    notes: notesField,
    inOut: inOutField,
    category: categoryField,
  };
}

function parseCategoryFields(trans, categories) {
  let match = null;
  categories.forEach(category => {
    if (category.id === trans.category) {
      return null;
    }
    if (category.name === trans.category) {
      match = category.id;
    }
  });
  return match;
}

export function ImportTransactionsModal({
  filename: originalFileName,
  accountId,
  onImported,
}) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [prefs, savePrefs] = useSyncedPrefs();
  const dispatch = useDispatch();
  const categories = useCategories();
  const allAccounts = useSelector(state => state.queries.accounts); // Fetch all accounts

  const [multiplierAmount, setMultiplierAmount] = useState('');
  const [loadingState, setLoadingState] = useState('parsing');
  const [error, setError] = useState(null);
  const [filename, setFilename] = useState(originalFileName);
  const [transactions, setTransactions] = useState([]);
  const [filetype, setFileType] = useState(null);
  const [fieldMappings, setFieldMappings] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [flipAmount, setFlipAmount] = useState(false);
  const [multiplierEnabled, setMultiplierEnabled] = useState(false);
  const [reconcile, setReconcile] = useState(true);
  const [importNotes, setImportNotes] = useState(true);

  // This cannot be set after parsing the file, because changing it
  // requires re-parsing the file. This is different from the other
  // options which are simple post-processing. That means if you
  // parsed different files without closing the modal, it wouldn't
  // re-read this.
  const accountPrefsKey = accountId || 'all';
  const [delimiter, setDelimiter] = useState(
    prefs[`csv-delimiter-${accountPrefsKey}`] ||
      (filename.endsWith('.tsv') ? '\t' : ','),
  );
  const [skipLines, setSkipLines] = useState(
    parseInt(prefs[`csv-skip-lines-${accountPrefsKey}`], 10) || 0,
  );
  const [inOutMode, setInOutMode] = useState(
    String(prefs[`csv-in-out-mode-${accountPrefsKey}`]) === 'true',
  );
  const [outValue, setOutValue] = useState(
    prefs[`csv-out-value-${accountPrefsKey}`] ?? '',
  );
  const [hasHeaderRow, setHasHeaderRow] = useState(
    String(prefs[`csv-has-header-${accountPrefsKey}`]) !== 'false',
  );
  const [fallbackMissingPayeeToMemo, setFallbackMissingPayeeToMemo] = useState(
    String(prefs[`ofx-fallback-missing-payee-${accountPrefsKey}`]) !== 'false',
  );

  const [parseDateFormat, setParseDateFormat] = useState(null);

  const [clearOnImport, setClearOnImport] = useState(true);
  const [conflicts, setConflicts] = useState(new Map());
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);

  const getImportPreview = useCallback(
    async (
      transactions,
      filetype,
      flipAmount,
      fieldMappings,
      splitMode,
      parseDateFormat,
      inOutMode,
      outValue,
      multiplierAmount,
    ) => {
      const previewTransactions = [];
      const inOutModeEnabled = isOfxFile(filetype) ? false : inOutMode;

      for (let trans of transactions) {
        if (trans.isMatchedTransaction) {
          // skip transactions that are matched transaction (existing transaction added to show update changes)
          continue;
        }

        trans = fieldMappings
          ? applyFieldMappings(trans, fieldMappings)
          : trans;

        const date = isOfxFile(filetype)
          ? trans.date
          : parseDate(trans.date, parseDateFormat);
        if (date == null) {
          console.log(
            `Unable to parse date ${
              trans.date || '(empty)'
            } with given date format`,
          );
          break;
        }
        if (trans.payee_name == null || typeof trans.payee_name !== 'string') {
          console.log(`Unable·to·parse·payee·${trans.payee_name || '(empty)'}`);
          break;
        }

        const { amount } = parseAmountFields(
          trans,
          splitMode,
          inOutModeEnabled,
          outValue,
          flipAmount,
          multiplierAmount,
        );
        if (amount == null) {
          console.log(`Transaction on ${trans.date} has no amount`);
          break;
        }

        const category_id = parseCategoryFields(trans, categories.list);
        if (category_id != null) {
          trans.category = category_id;
        }

        const {
          inflow,
          outflow,
          inOut,
          existing,
          ignored,
          selected,
          selected_merge,
          ...finalTransaction
        } = trans;
        previewTransactions.push({
          ...finalTransaction,
          date,
          amount: amountToInteger(amount),
          cleared: clearOnImport,
        });
      }

      // Retreive the transactions that would be updated (along with the existing trx)
      const previewTrx = await dispatch(
        importPreviewTransactions({
          accountId,
          transactions: previewTransactions,
        }),
      ).unwrap();
      const matchedUpdateMap = previewTrx.reduce((map, entry) => {
        map[entry.transaction.trx_id] = entry;
        return map;
      }, {});

      return transactions
        .filter(trans => !trans.isMatchedTransaction)
        .reduce((previous, current_trx) => {
          let next = previous;
          const entry = matchedUpdateMap[current_trx.trx_id];
          const existing_trx = entry?.existing;

          // if the transaction is matched with an existing one for update
          current_trx.existing = !!existing_trx;
          // if the transaction is an update that will be ignored
          // (reconciled transactions or no change detected)
          current_trx.ignored = entry?.ignored || false;

          current_trx.selected = !current_trx.ignored;
          current_trx.selected_merge = current_trx.existing;

          next = next.concat({ ...current_trx });

          if (existing_trx) {
            // add the updated existing transaction in the list, with the
            // isMatchedTransaction flag to identify it in display and not send it again
            existing_trx.isMatchedTransaction = true;
            existing_trx.category = categories.list.find(
              cat => cat.id === existing_trx.category,
            )?.name;
            // add parent transaction attribute to mimic behaviour
            existing_trx.trx_id = current_trx.trx_id;
            existing_trx.existing = current_trx.existing;
            existing_trx.selected = current_trx.selected;
            existing_trx.selected_merge = current_trx.selected_merge;

            next = next.concat({ ...existing_trx });
          }

          return next;
        }, []);
    },
    [accountId, categories.list, clearOnImport, dispatch],
  );

  const parse = useCallback(
    async (filename, options) => {
      setLoadingState('parsing');

      const filetype = getFileType(filename);
      setFilename(filename);
      setFileType(filetype);

      const { errors, transactions: parsedTransactions = [] } = await send(
        'transactions-parse-file',
        {
          filepath: filename,
          options,
        },
      );

      let index = 0;
      const transactions = parsedTransactions.map(trans => {
        // Add a transient transaction id to match preview with imported transactions
        trans.trx_id = index++;
        // Select all parsed transactions before first preview run
        trans.selected = true;
        return trans;
      });

      setLoadingState(null);
      setError(null);

      /// Do fine grained reporting between the old and new OFX importers.
      if (errors.length > 0) {
        setError({
          parsed: true,
          message: errors[0].message || 'Internal error',
        });
      } else {
        let flipAmount = false;
        let fieldMappings = null;
        let splitMode = false;
        let parseDateFormat = null;

        if (filetype === 'csv' || filetype === 'qif') {
          flipAmount =
            String(prefs[`flip-amount-${accountPrefsKey}-${filetype}`]) ===
            'true';
          setFlipAmount(flipAmount);
        }

        if (filetype === 'csv') {
          let mappings = prefs[`csv-mappings-${accountPrefsKey}`];
          mappings = mappings
            ? JSON.parse(mappings)
            : getInitialMappings(transactions);

          fieldMappings = mappings;
          setFieldMappings(mappings);

          // Set initial split mode based on any saved mapping
          splitMode = !!(mappings.outflow || mappings.inflow);
          setSplitMode(splitMode);

          parseDateFormat =
            prefs[`parse-date-${accountPrefsKey}-${filetype}`] ||
            getInitialDateFormat(transactions, mappings);
          setParseDateFormat(parseDateFormat);
        } else if (filetype === 'qif') {
          parseDateFormat =
            prefs[`parse-date-${accountPrefsKey}-${filetype}`] ||
            getInitialDateFormat(transactions, { date: 'date' });
          setParseDateFormat(parseDateFormat);
        } else {
          setFieldMappings(null);
          setParseDateFormat(null);
        }

        // Reverse the transactions because it's very common for them to
        // be ordered ascending, but we show transactions descending by
        // date. This is purely cosmetic.
        const transactionPreview = await getImportPreview(
          transactions.reverse(),
          filetype,
          flipAmount,
          fieldMappings,
          splitMode,
          parseDateFormat,
          inOutMode,
          outValue,
          multiplierAmount,
        );
        setTransactions(transactionPreview);

        // Conflict detection for 'All Accounts'
        if (accountId == null && transactionPreview.length > 0) {
          let newConflicts = new Map();
          let foundConflicts = false;

          for (const trans of transactionPreview) {
            // Only check transactions that don't have an account pre-assigned
            // and are selected for import.
            if (!trans.account && trans.selected && !trans.isMatchedTransaction) {
              const { potentialAccountIds } = await send(
                'transactions-find-potential-accounts',
                {
                  payeeName: trans.payee_name, // Assuming payee_name is the relevant field
                  importedPayee: trans.imported_payee,
                  extractedAccountNumber: trans.extractedAccountNumber,
                  // Consider adding amount and date if the backend handler uses them
                },
              );

              if (potentialAccountIds && potentialAccountIds.length > 1) {
                const potentialAccounts = allAccounts.list.filter(acc =>
                  potentialAccountIds.includes(acc.id),
                );
                if (potentialAccounts.length > 1) {
                  newConflicts.set(trans.trx_id, {
                    transaction: trans,
                    potentialAccounts,
                    resolvedAccountId: null,
                  });
                  foundConflicts = true;
                }
              } else if (potentialAccountIds && potentialAccountIds.length === 1) {
                // Auto-assign if only one potential account is found
                // This might be better done after explicit resolution if any other conflicts exist
                // For now, let's assume we only set conflicts for >1
              }
            }
          }

          if (foundConflicts) {
            setConflicts(newConflicts);
            setIsResolvingConflicts(true);
          } else {
            setIsResolvingConflicts(false); // Ensure it's reset if no conflicts found
            setConflicts(new Map()); // Clear any old conflicts
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, getImportPreview, prefs, allAccounts.list], // Added allAccounts.list
  );
  
  const handleConflictResolution = (trxId, resolvedAccountId) => {
    setConflicts(prevConflicts => {
      const newConflicts = new Map(prevConflicts);
      const conflict = newConflicts.get(trxId);
      if (conflict) {
        newConflicts.set(trxId, { ...conflict, resolvedAccountId });
      }
      return newConflicts;
    });
  };

  const confirmConflictResolutions = () => {
    let updatedTransactions = [...transactions];
    let allResolved = true;

    conflicts.forEach((conflict, trxId) => {
      if (conflict.resolvedAccountId) {
        updatedTransactions = updatedTransactions.map(t =>
          t.trx_id === trxId
            ? { ...t, account: conflict.resolvedAccountId }
            : t,
        );
      } else {
        allResolved = false; // Should not happen if button is correctly disabled
      }
    });
    
    if(allResolved) {
      setTransactions(updatedTransactions);
      setIsResolvingConflicts(false);
      setConflicts(new Map());
      // After resolutions, it's good to run the import preview again
      // to reflect any changes in matching due to account assignment.
      // However, runImportPreview itself doesn't take new transactions as param.
      // For now, we assume the main import process will use the updated transactions.
    }
  };


  function onMultiplierChange(e) {
    const amt = e;
    if (!amt || amt.match(/^\d{1,}(\.\d{0,4})?$/)) {
      setMultiplierAmount(amt);
      runImportPreview();
    }
  }

  useEffect(() => {
    const fileType = getFileType(originalFileName);
    const parseOptions = getParseOptions(fileType, {
      delimiter,
      hasHeaderRow,
      skipLines,
      fallbackMissingPayeeToMemo,
      importNotes,
    });

    parse(originalFileName, parseOptions);
  }, [
    originalFileName,
    delimiter,
    hasHeaderRow,
    skipLines,
    fallbackMissingPayeeToMemo,
    importNotes,
    parse,
  ]);

  function onSplitMode() {
    if (fieldMappings == null) {
      return;
    }

    const isSplit = !splitMode;
    setSplitMode(isSplit);

    // Run auto-detection on the fields to try to detect the fields
    // automatically
    const mappings = getInitialMappings(transactions);

    const newFieldMappings = isSplit
      ? {
          amount: null,
          outflow: mappings.amount,
          inflow: null,
        }
      : {
          amount: mappings.amount,
          outflow: null,
          inflow: null,
        };
    setFieldMappings({ ...fieldMappings, ...newFieldMappings });
  }

  async function onNewFile() {
    const res = await window.Actual.openFileDialog({
      filters: [
        {
          name: 'Financial Files',
          extensions: ['qif', 'ofx', 'qfx', 'csv', 'tsv', 'xml'],
        },
      ],
    });

    const fileType = getFileType(res[0]);
    const parseOptions = getParseOptions(fileType, {
      delimiter,
      hasHeaderRow,
      skipLines,
      fallbackMissingPayeeToMemo,
      importNotes,
    });

    parse(res[0], parseOptions);
  }

  function onUpdateFields(field, name) {
    const newFieldMappings = {
      ...fieldMappings,
      [field]: name === '' ? null : name,
    };
    setFieldMappings(newFieldMappings);
    runImportPreview();
  }

  function onCheckTransaction(trx_id) {
    const newTransactions = transactions.map(trans => {
      if (trans.trx_id === trx_id) {
        if (trans.existing) {
          // 3-states management for transactions with existing (merged transactions)
          // flow of states:
          // (selected true && selected_merge true)
          //   => (selected true && selected_merge false)
          //     => (selected false)
          //       => back to (selected true && selected_merge true)
          if (!trans.selected) {
            return {
              ...trans,
              selected: true,
              selected_merge: true,
            };
          } else if (trans.selected_merge) {
            return {
              ...trans,
              selected: true,
              selected_merge: false,
            };
          } else {
            return {
              ...trans,
              selected: false,
              selected_merge: false,
            };
          }
        } else {
          return {
            ...trans,
            selected: !trans.selected,
          };
        }
      }
      return trans;
    });

    setTransactions(newTransactions);
  }

  async function onImport(close) {
    setLoadingState('importing');

    const finalTransactions = [];
    let errorMessage;

    for (let trans of transactions) {
      if (
        trans.isMatchedTransaction ||
        (reconcile && !trans.selected && !trans.ignored)
      ) {
        // skip transactions that are
        // - matched transaction (existing transaction added to show update changes)
        // - unselected transactions that are not ignored by the reconcilation algorithm (only when reconcilation is enabled)
        continue;
      }

      trans = fieldMappings ? applyFieldMappings(trans, fieldMappings) : trans;

      const date =
        isOfxFile(filetype) || isCamtFile(filetype)
          ? trans.date
          : parseDate(trans.date, parseDateFormat);
      if (date == null) {
        errorMessage = `Unable to parse date ${
          trans.date || '(empty)'
        } with given date format`;
        break;
      }

      const { amount } = parseAmountFields(
        trans,
        splitMode,
        isOfxFile(filetype) ? false : inOutMode,
        outValue,
        flipAmount,
        multiplierAmount,
      );
      if (amount == null) {
        errorMessage = `Transaction on ${trans.date} has no amount`;
        break;
      }

      const category_id = parseCategoryFields(trans, categories.list);
      trans.category = category_id;

      const {
        inflow,
        outflow,
        inOut,
        existing,
        ignored,
        selected,
        selected_merge,
        trx_id,
        ...finalTransaction
      } = trans;

      if (
        reconcile &&
        ((trans.ignored && trans.selected) ||
          (trans.existing && trans.selected && !trans.selected_merge))
      ) {
        // in reconcile mode, force transaction add for
        // - ignored transactions (aleardy existing) that are checked
        // - transactions with existing (merged transactions) that are not selected_merge
        finalTransaction.forceAddTransaction = true;
      }

      finalTransactions.push({
        ...finalTransaction,
        date,
        amount: amountToInteger(amount),
        cleared: clearOnImport,
        notes: importNotes ? finalTransaction.notes : null,
      });
    }

    if (errorMessage) {
      setLoadingState(null);
      setError({ parsed: false, message: errorMessage });
      return;
    }

    const accountPrefsKey = accountId || 'all';

    if (!isOfxFile(filetype) && !isCamtFile(filetype)) {
      const key = `parse-date-${accountPrefsKey}-${filetype}`;
      savePrefs({ [key]: parseDateFormat });
    }

    if (isOfxFile(filetype)) {
      savePrefs({
        [`ofx-fallback-missing-payee-${accountPrefsKey}`]: String(
          fallbackMissingPayeeToMemo,
        ),
      });
    }

    if (filetype === 'csv') {
      savePrefs({
        [`csv-mappings-${accountPrefsKey}`]: JSON.stringify(fieldMappings),
      });
      savePrefs({ [`csv-delimiter-${accountPrefsKey}`]: delimiter });
      savePrefs({ [`csv-has-header-${accountPrefsKey}`]: String(hasHeaderRow) });
      savePrefs({ [`csv-skip-lines-${accountPrefsKey}`]: String(skipLines) });
      savePrefs({ [`csv-in-out-mode-${accountPrefsKey}`]: String(inOutMode) });
      savePrefs({ [`csv-out-value-${accountPrefsKey}`]: String(outValue) });
    }

    if (filetype === 'csv' || filetype === 'qif') {
      savePrefs({
        [`flip-amount-${accountPrefsKey}-${filetype}`]: String(flipAmount),
        [`import-notes-${accountPrefsKey}-${filetype}`]: String(importNotes),
      });
    }

    const didChange = await dispatch(
      importTransactions({
        accountId, // accountId can be null here for 'All Accounts'
        transactions: finalTransactions,
        reconcile,
      }),
    ).unwrap();
    if (didChange) {
      await dispatch(getPayees());
    }

    if (onImported) {
      onImported(didChange);
    }
    close();
  }

  const runImportPreview = useCallback(async () => {
    const transactionPreview = await getImportPreview(
      transactions,
      filetype,
      flipAmount,
      fieldMappings,
      splitMode,
      parseDateFormat,
      inOutMode,
      outValue,
      multiplierAmount,
    );

    if (!deepEqual(transactions, transactionPreview)) {
      setTransactions(transactionPreview);
    }
  }, [
    getImportPreview,
    transactions,
    filetype,
    flipAmount,
    fieldMappings,
    splitMode,
    parseDateFormat,
    inOutMode,
    outValue,
    multiplierAmount,
  ]);

  const headers = [
    { name: 'Date', width: 200 },
    { name: 'Payee', width: 'flex' },
    { name: 'Notes', width: 'flex' },
    { name: 'Category', width: 'flex' },
  ];

  if (reconcile) {
    headers.unshift({ name: ' ', width: 31 });
  }
  if (inOutMode) {
    headers.push({ name: 'In/Out', width: 90, style: { textAlign: 'left' } });
  }
  if (splitMode) {
    headers.push({ name: 'Outflow', width: 90, style: { textAlign: 'right' } });
    headers.push({ name: 'Inflow', width: 90, style: { textAlign: 'right' } });
  } else {
    headers.push({ name: 'Amount', width: 90, style: { textAlign: 'right' } });
  }

  return (
    <Modal
      name="import-transactions"
      isLoading={loadingState === 'parsing'}
      containerProps={{ style: { width: 800 } }}
    >
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={
              t('Import transactions') +
              (filetype ? ` (${filetype.toUpperCase()})` : '')
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />
          {error && !error.parsed && (
            <View style={{ alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ marginRight: 10, color: theme.errorText }}>
                <strong>Error:</strong> {error.message}
              </Text>
            </View>
          )}
          {(!error || !error.parsed) && (
            <View
              style={{
                flex: 'unset',
                height: 300,
                border: '1px solid ' + theme.tableBorder,
              }}
            >
              <TableHeader headers={headers} />

              <TableWithNavigator
                items={transactions.filter(
                  trans =>
                    !trans.isMatchedTransaction ||
                    (trans.isMatchedTransaction && reconcile),
                )}
                fields={['payee', 'category', 'amount']}
                style={{ backgroundColor: theme.tableHeaderBackground }}
                getItemKey={index => index}
                renderEmpty={() => {
                  return (
                    <View
                      style={{
                        textAlign: 'center',
                        marginTop: 25,
                        color: theme.tableHeaderText,
                        fontStyle: 'italic',
                      }}
                    >
                      {t('No transactions found')}
                    </View>
                  );
                }}
                renderItem={({ key, style, item }) => (
                  <View key={key} style={style}>
                    <Transaction
                      transaction={item}
                      showParsed={filetype === 'csv' || filetype === 'qif'}
                      parseDateFormat={parseDateFormat}
                      dateFormat={dateFormat}
                      fieldMappings={fieldMappings}
                      splitMode={splitMode}
                      inOutMode={inOutMode}
                      outValue={outValue}
                      flipAmount={flipAmount}
                      multiplierAmount={multiplierAmount}
                      categories={categories.list}
                      onCheckTransaction={onCheckTransaction}
                      reconcile={reconcile}
                    />
                  </View>
                )}
              />
            </View>
          )}
          {error && error.parsed && (
            <View
              style={{
                color: theme.errorText,
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Text style={{ maxWidth: 450, marginBottom: 15 }}>
                <strong>Error:</strong> {error.message}
              </Text>
              {error.parsed && (
                <Button onPress={() => onNewFile()}>
                  {t('Select new file...')}
                </Button>
              )}
            </View>
          )}

          {filetype === 'csv' && (
            <View style={{ marginTop: 10 }}>
              <FieldMappings
                transactions={transactions}
                onChange={onUpdateFields}
                mappings={fieldMappings}
                splitMode={splitMode}
                inOutMode={inOutMode}
                hasHeaderRow={hasHeaderRow}
              />
            </View>
          )}

          {isOfxFile(filetype) && (
            <CheckboxOption
              id="form_fallback_missing_payee"
              checked={fallbackMissingPayeeToMemo}
              onChange={() => {
                setFallbackMissingPayeeToMemo(state => !state);
                parse(
                  filename,
                  getParseOptions('ofx', {
                    fallbackMissingPayeeToMemo: !fallbackMissingPayeeToMemo,
                    importNotes,
                  }),
                );
              }}
            >
              {t('Use Memo as a fallback for empty Payees')}
            </CheckboxOption>
          )}

          {filetype !== 'csv' && (
            <CheckboxOption
              id="import_notes"
              checked={importNotes}
              onChange={() => {
                setImportNotes(!importNotes);
                parse(
                  filename,
                  getParseOptions(filetype, {
                    delimiter,
                    hasHeaderRow,
                    skipLines,
                    fallbackMissingPayeeToMemo,
                    importNotes: !importNotes,
                  }),
                );
              }}
            >
              <Trans>Import notes from file</Trans>
            </CheckboxOption>
          )}

          {(isOfxFile(filetype) || isCamtFile(filetype)) && (
            <CheckboxOption
              id="form_dont_reconcile"
              checked={reconcile}
              onChange={() => {
                setReconcile(!reconcile);
              }}
            >
              {t('Merge with existing transactions')}
            </CheckboxOption>
          )}

          {/*Import Options */}
          {(filetype === 'qif' || filetype === 'csv') && (
            <View style={{ marginTop: 10 }}>
              <Stack
                direction="row"
                align="flex-start"
                spacing={1}
                style={{ marginTop: 5 }}
              >
                {/*Date Format */}
                <View>
                  {(filetype === 'qif' || filetype === 'csv') && (
                    <DateFormatSelect
                      transactions={transactions}
                      fieldMappings={fieldMappings}
                      parseDateFormat={parseDateFormat}
                      onChange={value => {
                        setParseDateFormat(value);
                        runImportPreview();
                      }}
                    />
                  )}
                </View>

                {/* CSV Options */}
                {filetype === 'csv' && (
                  <View style={{ marginLeft: 10, gap: 5 }}>
                    <SectionLabel title={t('CSV OPTIONS')} />
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 5,
                        alignItems: 'baseline',
                      }}
                    >
                      {t('Delimiter:')}
                      <Select
                        options={[
                          [',', ','],
                          [';', ';'],
                          ['|', '|'],
                          ['\t', 'tab'],
                        ]}
                        value={delimiter}
                        onChange={value => {
                          setDelimiter(value);
                          parse(
                            filename,
                            getParseOptions('csv', {
                              delimiter: value,
                              hasHeaderRow,
                              skipLines,
                              importNotes,
                            }),
                          );
                        }}
                        style={{ width: 50 }}
                      />
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 5,
                        alignItems: 'baseline',
                      }}
                    >
                      {t('Skip lines:')}
                      <Input
                        type="number"
                        value={skipLines}
                        min="0"
                        onChangeValue={value => {
                          setSkipLines(+value);
                          parse(
                            filename,
                            getParseOptions('csv', {
                              delimiter,
                              hasHeaderRow,
                              skipLines: +value,
                              importNotes,
                            }),
                          );
                        }}
                        style={{ width: 50 }}
                      />
                    </label>
                    <CheckboxOption
                      id="form_has_header"
                      checked={hasHeaderRow}
                      onChange={() => {
                        setHasHeaderRow(!hasHeaderRow);
                        parse(
                          filename,
                          getParseOptions('csv', {
                            delimiter,
                            hasHeaderRow: !hasHeaderRow,
                            skipLines,
                            importNotes,
                          }),
                        );
                      }}
                    >
                      {t('File has header row')}
                    </CheckboxOption>
                    <CheckboxOption
                      id="clear_on_import"
                      checked={clearOnImport}
                      onChange={() => {
                        setClearOnImport(!clearOnImport);
                      }}
                    >
                      {t('Clear transactions on import')}
                    </CheckboxOption>
                    <CheckboxOption
                      id="form_dont_reconcile"
                      checked={reconcile}
                      onChange={() => {
                        setReconcile(!reconcile);
                      }}
                    >
                      {t('Merge with existing transactions')}
                    </CheckboxOption>
                  </View>
                )}

                <View style={{ flex: 1 }} />

                <View style={{ marginRight: 10, gap: 5 }}>
                  <SectionLabel title={t('AMOUNT OPTIONS')} />
                  <CheckboxOption
                    id="form_flip"
                    checked={flipAmount}
                    onChange={() => {
                      setFlipAmount(!flipAmount);
                      runImportPreview();
                    }}
                  >
                    {t('Flip amount')}
                  </CheckboxOption>
                  <MultiplierOption
                    multiplierEnabled={multiplierEnabled}
                    multiplierAmount={multiplierAmount}
                    onToggle={() => {
                      setMultiplierEnabled(!multiplierEnabled);
                      setMultiplierAmount('');
                      runImportPreview();
                    }}
                    onChangeAmount={onMultiplierChange}
                  />
                  {filetype === 'csv' && (
                    <>
                      <CheckboxOption
                        id="form_split"
                        checked={splitMode}
                        onChange={() => {
                          onSplitMode();
                          runImportPreview();
                        }}
                      >
                        {t('Split amount into separate inflow/outflow columns')}
                      </CheckboxOption>
                      <InOutOption
                        inOutMode={inOutMode}
                        outValue={outValue}
                        onToggle={() => {
                          setInOutMode(!inOutMode);
                          runImportPreview();
                        }}
                        onChangeText={setOutValue}
                      />
                    </>
                  )}
                </View>
              </Stack>
            </View>
          )}

          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {/*Submit Button */}
            {isResolvingConflicts && (
              <View style={{ marginTop: 20, padding: 15, backgroundColor: theme.altPageBackground, borderRadius: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
                  {t('Resolve Transaction Conflicts')}
                </Text>
                <Text style={{ marginBottom: 15 }}>
                  {t('Some transactions could belong to multiple accounts. Please choose the correct account for each.')}
                </Text>
                {Array.from(conflicts.values()).map(conflict => (
                  <View key={conflict.transaction.trx_id} style={{ marginBottom: 15, paddingBottom: 10, borderBottom: `1px solid ${theme.altTableBorder}` }}>
                    <Stack direction="row" justify="space-between" align="center">
                      <Text>
                        {conflict.transaction.date} - {conflict.transaction.payee_name || t('Unknown Payee')}
                      </Text>
                      <Text style={{ color: conflict.transaction.amount > 0 ? theme.noticeText : theme.errorText }}>
                        {/* Assuming amountToInteger was already applied or formatMoney is available */}
                        {/* For display, you might want a formatMoney utility */}
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(conflict.transaction.amount / 100)}
                      </Text>
                    </Stack>
                    <Select
                      placeholder={t('Select account...')}
                      value={conflict.resolvedAccountId}
                      options={conflict.potentialAccounts.map(acc => ({
                        value: acc.id,
                        label: acc.name,
                      }))}
                      onChange={value =>
                        handleConflictResolution(conflict.transaction.trx_id, value)
                      }
                      style={{ marginTop: 5 }}
                    />
                  </View>
                ))}
                <Button
                  variant="primary"
                  isDisabled={Array.from(conflicts.values()).some(c => c.resolvedAccountId === null)}
                  onPress={confirmConflictResolutions}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {t('Confirm Resolutions')}
                </Button>
              </View>
            )}

            {/*Submit Button Area - Conditionally render or hide based on conflict state */}
            {!isResolvingConflicts && (
              <View
                style={{
                  alignSelf: 'flex-end',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '1em',
                  marginTop: 10, // Added margin if conflict UI isn't shown
                }}
              >
                <ButtonWithLoading
                  variant="primary"
                  autoFocus
                  isDisabled={
                    isResolvingConflicts || // Added
                    (conflicts.size > 0 && Array.from(conflicts.values()).some(c => c.resolvedAccountId === null)) || // Added
                    transactions?.filter(
                      trans => !trans.isMatchedTransaction && trans.selected,
                    ).length === 0
                  }
                  isLoading={loadingState === 'importing'}
                  onPress={() => {
                    onImport(close);
                  }}
                >
                  Import{' '}
                  {
                    transactions?.filter(
                      trans => !trans.isMatchedTransaction && trans.selected,
                    ).length
                  }{' '}
                  {t('transactions')}
                </ButtonWithLoading>
              </View>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}

function getParseOptions(fileType, options = {}) {
  if (fileType === 'csv') {
    const { delimiter, hasHeaderRow, skipLines } = options;
    return { delimiter, hasHeaderRow, skipLines };
  }
  if (isOfxFile(fileType)) {
    const { fallbackMissingPayeeToMemo, importNotes } = options;
    return { fallbackMissingPayeeToMemo, importNotes };
  }
  if (isCamtFile(fileType)) {
    const { importNotes } = options;
    return { importNotes };
  }
  const { importNotes } = options;
  return { importNotes };
}

function isOfxFile(fileType) {
  return fileType === 'ofx' || fileType === 'qfx';
}

function isCamtFile(fileType) {
  return fileType === 'xml';
}
