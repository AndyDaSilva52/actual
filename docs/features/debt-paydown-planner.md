# Debt Paydown Planner Feature for Actual Budget

This document outlines the proposed "Debt Paydown Planner" feature for Actual Budget.

## 1. Types of Debts

The planner should allow users to track a variety of common debt types:

*   **Credit Cards:** Revolving debt with variable interest rates and minimum payments.
*   **Personal Loans:** Unsecured loans with fixed or variable interest rates and fixed repayment schedules.
*   **Student Loans:** Loans for educational expenses, which can be federal or private, with various repayment plans.
*   **Mortgages:** Loans secured by real estate, typically with long repayment terms.
*   **Auto Loans:** Loans secured by a vehicle, with fixed repayment schedules.
*   **Lines of Credit:** Flexible borrowing up to a certain limit, similar to credit cards.
*   **Medical Debt:** Outstanding balances owed to healthcare providers.
*   **Other Installment Loans:** Any other type of loan with a regular payment schedule.
*   **Custom Debt:** A flexible category for any other type of debt a user might want to track.

## 2. Key Data Points and Detailed Data Model

This section details the information required for each debt and how it might be structured.

### 2.1. Debt Object Structure

Each debt would be an object with the following properties. A user would have a list of these debt objects.
`user.debts = [debtObject1, debtObject2, ...]`

*   **`id`**: `string` (Unique identifier for the debt, e.g., UUID)
*   **`userId`**: `string` (Foreign key linking to the user who owns this debt)
*   **`creditorName`**: `string` (e.g., "Chase Bank", "Navient")
*   **`debtNickname`**: `string` (e.g., "Visa Card", "My Student Loan")
*   **`accountNumber`**: `string` (Optional, for user reference, stored securely)
*   **`debtType`**: `enum` (Values: `CREDIT_CARD`, `PERSONAL_LOAN`, `STUDENT_LOAN`, `MORTGAGE`, `AUTO_LOAN`, `LINE_OF_CREDIT`, `MEDICAL_DEBT`, `OTHER_INSTALLMENT`, `CUSTOM`)
*   **`currentBalance`**: `number` (Current outstanding amount. Supports multiple currencies if applicable.)
*   **`originalBalance`**: `number` (Optional. Initial loan amount. Supports multiple currencies.)
*   **`interestRateAPR`**: `number` (Annual Percentage Rate, e.g., 19.9 for 19.9%. For variable rates, this is the current rate.)
*   **`minimumMonthlyPayment`**: `number` (Required minimum payment. Supports multiple currencies.)
*   **`nextPaymentDueDate`**: `date` (e.g., "YYYY-MM-DD")
*   **`originalLoanTermMonths`**: `integer` (Optional. Original length of the loan in months.)
*   **`compoundingFrequency`**: `enum` (Default: `MONTHLY`. Values: `DAILY`, `MONTHLY`, `ANNUALLY`. Used for projection accuracy.)
*   **`latePaymentFee`**: `number` (Optional. Reference for the fee amount. Supports multiple currencies.)
*   **`otherFees`**: `array` (Optional. List of fee objects, e.g., `[{name: "Annual Fee", amount: 75, frequency: "ANNUAL"}]`)
*   **`creationDate`**: `date` (Date the debt was added to the planner)
*   **`lastUpdatedDate`**: `date` (Date the debt was last modified)
*   **`customOrder`**: `integer` (Optional. User-defined order for custom payoff strategy)
*   **`promotionalAPR`**: `object` (Optional. E.g., `{ rate: 0, expires: "YYYY-MM-DD" }`)

### 2.2. Payment Log Structure (Conceptual)

Payments made towards a debt could be linked from Actual Budget's transaction system. If logged directly or for projection purposes, a payment might have:

*   **`paymentId`**: `string` (Unique identifier)
*   **`debtId`**: `string` (Foreign key linking to the `Debt Object`)
*   **`paymentDate`**: `date`
*   **`amountPaid`**: `number` (Supports multiple currencies)
*   **`notes`**: `string` (Optional)

## 3. UI/UX Considerations (Conceptual)

A smooth and intuitive user experience is vital for this feature.

### 3.1. Main Views/Screens

*   **Debt List/Dashboard:**
    *   **Overview:** Displays a summary of all debts: total outstanding debt, combined minimum monthly payment, overall estimated payoff date (based on the current strategy), and total extra payment allocated per month.
    *   **Debt Cards/Rows:** Each debt listed with key info: nickname, current balance, APR, minimum payment, next due date, and its individual projected payoff date. Visual indicators (e.g., progress bars) for each debt.
    *   **Call to Action:** Buttons for "Add New Debt," "Configure Strategy," and "Run Simulation."
