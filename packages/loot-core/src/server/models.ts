import {
  CategoryEntity,
  CategoryGroupEntity,
  PayeeEntity,
  DebtEntity,
  TransactionDebtLinkEntity,
} from '../types/models';

import {
  convertForInsert,
  convertForUpdate,
  convertFromSelect,
  schema,
  schemaConfig,
} from './aql';
import {
  DbAccount,
  DbCategory,
  DbCategoryGroup,
  DbPayee,
  DbDebt,
  DbTransactionDebtLink,
} from './db';
import { ValidationError } from './errors';

export function requiredFields<T extends object, K extends keyof T>(
  name: string,
  row: T,
  fields: K[],
  update?: boolean,
) {
  fields.forEach(field => {
    if (update) {
      if (row.hasOwnProperty(field) && row[field] == null) {
        throw new ValidationError(`${name} is missing field ${String(field)}`);
      }
    } else {
      if (!row.hasOwnProperty(field) || row[field] == null) {
        throw new ValidationError(`${name} is missing field ${String(field)}`);
      }
    }
  });
}

export function toDateRepr(str: string) {
  if (typeof str !== 'string') {
    throw new Error('toDateRepr not passed a string: ' + str);
  }

  return parseInt(str.replace(/-/g, ''));
}

export function fromDateRepr(number: number) {
  if (typeof number !== 'number') {
    throw new Error('fromDateRepr not passed a number: ' + number);
  }

  const dateString = number.toString();
  return (
    dateString.slice(0, 4) +
    '-' +
    dateString.slice(4, 6) +
    '-' +
    dateString.slice(6)
  );
}

export const accountModel = {
  validate(account: Partial<DbAccount>, { update }: { update?: boolean } = {}) {
    requiredFields(
      'account',
      account,
      update ? ['name', 'offbudget', 'closed'] : ['name'],
      update,
    );

    return account as DbAccount;
  },
};

export const categoryModel = {
  validate(
    category: Partial<DbCategory>,
    { update }: { update?: boolean } = {},
  ): DbCategory {
    requiredFields(
      'category',
      category,
      update ? ['name', 'is_income', 'cat_group'] : ['name', 'cat_group'],
      update,
    );

    const { sort_order, ...rest } = category;
    return { ...rest } as DbCategory;
  },
  toDb(
    category: CategoryEntity,
    { update }: { update?: boolean } = {},
  ): DbCategory {
    return (
      update
        ? convertForUpdate(schema, schemaConfig, 'categories', category)
        : convertForInsert(schema, schemaConfig, 'categories', category)
    ) as DbCategory;
  },
  fromDb(category: DbCategory): CategoryEntity {
    return convertFromSelect(
      schema,
      schemaConfig,
      'categories',
      category,
    ) as CategoryEntity;
  },
};

export const categoryGroupModel = {
  validate(
    categoryGroup: Partial<DbCategoryGroup>,
    { update }: { update?: boolean } = {},
  ): DbCategoryGroup {
    requiredFields(
      'categoryGroup',
      categoryGroup,
      update ? ['name', 'is_income'] : ['name'],
      update,
    );

    const { sort_order, ...rest } = categoryGroup;
    return { ...rest } as DbCategoryGroup;
  },
  toDb(
    categoryGroup: CategoryGroupEntity,
    { update }: { update?: boolean } = {},
  ): DbCategoryGroup {
    return (
      update
        ? convertForUpdate(
            schema,
            schemaConfig,
            'category_groups',
            categoryGroup,
          )
        : convertForInsert(
            schema,
            schemaConfig,
            'category_groups',
            categoryGroup,
          )
    ) as DbCategoryGroup;
  },
  fromDb(
    categoryGroup: DbCategoryGroup & {
      categories: DbCategory[];
    },
  ): CategoryGroupEntity {
    const { categories, ...rest } = categoryGroup;
    const categoryGroupEntity = convertFromSelect(
      schema,
      schemaConfig,
      'category_groups',
      rest,
    ) as CategoryGroupEntity;

    return {
      ...categoryGroupEntity,
      categories: categories
        .filter(category => category.cat_group === categoryGroup.id)
        .map(categoryModel.fromDb),
    };
  },
};

export const payeeModel = {
  validate(payee: Partial<DbPayee>, { update }: { update?: boolean } = {}) {
    requiredFields('payee', payee, update ? [] : ['name'], update);
    return payee as DbPayee;
  },
  toDb(payee: PayeeEntity, { update }: { update?: boolean } = {}): DbPayee {
    return (
      update
        ? convertForUpdate(schema, schemaConfig, 'payees', payee)
        : convertForInsert(schema, schemaConfig, 'payees', payee)
    ) as DbPayee;
  },
  fromDb(payee: DbPayee): PayeeEntity {
    return convertFromSelect(
      schema,
      schemaConfig,
      'payees',
      payee,
    ) as PayeeEntity;
  },
};

