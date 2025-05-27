import React, { useState, useEffect } from 'react';

import { Button } from '@actual-app/components/common/Button';
import { Text } from '@actual-app/components/common/Text';
import { View } from '@actual-app/components/view';

import { Page } from '../../Page'; // Relative path to Page.tsx in src/components

// Simplified DebtEntity for this component's needs
interface DebtEntity {
  id: string;
  debt_nickname: string | null;
  creditor_name: string;
  current_balance: number;
  interest_rate_apr: number;
  minimum_monthly_payment: number;
  next_payment_due_date: string | null;
  // Add other fields here if needed for display, e.g.,
  // original_balance?: number | null;
  // debt_type?: string | null;
}

function DebtPage() {
  const [debts, setDebts] = useState<DebtEntity[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDebts() {
      setIsLoading(true);
      setError(null);
      try {
        // Ensure window.Actual and window.Actual.getDebts are available
        if (window.Actual && typeof window.Actual.getDebts === 'function') {
          const fetchedDebts = await window.Actual.getDebts();
          if (fetchedDebts) {
            setDebts(fetchedDebts as DebtEntity[]);
            const total = fetchedDebts.reduce(
              (sum, debt) => sum + (debt.current_balance || 0),
              0,
            );
            setTotalDebt(total);
          } else {
            setDebts([]);
            setTotalDebt(0);
          }
        } else {
          console.error(
            'API window.Actual.getDebts() not found. Ensure it is exposed.',
          );
          setError(
            'Failed to fetch debts: API not available. Ensure backend is running and API is exposed.',
          );
          setDebts([]); // Clear debts if API is not available
          setTotalDebt(0);
        }
      } catch (e) {
        console.error('Error fetching debts:', e);
        setError(`Error fetching debts: ${e.message || 'Unknown error'}`);
        setDebts([]); // Clear debts on error
        setTotalDebt(0);
      } finally {
        setIsLoading(false);
      }
    }
    loadDebts();
  }, []);

  const handleAddDebt = () => {
    // Placeholder for opening an "Add Debt" modal or navigating to a form
    alert('Add New Debt clicked!');
  };

  return (
    <Page title="Debt Paydown Planner" headerRightContent={<Button onClick={handleAddDebt}>Add New Debt</Button>}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Summary
        </Text>
        <Text>Total Outstanding Debt: ${totalDebt.toFixed(2)}</Text>
        {/* Add more summary information here as needed */}

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Debts
          </Text>
          {isLoading ? (
            <Text>Loading debts...</Text>
          ) : error ? (
            <Text style={{ color: 'red' }}>{error}</Text>
          ) : debts.length === 0 ? (
            <Text>No debts added yet. Click "Add New Debt" to get started.</Text>
          ) : (
            <View>
              {debts.map(debt => (
                <View
                  key={debt.id}
                  style={{
                    marginBottom: 15,
                    padding: 15,
                    border: '1px solid #e0e0e0',
                    borderRadius: 6,
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
                    {debt.debt_nickname || debt.creditor_name}
                  </Text>
                  <Text>Balance: ${debt.current_balance?.toFixed(2) || '0.00'}</Text>
                  <Text>APR: {debt.interest_rate_apr?.toFixed(2) || '0.00'}%</Text>
                  <Text>Min. Payment: ${debt.minimum_monthly_payment?.toFixed(2) || '0.00'}</Text>
                  {debt.next_payment_due_date && (
                    <Text>Next Due: {debt.next_payment_due_date}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Page>
  );
}

export default DebtPage;