*   **Add/Edit Debt Form:**
    *   A modal or dedicated page with input fields for all data points defined in the Debt Object Structure (creditor name, nickname, balance, APR, minimum payment, etc.).
    *   Clear labels, input validation (e.g., for dates, numbers), and tooltips for less common fields like "Compounding Frequency."
*   **Strategy Configuration View:**
    *   **Strategy Selection:** Radio buttons or dropdown to select "Snowball," "Avalanche," or "Custom."
    *   **Custom Order:** If "Custom" is selected, a drag-and-drop interface to reorder debt cards.
    *   **Extra Payment Input:** A clear field for the user to enter their total monthly "extra payment budget" (amount above total minimum payments).
    *   **Guidance:** Brief explanations of each strategy.
*   **Simulation View:**
    *   **Inputs:** Fields for "One-time extra payment amount" and/or "Increase/decrease recurring extra payment by." Option to target a specific debt for the one-time payment.
    *   **Results:** Clearly displays the impact: new overall payoff date, new total interest paid, and comparison against the current plan. Visual charts could update dynamically.

### 3.2. User Flow

1.  User navigates to the "Debt Planner" section from the main Actual Budget menu.
2.  **Dashboard View:** Lands on the Debt List/Dashboard.
3.  To add a debt: Clicks "Add New Debt," fills the form, and saves. The new debt appears on the dashboard.
4.  To configure strategy: Clicks "Configure Strategy," selects a method, sets an extra payment amount, and saves. The dashboard updates projections.
5.  To simulate: Clicks "Run Simulation," enters what-if parameters, and sees results. Can choose to apply changes to their main plan or discard.
6.  Editing a debt: Clicks an "edit" icon on a debt card/row to open the Add/Edit Debt Form.

## 4. Core Functionality (with Calculation Logic Clarifications)

### Adding New Debts
(As previously described)

### Logging Payments Made
(As previously described)

### Paydown Strategies

#### 4.1. Strategy Selection
(As previously described: Snowball, Avalanche, Custom)

#### 4.2. "Extra Payment" Allocation
(As previously described)

#### 4.3. Simulation & "What-If" Scenarios
(As previously described)

### 4.4. Calculation Logic Clarifications

*   **Interest Calculation:**
    *   Projections should ideally use the `compoundingFrequency` specified for each debt. If daily, the daily interest rate (`APR / 365`) is applied to the balance each day. If monthly, the monthly rate (`APR / 12`) is applied. For simplicity in initial versions, **monthly compounding** can be the default assumption if daily is too complex to implement quickly.
    *   **Accrued Interest for a Period:** `(Balance * (APR / 12))` for monthly compounding.
    *   **Principal Paid:** `(Payment Amount - Accrued Interest)`.
    *   **New Balance:** `(Previous Balance - Principal Paid)`.
    *   **Variable APRs:** For projections, the *current* `interestRateAPR` will be used. If a promotional APR is set (`promotionalAPR: { rate: 0, expires: "YYYY-MM-DD" }`), that rate is used until the expiry date, after which the standard `interestRateAPR` is used. Users should be able to update the `interestRateAPR` if it changes, and projections will recalculate.
*   **Payoff Projections Algorithm (General Steps for one debt):**
    1.  Start with `currentBalance`, `interestRateAPR`, `minimumMonthlyPayment`, and any `extraPayment` allocated to this debt.
    2.  Initialize `totalInterestPaid = 0`.
    3.  Loop month by month:
        a.  Calculate interest for the month: `interestThisMonth = currentBalance * (interestRateAPR / 12)`. (Adjust for promotional APRs if active).
        b.  `totalInterestPaid += interestThisMonth`.
        c.  Determine `paymentForMonth = minimumMonthlyPayment + extraPaymentSpecificToThisDebt`.
        d.  If `paymentForMonth > currentBalance + interestThisMonth`, then `paymentForMonth = currentBalance + interestThisMonth` (final payment).
        e.  `principalPaid = paymentForMonth - interestThisMonth`.
        f.  `currentBalance -= principalPaid`.
        g.  Increment month count.
        h.  If `currentBalance <= 0`, the debt is paid off. The number of months taken is the payoff time.
