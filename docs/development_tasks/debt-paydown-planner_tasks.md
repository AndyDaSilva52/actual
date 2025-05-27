# Development Tasks: Debt Paydown Planner

This document lists actionable development tasks for implementing the Debt Paydown Planner feature, based on the detailed description in `docs/features/debt-paydown-planner.md`.

## I. Core Backend: Data Model & Basic Operations (BE)

1.  **Task: Define Debt Data Model in Database/State**
    *   Description: Implement the schema for storing `debtObject` information as defined in `debt-paydown-planner.md`. This includes all fields like `id`, `userId`, `creditorName`, `debtNickname`, `accountNumber`, `debtType`, `currentBalance`, `originalBalance`, `interestRateAPR`, `minimumMonthlyPayment`, `nextPaymentDueDate`, `originalLoanTermMonths`, `compoundingFrequency`, `latePaymentFee`, `otherFees`, `creationDate`, `lastUpdatedDate`, `customOrder`, and `promotionalAPR`.
    *   Type: BE
    *   Considerations: Ensure data types match the specification, plan for secure storage of `accountNumber`, and establish relationships (e.g., `userId` to user table).

2.  **Task: Backend - Basic CRUD API for Debts**
    *   Description: Develop backend logic and API endpoints (e.g., `POST /users/{userId}/debts`, `GET /users/{userId}/debts`, `GET /users/{userId}/debts/{debtId}`, `PUT /users/{userId}/debts/{debtId}`, `DELETE /users/{userId}/debts/{debtId}`) for creating, reading, updating, and deleting debt entries.
    *   Type: BE
    *   Considerations: Implement validation for incoming data, ensure proper user authentication and authorization for accessing/modifying debt data.

3.  **Task: Define Payment Log Data Model (Conceptual)**
    *   Description: If direct payment logging within the planner (not solely via budget integration) is pursued, define the schema for payment logs (`paymentId`, `debtId`, `paymentDate`, `amountPaid`, `notes`).
    *   Type: BE
    *   Considerations: This might be lower priority if budget integration is the primary method for logging payments.

4.  **Task: Backend - API for Logging Payments (Conceptual)**
    *   Description: If direct payment logging is implemented, create the endpoint `POST /users/{userId}/debts/{debtId}/payments`.
    *   Type: BE

## II. Frontend: Debt Display and Management (FE/FS)

1.  **Task: UI - Debt List/Dashboard View**
    *   Description: Create the main UI view that lists all of a user's debts. Each debt should display key information (nickname, balance, APR, min. payment, next due date). Include summary information like total outstanding debt.
    *   Type: FE
    *   Considerations: Design for clarity and easy scanning of information. Include "Add New Debt" button.

2.  **Task: Connect Debt List to Backend API**
    *   Description: Fetch and display the user's debts from the `GET /users/{userId}/debts` endpoint.
    *   Type: FS

3.  **Task: UI - Add/Edit Debt Form**
    *   Description: Develop the form (modal or page) for users to input and edit debt details as per the `debtObject` structure. Implement client-side input validation for data types, required fields, and sensible ranges (e.g., APR between 0-100).
    *   Type: FE
    *   Considerations: Ensure fields for all `debtObject` properties are present. Include tooltips for complex fields like `compoundingFrequency` or `promotionalAPR`.

4.  **Task: Connect Add/Edit Debt Form to Backend API**
    *   Description: Wire up the Add/Edit Debt form to the `POST` (for new) and `PUT` (for existing) debt endpoints. Handle create, update, and delete operations.
    *   Type: FS
    *   Considerations: Ensure UI updates correctly after successful operations. Handle API errors gracefully.

## III. Backend: Paydown Calculation Logic (BE)

1.  **Task: Implement Basic Interest Calculation Logic**
    *   Description: Create a reusable function to calculate interest accrued over a period (e.g., monthly) for a given balance, APR, and compounding frequency. Handle promotional APRs correctly.
    *   Type: BE
    *   Considerations: `accruedInterest = currentBalance * (APR / (12 * compoundingPeriodsPerYear))`. Default to monthly compounding if `compoundingFrequency` is not daily.

2.  **Task: Implement Single Debt Payoff Projection Logic**
    *   Description: Develop a function that projects the payoff timeline and total interest paid for a single debt, given the balance, APR, minimum payment, and any extra payment.
    *   Type: BE
    *   Considerations: Follow the algorithm outlined in `debt-paydown-planner.md`, section 4.4.

