// @ts-strict-ignore
type Division = {
  category?: string;
  subcategory?: string;
  description?: string;
  amount?: number;
};

type QIFTransaction = {
  date?: string;
  amount?: string;
  number?: string;
  memo?: string;
  address?: string[];
  clearedStatus?: string;
  category?: string;
  subcategory?: string;
  payee?: string;
  division?: Division[];
};

export function qif2json(qif, options: { dateFormat?: string } = {}) {
  const lines = qif.split('\n').filter(Boolean);
  let line = lines.shift();
  let typeLine = line;

  let accountName: string | undefined = undefined;
  let currentAccountHeader: { name?: string; type?: string } = {};
  let inAccountHeader = false;

  // Check for initial !Account block
  if (line.startsWith('!Account')) {
    inAccountHeader = true;
    line = lines.shift(); // Move to next line
    while (line && !line.startsWith('!Type:') && line !== '^') {
      if (line.startsWith('N')) {
        currentAccountHeader.name = line.substring(1).trim();
      } else if (line.startsWith('L')) { // Wells Fargo uses L for account name in !Account
        currentAccountHeader.name = line.substring(1).trim();
      } else if (line.startsWith('T')) {
        currentAccountHeader.type = line.substring(1).trim();
      }
      line = lines.shift();
    }
    if (currentAccountHeader.name) {
      accountName = currentAccountHeader.name;
    }
    if (line === '^') { // End of account header
      line = lines.shift(); // Move to the !Type line
    }
    typeLine = line; // This should now be the !Type line
    inAccountHeader = false;
  }
  
  const typeMatch = typeLine ? /!Type:([^$]*)$/.exec(typeLine.trim()) : null;

  const data: {
    dateFormat: string | undefined;
    type?: string;
    transactions: QIFTransaction[];
    accountName?: string;
  } = {
    dateFormat: options.dateFormat,
    transactions: [],
    accountName: accountName,
  };
  const transactions = data.transactions;
  let transaction: QIFTransaction = {};

  if (!typeMatch || !typeMatch.length) {
    // If we only had an !Account block and no !Type, it's not a transactions file per se
    // or the file is malformed. If transactions are empty and accountName is found,
    // it's still useful to return the accountName.
    if (transactions.length === 0 && data.accountName) {
      return data;
    }
    throw new Error('File does not appear to be a valid QIF transaction file: ' + typeLine);
  }
  data.type = typeMatch[1];

  let division: Division = {};

  // Process remaining lines for transactions
  // Note: if line was consumed by account header processing, lines.shift() will get the next one.
  // If line was the !Type line, the loop starts with the line *after* !Type.
  // If the first line after !Account ^ was !Type, then `line` holds that, and we need to start processing lines *after* it.
  // So, if `line` is currently the `typeLine`, we should shift.
  if (line === typeLine) { 
    line = lines.shift();
  }

  while (line != null) { // Check for null because lines.shift() can return undefined
    line = line.trim();
    if (line === '^') {
      if (Object.keys(transaction).length > 0) { // Ensure transaction is not empty
        transactions.push(transaction);
      }
      transaction = {};
      line = lines.shift(); // Consume '^' and get next line
      continue;
    }
    // Handle potential new !Account blocks if QIF mixes them (less common for transactions)
    if (line.startsWith('!Account')) {
      inAccountHeader = true;
      currentAccountHeader = {}; // Reset for new account block
      line = lines.shift();
      while (line && !line.startsWith('!Type:') && line !== '^') {
        if (line.startsWith('N')) {
          currentAccountHeader.name = line.substring(1).trim();
        } else if (line.startsWith('L')) {
          currentAccountHeader.name = line.substring(1).trim();
        } else if (line.startsWith('T')) {
          currentAccountHeader.type = line.substring(1).trim();
        }
        line = lines.shift();
      }
      if (currentAccountHeader.name) {
        data.accountName = currentAccountHeader.name; // Update with the latest account name found
      }
      if (line === '^') line = lines.shift(); // End of account block
      // Expect a !Type line next for this new account's transactions
      const newTypeMatch = line ? /!Type:([^$]*)$/.exec(line.trim()) : null;
      if (newTypeMatch) {
        data.type = newTypeMatch[1]; // Update data type for subsequent transactions
      } else {
         // If no !Type after !Account, it might be end of file or malformed
         if (Object.keys(transaction).length > 0) transactions.push(transaction); // save pending transaction
         break; 
      }
      inAccountHeader = false;
      line = lines.shift(); // Move to first transaction line for this new type
      continue;
    }

    if (inAccountHeader) { // Should not happen if logic is correct, but as a safeguard
        line = lines.shift();
        continue;
    }

    // Existing transaction parsing logic
    switch (line[0]) {
      case 'D':
        transaction.date = line.substring(1);
        break;
      case 'T':
        transaction.amount = line.substring(1);
        break;
      case 'N':
        transaction.number = line.substring(1);
        break;
      case 'M':
        transaction.memo = line.substring(1);
        break;
      case 'A':
        transaction.address = (transaction.address || []).concat(
          line.substring(1),
        );
        break;
      case 'P':
        transaction.payee = line.substring(1).replace(/&amp;/g, '&');
        break;
      case 'L':
        const lArray = line.substring(1).split(':');
        transaction.category = lArray[0];
        if (lArray[1] !== undefined) {
          transaction.subcategory = lArray[1];
        }
        break;
      case 'C':
        transaction.clearedStatus = line.substring(1);
        break;
      case 'S':
        const sArray = line.substring(1).split(':');
        division.category = sArray[0];
        if (sArray[1] !== undefined) {
          division.subcategory = sArray[1];
        }
        break;
      case 'E':
        division.description = line.substring(1);
        break;
      case '$':
        division.amount = parseFloat(line.substring(1));
        if (!(transaction.division instanceof Array)) {
          transaction.division = [];
        }
        transaction.division.push(division);
        division = {};
        break;

      default:
        throw new Error('Unknown Detail Code: ' + line[0]);
    }
  }

  if (Object.keys(transaction).length) {
    transactions.push(transaction);
  }
  return data;
}