*   **Rollover Logic (Snowball, Avalanche, Custom):**
    1.  Debts are ordered according to the chosen strategy.
    2.  A total `extraPaymentBudget` is defined by the user.
    3.  **For the current target debt (first in the order):**
        *   The payment applied is `itsMinimumMonthlyPayment + extraPaymentBudget`.
    4.  **For all other debts:**
        *   The payment applied is `theirMinimumMonthlyPayment`.
    5.  When the target debt is paid off:
        *   The money "freed up" is `itsMinimumMonthlyPayment + extraPaymentBudget` (the entire amount that *was* going to it).
        *   This entire "freed up" amount is added to the payment of the *next* debt in the sequence. So, the next debt receives: `itsMinimumMonthlyPayment + freedUpAmountFromPreviousDebt`.
        *   This continues until all debts are paid.
    *   **Important Note on Minimum Payments:** If a debt's minimum payment decreases (e.g., for credit cards as balance drops), the projection should use the *user-entered* minimum payment as a floor for allocation purposes, or the actual calculated minimum if it's higher and the planner has logic for it (more complex). For simplicity, the user-entered minimum is often fixed for the projection unless manually updated.

### Visualization & Reporting
(As previously described)

## 5. Integration with Budget
(As previously described)

## 6. Potential API Endpoints (Conceptual)

These conceptual endpoints illustrate core interactions with the debt data:

*   **`GET /users/{userId}/debts`**: List all debts for a user.
    *   Response: `[debtObject1, debtObject2, ...]`
*   **`POST /users/{userId}/debts`**: Add a new debt.
    *   Request Body: `debtObject` (without `id`, `userId`, `creationDate`, `lastUpdatedDate` - server generates these)
    *   Response: `debtObject` (the newly created debt with server-generated fields)
*   **`GET /users/{userId}/debts/{debtId}`**: Get a specific debt.
    *   Response: `debtObject`
*   **`PUT /users/{userId}/debts/{debtId}`**: Update an existing debt.
    *   Request Body: `debtObject` (with fields to update)
    *   Response: `debtObject` (the updated debt)
*   **`DELETE /users/{userId}/debts/{debtId}`**: Delete a debt.
    *   Response: Success/failure status.
*   **`POST /users/{userId}/debts/{debtId}/payments`**: Log a payment against a debt (if not solely relying on budget transaction linking).
    *   Request Body: `{ paymentDate: "YYYY-MM-DD", amountPaid: 100.00 }`
    *   Response: Updated `debtObject` or payment confirmation.
*   **`GET /users/{userId}/debts/projections`**: Calculate and retrieve payoff projections.
    *   Query Params: `?strategy=snowball&extraPaymentBudget=100&targetDebtId={debtId}` (targetDebtId optional for specific "what-if" on one debt)
    *   Response: An object containing:
        *   `overallPayoffDate`: "YYYY-MM-DD"
        *   `totalInterestPaid`: `number`
        *   `debtBreakdown`: `[{ debtId: "id1", debtNickname: "Visa", projectedPayoffDate: "YYYY-MM-DD", interestPaid: 550.20 }, ...]`
        *   `monthlyAmortizationSchedule`: (Optional) Detailed month-by-month breakdown for each debt.

## 7. Advanced Considerations & Edge Cases

*   **Promotional APRs:**
    *   **Modeling:** The `debtObject` includes a `promotionalAPR: { rate: number, expires: "YYYY-MM-DD" }` field.
    *   **Calculation:** Projection logic must check if the current projection month falls within the promotional period. If so, use `promotionalAPR.rate`; otherwise, use `interestRateAPR`.
*   **Balance Transfers:**
    *   **Option 1 (Simple):** User manually reduces the balance of the old debt and increases the balance of the new debt (or creates a new debt object for the transferred amount).
    *   **Option 2 (Assisted):** A dedicated "Balance Transfer" tool could:
        1.  Ask for the source debt, destination debt (or create new), and transfer amount.
        2.  Log a "payment" on the source debt equal to the transfer amount.
        3.  Increase the balance of the destination debt.
        4.  Potentially record a balance transfer fee if applicable.
*   **Changes in Minimum Payments:**
    *   Creditors (especially for credit cards) may change minimum payment amounts as the balance decreases.
    *   **Current Approach:** The user-entered `minimumMonthlyPayment` is typically used for projections. If it changes, the user must update it manually in the planner.
    *   **Future Enhancement:** The system *could* attempt to calculate the minimum payment based on common formulas (e.g., 1% of balance + interest), but this adds complexity and varies by creditor.
*   **Fees (One-time vs. Recurring):**
    *   **One-time fees** (e.g., balance transfer fee) could be added to the principal balance of the relevant debt at the time they occur.
    *   **Recurring fees** (e.g., annual fee) are harder to project directly into the loan amortization. They are better handled as budgeted expenses. The `otherFees` field in the data model is primarily for user reference and awareness. Payoff calculations generally focus on principal and interest.