3.  **Task: Implement Total Minimum Payments Calculation**
    *   Description: Function to sum the `minimumMonthlyPayment` for all active debts of a user.
    *   Type: BE

4.  **Task: Implement Debt Snowball Strategy Logic**
    *   Description: Develop logic to:
        1.  Order debts by `currentBalance` (smallest to largest).
        2.  Calculate payoff projections using the Snowball method, applying the `extraPaymentBudget` and rollover logic as defined.
    *   Type: BE

5.  **Task: Implement Debt Avalanche Strategy Logic**
    *   Description: Develop logic to:
        1.  Order debts by `interestRateAPR` (highest to lowest).
        2.  Calculate payoff projections using the Avalanche method, applying the `extraPaymentBudget` and rollover logic.
    *   Type: BE

6.  **Task: Implement Custom Prioritization Strategy Logic**
    *   Description: Develop logic to:
        1.  Use the user-defined `customOrder` field to sequence debts.
        2.  Calculate payoff projections using this custom order, applying the `extraPaymentBudget` and rollover logic.
    *   Type: BE

7.  **Task: Backend - Projections API Endpoint**
    *   Description: Create the `GET /users/{userId}/debts/projections` endpoint. This endpoint will take strategy (`snowball`, `avalanche`, `custom`), `extraPaymentBudget`, and optional simulation parameters, then return the overall payoff date, total interest paid, and breakdown by debt.
    *   Type: BE

## IV. Frontend: Strategy Configuration & Simulation (FE/FS)

1.  **Task: UI - Strategy Configuration View**
    *   Description: Create the UI for users to select their preferred paydown strategy (Snowball, Avalanche, Custom) and input their monthly `extraPaymentBudget`.
    *   Type: FE
    *   Considerations: If "Custom" is selected, implement a drag-and-drop interface for ordering debts.

2.  **Task: Connect Strategy Configuration to Backend Projections API**
    *   Description: When strategy or extra payment amount changes, call the `GET /users/{userId}/debts/projections` endpoint and update the displayed projections on the Debt List/Dashboard.
    *   Type: FS

3.  **Task: UI - Simulation View**
    *   Description: Develop the UI for "What-If" scenarios. Include inputs for one-time extra payments (and optional target debt) and adjustments to recurring extra payments.
    *   Type: FE

4.  **Task: Connect Simulation View to Backend Projections API**
    *   Description: Call the projections API with simulation parameters. Display the simulated results (new payoff date, interest saved) clearly, comparing them to the current plan. Provide an option to apply simulation settings to the main plan.
    *   Type: FS

## V. Frontend: Visualization & Reporting (FE/FS)

1.  **Task: UI - Debt Overview Dashboard Enhancements**
    *   Description: Enhance the main dashboard with summary data from projections: overall estimated payoff date, total monthly payment (minimums + extra), time until debt-free.
    *   Type: FE
    *   Considerations: Fetch this data from the projections API.

2.  **Task: UI - "Debt-Free Meter" / Progress Bar**
    *   Description: Implement a visual progress bar showing the percentage of total initial/current debt paid off.
    *   Type: FE

3.  **Task: UI - Projected Payoff Charts (Overall & Individual)**
    *   Description: Implement charts (e.g., stacked area or line chart) to visualize the combined balance of all debts decreasing over time. Allow drill-down or selection to see individual debt decline curves.
    *   Type: FE
    *   Considerations: Use a charting library. Data will come from the detailed monthly amortization schedule part of the projections API response.

4.  **Task: UI - Strategy Comparison Tool**
    *   Description: Create a view or modal that displays a side-by-side comparison of payoff dates and total interest paid for Snowball vs. Avalanche strategies, using the user's current debts and defined `extraPaymentBudget`.
    *   Type: FE
    *   Considerations: This will involve calling the projections API twice, once for each strategy.

5.  **Task: UI - Interest Savings Report**
    *   Description: Display a summary of total projected interest paid with the current plan, and compare it against scenarios like "minimum payments only" or an alternative strategy.
    *   Type: FE

6.  **Task: UI - Amortization Schedules (Optional Drill-Down)**
    *   Description: For a selected debt, display a table showing the projected split of each payment into principal and interest over its life.
    *   Type: FE

## VI. Budget Integration (FS)

