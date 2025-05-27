import React, { useState, useEffect } from 'react';

import { Button } from '@actual-app/components/common/Button';
import { Input } from '@actual-app/components/common/Input';
import { Select } from '@actual-app/components/common/Select';
import { Text } from '@actual-app/components/common/Text';
import { View } from '@actual-app/components/view';
// Assuming DatePicker is not readily available or standard, using Input for dates.

// Re-define DebtEntity or import from a shared types location later
interface DebtEntityForForm {
  id?: string;
  creditor_name: string;
  debt_nickname?: string | null; // Allow null for optional text fields
  account_number?: string | null;
  debt_type: string;
  current_balance: number;
  original_balance?: number | null; // Allow null for optional numbers
  interest_rate_apr: number;
  minimum_monthly_payment: number;
  next_payment_due_date?: string | null; // YYYY-MM-DD
  original_loan_term_months?: number | null;
  compounding_frequency?: string;
  promotional_apr_rate?: number | null;
  promotional_apr_expires_date?: string | null; // YYYY-MM-DD
}

const DEBT_TYPES = ['CREDIT_CARD', 'PERSONAL_LOAN', 'STUDENT_LOAN', 'MORTGAGE', 'AUTO_LOAN', 'LINE_OF_CREDIT', 'MEDICAL_DEBT', 'OTHER_INSTALLMENT', 'CUSTOM'];
const COMPOUNDING_FREQUENCIES = ['MONTHLY', 'DAILY', 'ANNUALLY'];


interface DebtFormProps {
  modalProps?: { Poof: () => void }; // For closing modal
  initialDebtData?: DebtEntityForForm | null;
  onSubmit: (debtData: DebtEntityForForm) => void;
  onClose?: () => void; // Optional: if modalProps.Poof is not the only way to close
}

const defaultInitialValues: DebtEntityForForm = {
  creditor_name: '',
  debt_type: DEBT_TYPES[0],
  current_balance: 0,
  interest_rate_apr: 0,
  minimum_monthly_payment: 0,
  compounding_frequency: COMPOUNDING_FREQUENCIES[0],
  debt_nickname: '',
  account_number: '',
  original_balance: undefined, // Use undefined for optional numbers that can be omitted
  next_payment_due_date: '',
  original_loan_term_months: undefined,
  promotional_apr_rate: undefined,
  promotional_apr_expires_date: '',
};

function DebtForm({ modalProps, initialDebtData, onSubmit, onClose }: DebtFormProps) {
  const [formData, setFormData] = useState<DebtEntityForForm>(
    initialDebtData ? { ...defaultInitialValues, ...initialDebtData } : defaultInitialValues
  );

  useEffect(() => {
    if (initialDebtData) {
      setFormData({ ...defaultInitialValues, ...initialDebtData });
    } else {
      setFormData(defaultInitialValues); // Reset to defaults when adding new
    }
  }, [initialDebtData]);

  const handleChange = (field: keyof DebtEntityForForm, value: any) => {
    let processedValue = value;
    const numericFields: (keyof DebtEntityForForm)[] = [
      'current_balance', 
      'original_balance', 
      'interest_rate_apr', 
      'minimum_monthly_payment', 
      'original_loan_term_months', 
      'promotional_apr_rate'
    ];

    if (numericFields.includes(field)) {
      // Allow empty string for resetting, otherwise parse
      processedValue = value === '' ? undefined : parseFloat(value);
      if (value !== '' && isNaN(processedValue)) {
        // Keep current value if input is invalid and not empty
        // or set to undefined if it was an invalid character from start
        processedValue = formData[field] === undefined && value !== '' ? undefined : formData[field]; 
      }
    }
    setFormData(prev => ({ ...prev, [field]: processedValue }));
  };
  
  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else if (modalProps && modalProps.Poof) {
      modalProps.Poof();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic Validation
    if (!formData.creditor_name || formData.current_balance == null || formData.interest_rate_apr == null || formData.minimum_monthly_payment == null) {
      alert('Please fill all required fields: Creditor Name, Current Balance, APR, and Minimum Monthly Payment.');
      return;
    }
    // Ensure numbers are numbers, not NaN from bad input.
    // Default undefined optional numbers to null if they are still undefined for backend, or handle as per API spec.
    // For now, sending them as is.
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ overflowY: 'auto', paddingRight: '15px', maxHeight: '80vh' /* Example max height */ }}>
      <View style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          {initialDebtData?.id ? 'Edit Debt' : 'Add New Debt'}
        </Text>
        
        <Text>Creditor Name*:</Text>
        <Input placeholder="e.g., Chase Bank" value={formData.creditor_name} onUpdate={value => handleChange('creditor_name', value)} />
        
        <Text>Debt Nickname (optional):</Text>
        <Input placeholder="e.g., Visa Card" value={formData.debt_nickname || ''} onUpdate={value => handleChange('debt_nickname', value)} />
        
        <Text>Account Number (optional):</Text>
        <Input placeholder="Last 4 digits or full for reference" value={formData.account_number || ''} onUpdate={value => handleChange('account_number', value)} />
        
        <Text>Debt Type*:</Text>
        <Select options={DEBT_TYPES.map(type => [type, type.replace(/_/g, ' ')])} value={formData.debt_type} onUpdate={value => handleChange('debt_type', value)} />
        
        <Text>Current Balance*:</Text>
        <Input type="number" placeholder="e.g., 5000.00" value={String(formData.current_balance ?? '')} onUpdate={value => handleChange('current_balance', value)} />
        
        <Text>Original Balance (optional):</Text>
        <Input type="number" placeholder="e.g., 10000.00" value={String(formData.original_balance ?? '')} onUpdate={value => handleChange('original_balance', value)} />

        <Text>Interest Rate (APR %)*:</Text>
        <Input type="number" placeholder="e.g., 19.99" value={String(formData.interest_rate_apr ?? '')} onUpdate={value => handleChange('interest_rate_apr', value)} />

        <Text>Minimum Monthly Payment*:</Text>
        <Input type="number" placeholder="e.g., 150.00" value={String(formData.minimum_monthly_payment ?? '')} onUpdate={value => handleChange('minimum_monthly_payment', value)} />

        <Text>Next Payment Due Date (YYYY-MM-DD, optional):</Text>
        <Input placeholder="YYYY-MM-DD" value={formData.next_payment_due_date || ''} onUpdate={value => handleChange('next_payment_due_date', value)} />
        
        <Text>Original Loan Term (Months, optional):</Text>
        <Input type="number" placeholder="e.g., 60" value={String(formData.original_loan_term_months ?? '')} onUpdate={value => handleChange('original_loan_term_months', value)} />

        <Text>Compounding Frequency:</Text>
        <Select options={COMPOUNDING_FREQUENCIES.map(freq => [freq, freq])} value={formData.compounding_frequency} onUpdate={value => handleChange('compounding_frequency', value)} />

        <Text>Promotional APR Rate (% optional):</Text>
        <Input type="number" placeholder="e.g., 0.00" value={String(formData.promotional_apr_rate ?? '')} onUpdate={value => handleChange('promotional_apr_rate', value)} />
        
        <Text>Promotional APR Expires Date (YYYY-MM-DD, optional):</Text>
        <Input placeholder="YYYY-MM-DD" value={formData.promotional_apr_expires_date || ''} onUpdate={value => handleChange('promotional_apr_expires_date', value)} />

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 10 }}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" nativeType="submit">
            {initialDebtData?.id ? 'Save Changes' : 'Add Debt'}
          </Button>
        </View>
      </View>
    </form>
  );
}

export default DebtForm;
