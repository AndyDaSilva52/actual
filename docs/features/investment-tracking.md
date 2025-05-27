# Investment Tracking Feature for Actual Budget

This document outlines the proposed "Investment Tracking" feature for Actual Budget.

## 1. Types of Investments

Users should be able to track a diverse range of investment types to accommodate various portfolios. This includes, but is not limited to:

*   **Stocks:** Individual company shares traded on stock exchanges.
*   **Bonds:** Debt securities issued by governments or corporations.
*   **Mutual Funds:** Pooled funds managed by professionals, investing in a diversified portfolio of stocks, bonds, or other assets.
*   **ETFs (Exchange-Traded Funds):** Funds that track an index, sector, commodity, or other asset, but can be bought and sold on a stock exchange like regular stocks.
*   **Cryptocurrencies:** Digital or virtual currencies secured by cryptography (e.g., Bitcoin, Ethereum).
*   **Other Assets:** Potentially, users could define custom asset types for things like real estate, collectibles, or precious metals, although the primary focus would be on financial instruments.

## 2. Key Data Points

For each investment, users should be able to record the following information:

*   **Asset Information:**
    *   **Name/Ticker Symbol:** (e.g., AAPL, VTSAX, BTC). This would be crucial for identification and potential API integration.
    *   **Asset Type:** (Selected from the types listed above).
    *   **Issuing Institution/Exchange:** (e.g., NYSE, Vanguard, Coinbase). Optional but helpful for organization.
*   **Transaction Details (for each lot/purchase):**
    *   **Purchase Date:** The date the investment was acquired.
    *   **Purchase Price (per unit):** The price paid for one unit of the investment.
    *   **Quantity:** The number of units purchased.
    *   **Total Cost Basis:** (Calculated: Purchase Price * Quantity).
    *   **Fees/Commissions (Purchase):** Any fees associated with acquiring the investment.
    *   **Sale Date:** (If applicable) The date the investment was sold.
    *   **Sale Price (per unit):** (If applicable) The price received for one unit of the investment.
    *   **Fees/Commissions (Sale):** (If applicable) Any fees associated with selling the investment.
*   **Valuation & Performance:**
    *   **Current Price (per unit):** The latest market price of the investment. This could be updated manually or automatically.
    *   **Current Market Value:** (Calculated: Current Price * Quantity held).
    *   **Valuation Date:** The date the current price was last updated.
*   **Income:**
    *   **Dividend/Interest Amount:** The amount received.
    *   **Dividend/Interest Date:** The date the income was received.
    *   **Reinvested?** (Yes/No): Indicates if the dividend/interest was used to purchase more units of the same investment.

## 3. Core Functionality

### Adding New Investments

1.  **Manual Entry Form:** Users would navigate to an "Investments" section and click an "Add New Investment" button.
2.  A form would appear prompting for the key data points listed above (Asset Information, initial Purchase Date, Purchase Price, Quantity, Fees).
3.  For assets like stocks or ETFs, if an API connection is configured (see below), typing a ticker symbol could auto-populate the asset name and current price.
4.  Users can add multiple purchase lots for the same investment over time.

### Updating Current Values

*   **Manual Entry:** Users can manually update the "Current Price" for each investment at any time. The "Valuation Date" would reflect the date of this manual update.
*   **Automatic Fetching (API Integration - Optional/Phased Approach):**
    *   Ideally, Actual Budget could integrate with financial data APIs (e.g., IEX Cloud, Alpha Vantage, Plaid for investment accounts) to automatically fetch the latest prices for publicly traded assets (stocks, ETFs, some mutual funds, major cryptocurrencies).
    *   Users would need to provide API keys (if required by the service) or link their brokerage accounts (if using an aggregator like Plaid).
    *   Frequency of updates could be configurable (e.g., daily, on-demand sync).
    *   A clear indicator should show the last successful sync time.

### Calculating and Displaying Gains/Losses

*   **Unrealized Gains/Losses:**
    *   Calculated for each investment lot: `(Current Market Value) - (Total Cost Basis + Purchase Fees)`.
    *   Displayed per investment and as a total across all investments.
    *   Clearly distinguished from realized gains.
*   **Realized Gains/Losses:**
    *   Calculated when an investment (or a portion of it) is sold: `(Total Sale Proceeds - Sale Fees) - (Total Cost Basis of sold units + Purchase Fees of sold units)`.
    *   The system would need to support different accounting methods for selling portions of an investment (e.g., FIFO - First-In, First-Out; LIFO - Last-In, First-Out; or Average Cost). FIFO is a common default.
    *   Realized gains/losses should be reportable over specific periods.

### Handling Dividends and Other Investment Income

1.  **Manual Entry:** Users can manually log dividend or interest payments received.
    *   Form fields: Investment, Amount Received, Date Received, Reinvested (Y/N).
2.  **Linking to Budget:**
    *   If not reinvested, the dividend/interest income should be selectable as a category to be budgeted, potentially flowing into "Income for next month" or a dedicated "Investment Income" category.
    *   If reinvested, the amount should increase the cost basis (or quantity, depending on how it's handled) of the respective investment rather than appearing as cash income in the budget. A new purchase transaction could be automatically created if reinvested.

### Performance Visualizations and Summaries

*   **Portfolio Overview Dashboard:**
    *   Total Portfolio Value.
    *   Total Unrealized Gains/Losses.
    *   Total Realized Gains/Losses (for a selected period).
    *   Overall Portfolio Performance (percentage change over time).
*   **Charts:**
    *   **Value Over Time:** A line chart showing the total portfolio value over selected periods (e.g., 1 month, 6 months, 1 year, all time).
    *   **Asset Allocation:** A pie chart or bar chart showing the current market value distribution by asset type (stocks, bonds, crypto, etc.) or even by individual holdings.
*   **Individual Investment View:**
    *   Chart showing the value of a specific investment over time.
    *   List of all transactions (buys, sells, dividends) for that investment.
    *   Key metrics: Total cost basis, current value, unrealized gain/loss, realized gain/loss (if any sales).

## 4. Integration with Budget

The Investment Tracking feature should complement the existing budgeting functionalities in Actual Budget:

*   **Investment Income:**
    *   As mentioned, non-reinvested dividends and interest can be treated as income within the budget. Users should be able to categorize this income.
    *   A setting could allow users to choose if this income automatically goes to "Income for next month" or if it needs manual allocation.
*   **Investment Contributions (Linking to Goals/Savings):**
    *   Users might want to track contributions to investment accounts as part of their budget.
    *   When money is transferred from a budget account (e.g., checking) to an investment account (which is an off-budget, tracked asset account), this could be categorized as an "Investment Contribution" expense in the budget.
    *   This allows users to set savings goals for investment contributions and track their progress within the budget.
*   **Net Worth Calculation:**
    *   The total value of tracked investments should be included in the overall Net Worth calculation within Actual Budget, providing a more complete financial picture.
*   **Transaction Reconciliation:**
    *   While investment accounts are typically "off-budget" in terms of daily spending, transfers to these accounts from on-budget accounts need to be reconciled. For example, transferring $500 from "Checking" to "Brokerage Account" would be an expense/transfer in the budget, and this $500 would then be used to purchase assets within the investment tracking module.
*   **Fees:**
    *   Investment fees (e.g., brokerage account maintenance fees, advisory fees) that are paid from budgeted accounts should be categorizable as expenses in the budget. Fees directly deducted from investment value (like expense ratios in mutual funds) would be reflected in the net asset value.

This feature aims to provide users with a clear view of their investment performance and how it contributes to their overall financial health, while maintaining the core strengths of Actual Budget's budgeting capabilities.