1.  **Task: BE - Logic to Link Budget Transactions to Debts**
    *   Description: When a budget transaction is categorized as a debt payment, provide a mechanism (e.g., in the transaction details) to link it to a specific `debtObject` in the planner. This should update the `currentBalance` of the debt.
    *   Type: FS (BE for updating balance, FE for UI to link)
    *   Considerations: May require modification of the transaction model or a separate linking table.

2.  **Task: FE - UI for Linking Transactions to Debts**
    *   Description: In the transaction view/editing interface, if a category is debt-related, provide a dropdown/selector to pick the specific debt from the Debt Planner.
    *   Type: FE

3.  **Task: Planner Informs Budget (Suggestion Logic)**
    *   Description: Based on the active strategy and `extraPaymentBudget`, calculate suggested payment amounts for each debt for the upcoming month. Provide a mechanism to show these suggestions to the user, potentially pre-filling budget categories.
    *   Type: FS (BE for calculation, FE for display and pre-fill option)

4.  **Task: Budget Informs Planner (Handling Overpayments)**
    *   Description: If a user budgets/pays more towards a debt than the planner suggested, detect this "overpayment." Prompt the user if they want to treat this as a one-off boost or adjust their recurring `extraPaymentBudget`.
    *   Type: FS

5.  **Task: Windfall/Extra Income Prompt**
    *   Description: When a large income event is categorized in the budget, display a prompt suggesting using some of it for debt acceleration via the simulation tool.
    *   Type: FE

6.  **Task: Net Worth Integration**
    *   Description: Ensure that the `currentBalance` of all debts in the planner is automatically included as liabilities in the user's overall Net Worth calculation.
    *   Type: BE (primarily, though FE displays net worth)

## VII. Notifications and Reminders (BE/FS)

1.  **Task: BE - Payment Reminder Logic**
    *   Description: Implement backend logic to check `nextPaymentDueDate` for all debts. Identify debts with upcoming due dates.
    *   Type: BE
    *   Considerations: This will likely involve a scheduled job/cron task.

2.  **Task: FE/FS - In-App Payment Reminders**
    *   Description: Display in-app notifications for upcoming debt payments. Allow configuration of reminder timing (e.g., X days before due).
    *   Type: FS

## VIII. Advanced Considerations & Edge Cases (BE/FS)

1.  **Task: Handle Promotional APRs in Calculations and UI**
    *   Description: Ensure `promotionalAPR` (rate and expiry date) is correctly used in projections. Allow users to input/edit this information in the Add/Edit Debt form.
    *   Type: FS

2.  **Task: UI/Logic for Balance Transfers (Simple)**
    *   Description: Guide users on how to manually adjust balances for a balance transfer (reduce source debt, increase/create destination debt).
    *   Type: FE (guidance) / Potentially BE if an assisted tool is built.

3.  **Task: Handling Manual Updates to Minimum Payments/APRs**
    *   Description: Ensure users can easily update `minimumMonthlyPayment` and `interestRateAPR` and that projections recalculate upon change.
    *   Type: FS

4.  **Task: Currency Support**
    *   Description: If Actual Budget supports multiple currencies, ensure all monetary fields in the Debt Planner also support this. Projections and totals must handle currency codes consistently.
    *   Type: FS

5.  **Task: UI/Logic for Debt Forbearance (Basic)**
    *   Description: Allow users to mark a debt as in forbearance and have projections skip payments (while potentially accruing interest) for the specified period.
    *   Type: FS

## IX. Testing & Documentation

1.  **Task: Unit Tests for Backend Calculation Logic**
    *   Description: Write comprehensive unit tests for interest calculations, single debt payoff projections, and each paydown strategy (Snowball, Avalanche, Custom), including rollover logic.
    *   Type: BE

2.  **Task: API Endpoint Tests**
    *   Description: Test all backend API endpoints for CRUD operations and projections, covering various scenarios and data inputs.
    *   Type: BE

3.  **Task: Frontend Component Tests**
    *   Description: Write unit/integration tests for key frontend components (forms, views, chart displays).
    *   Type: FE

4.  **Task: End-to-End (E2E) Tests for User Flows**
    *   Description: Create E2E tests covering main user flows: adding a debt, configuring a strategy, running a simulation, logging a payment via budget.
    *   Type: FS

5.  **Task: User Documentation for Debt Planner**
    *   Description: Write comprehensive user guides explaining how to use all features of the Debt Paydown Planner, including strategy explanations and tips.
    *   Type: Documentation

6.  **Task: Technical Documentation (API & Design)**
    *   Description: Document the API endpoints, data models, and key architectural decisions for maintainability.
    *   Type: Documentation