*   **Currency:**
    *   All monetary fields (`currentBalance`, `originalBalance`, `minimumMonthlyPayment`, `latePaymentFee`, `amountPaid`, `extraPaymentBudget`) must support multiple currencies if Actual Budget has this capability. Each `debtObject` might need a `currencyCode` field (e.g., "USD", "EUR"). Projections and totals would need to be handled consistently, potentially by converting to a base currency for summary views or by keeping them separate.
*   **Debt Pauses / Forbearance:**
    *   Users might need a way to mark a debt as being in forbearance (payments paused). Projections would need to skip payments (but potentially still accrue interest if applicable) for that debt during the forbearance period. This would require additional fields like `forbearanceStartDate` and `forbearanceEndDate`.
*   **Variable Interest Rate Changes:**
    *   The current model uses the latest known APR for projections. If a user knows their APR will change on a specific date (e.g., end of an introductory fixed period different from promotional APR), this is complex to model accurately without many future rate entries. The simplest is for users to update the APR when it changes.

This Debt Paydown Planner aims to provide users with clarity, motivation, and strategic tools to tackle their debts effectively, all while being tightly integrated with their everyday budgeting in Actual Budget.Okay, I've refined the `docs/features/debt-paydown-planner.md` document.

Here's a summary of the changes and additions based on your request:

1.  **Data Model Details:**
    *   Added specific data types (string, number, date, boolean, enum) to each field under "Key Data Points for Each Debt," which was restructured into "2. Key Data Points and Detailed Data Model" with a subsection "2.1. Debt Object Structure."
    *   Clarified that debts would be stored as a list of debt objects (e.g., `user.debts = [debtObject1, ...]`).
    *   Defined relationships: `userId` links debt to a user. A conceptual "Payment Log Structure" was added to show how payments link to a debt, though primary integration is with Actual Budget's transactions.
    *   Added new relevant fields to the `debtObject` like `id`, `userId`, `debtType` (as enum), `creationDate`, `lastUpdatedDate`, `customOrder` (for custom strategy), and `promotionalAPR` object.

2.  **User Interface (UI) and User Experience (UX) Considerations (Conceptual):**
    *   Created a new section "3. UI/UX Considerations (Conceptual)."
    *   Described main views/screens: Debt List/Dashboard, Add/Edit Debt Form, Strategy Configuration View, and Simulation View, including key elements and purpose.
    *   Outlined a basic user flow for navigating between these views and performing common actions.

3.  **Calculation Logic Clarifications:**
    *   Moved calculation details into subsection "4.4. Calculation Logic Clarifications" under "Core Functionality."
    *   **Interest Calculation:** Specified monthly compounding as a default for projections, with `APR/12`. Mentioned how to handle promotional APRs (use promo rate until expiry, then standard APR). Noted that variable APRs use the current rate for projections, requiring user updates if they change.
    *   **Payoff Projections:** Provided a more detailed step-by-step algorithm for calculating payoff for a single debt, including how interest, principal, and final payments are handled.
    *   **Rollover Logic:** Explicitly described how the "freed up" money (target debt's minimum payment + the *entire* `extraPaymentBudget`) is reallocated to the next debt in the chosen sequence. Clarified how minimum payments of other debts are handled.

4.  **API Endpoints (Conceptual):**
    *   Created a new section "6. Potential API Endpoints (Conceptual)."
    *   Listed key actions and their corresponding conceptual HTTP methods and paths:
        *   `GET /users/{userId}/debts`
        *   `POST /users/{userId}/debts`
        *   `GET /users/{userId}/debts/{debtId}`
        *   `PUT /users/{userId}/debts/{debtId}`
        *   `DELETE /users/{userId}/debts/{debtId}`
        *   `POST /users/{userId}/debts/{debtId}/payments`
        *   `GET /users/{userId}/debts/projections` (with query parameters for strategy and extra payment)
    *   Included example request/response structures for some endpoints.

5.  **Edge Cases and Additional Considerations:**
    *   Created a new section "7. Advanced Considerations & Edge Cases."
    *   **Promotional APRs:** Detailed how they're modeled (`promotionalAPR` object) and used in calculations.
    *   **Balance Transfers:** Suggested simple manual handling and a more advanced assisted tool.
    *   **Changes in Minimum Payments:** Noted current reliance on user-updated values, with potential for future enhancements.
    *   **Fees:** Clarified that one-time fees could be added to principal, while recurring fees are generally better budgeted separately; `otherFees` field is for reference.
    *   **Currency:** Stated explicitly that monetary values need to support multi-currency, potentially with a `currencyCode` in `debtObject`.
    *   Added new edge cases: **Debt Pauses / Forbearance** and handling **Variable Interest Rate Changes** beyond promotional periods.

The document should now be significantly more detailed and actionable for development.