export const debtModel = {
  validate(
    debt: Partial<DbDebt>,
    { update }: { update?: boolean } = {},
  ): Partial<DbDebt> {
    const debtName = 'debt'; // For error messages

    if (update) {
      requiredFields(debtName, debt, ['id'], true);
    } else {
      // For new debts, these fields are mandatory
      requiredFields(
        debtName,
        debt,
        [
          'creditor_name',
          'debt_type',
          'current_balance',
          'interest_rate_apr',
          'minimum_monthly_payment',
        ],
        false,
      );
    }

    // If other_fees is provided as an object, stringify it.
    // This is a temporary measure assuming AQL schema might not yet fully
    // handle JSON object to TEXT conversion automatically for validation context.
    // convertForInsert/Update should ideally handle this if schema type is 'json'.
    if (debt.other_fees && typeof debt.other_fees !== 'string') {
      debt.other_fees = JSON.stringify(debt.other_fees);
    }

    // Additional specific validations can be added here (e.g., number ranges)

    return debt;
  },
  toDb(debt: Partial<DebtEntity>, { update }: { update?: boolean } = {}) {
    // Dates in DebtEntity are 'YYYY-MM-DD' or ISO8601 strings, matching DbDebt TEXT fields.
    // other_fees in DebtEntity is an object array, needs to be stringified for DbDebt JSON TEXT.
    // tombstone boolean to 0/1.
    const dbDebt: Partial<DbDebt> = { ...debt } as Partial<DbDebt>;

    if (debt.other_fees && typeof debt.other_fees !== 'string') {
      dbDebt.other_fees = JSON.stringify(debt.other_fees);
    } else if (debt.other_fees === null) {
      dbDebt.other_fees = null;
    }


    if (debt.tombstone !== undefined) {
      dbDebt.tombstone = debt.tombstone ? 1 : 0;
    }
    
    // Let AQL handle the rest of the conversions based on schema
    return (
      update
        ? convertForUpdate(schema, schemaConfig, 'debts', dbDebt)
        : convertForInsert(schema, schemaConfig, 'debts', dbDebt)
    ) as DbDebt;
  },
  fromDb(dbDebt: DbDebt): DebtEntity {
    // Dates in DbDebt are TEXT, map directly to strings in DebtEntity.
    // other_fees in DbDebt is JSON TEXT, parse to object array for DebtEntity.
    // tombstone 0/1 to boolean.
    const entityDebt: Partial<DebtEntity> = { ...dbDebt } as Partial<DebtEntity>;

    if (dbDebt.other_fees && typeof dbDebt.other_fees === 'string') {
      try {
        entityDebt.other_fees = JSON.parse(dbDebt.other_fees);
      } catch (e) {
        console.error(
          `Failed to parse other_fees from DB for debt id ${dbDebt.id}:`,
          e,
        );
        entityDebt.other_fees = null; // Or handle error appropriately
      }
    } else if (dbDebt.other_fees === null || dbDebt.other_fees === undefined) {
       entityDebt.other_fees = null;
    }


    if (dbDebt.tombstone !== undefined) {
      entityDebt.tombstone = dbDebt.tombstone === 1;
    }

    // Let AQL handle the rest of the conversions
    return convertFromSelect(
      schema,
      schemaConfig,
      'debts',
      entityDebt, // Pass the partially converted entityDebt
    ) as DebtEntity;
  },
};

export const transactionDebtLinkModel = {
  validate(
    link: Partial<DbTransactionDebtLink>,
    { update }: { update?: boolean } = {},
  ): Partial<DbTransactionDebtLink> {
    const modelName = 'transaction_debt_link';

    if (update) {
      requiredFields(modelName, link, ['id'], true);
    } else {
      requiredFields(modelName, link, ['transaction_id', 'debt_id'], false);
    }
    // amount_applied is optional and can be null

    return link;
  },
  toDb(
    link: Partial<TransactionDebtLinkEntity>,
    { update }: { update?: boolean } = {},
  ): Partial<DbTransactionDebtLink> {
    const dbLink: Partial<DbTransactionDebtLink> = {
      ...link,
      // Ensure tombstone is 0 or 1, defaulting to 0 if undefined
      tombstone: link.tombstone ? 1 : link.tombstone === false ? 0 : undefined,
    };

    // amount_applied can be null, so direct mapping is fine.
    // If undefined in Entity, it will be undefined in DbLink, and SQL schema allows NULL.

    return (
      update
        ? convertForUpdate(schema, schemaConfig, 'transaction_debt_links', dbLink)
        : convertForInsert(schema, schemaConfig, 'transaction_debt_links', dbLink)
    ) as DbTransactionDebtLink;
  },
  fromDb(dbLink: DbTransactionDebtLink): TransactionDebtLinkEntity {
     const entityLink: Partial<TransactionDebtLinkEntity> = {
      ...dbLink,
      tombstone: dbLink.tombstone === 1,
    };
    // amount_applied can be null, direct mapping is fine.

    return convertFromSelect(
      schema,
      schemaConfig,
      'transaction_debt_links',
      entityLink,
    ) as TransactionDebtLinkEntity;
  },
};
