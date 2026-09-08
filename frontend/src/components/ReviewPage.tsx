import React, { useState, useEffect } from 'react';
import { Bill, BillItem, Tax, ValidationResult } from '../types';
import { formatMoney, toPaise, toRupees } from '../utils/money';
import { validateBill } from '../services/api';
import { AlertTriangle, Check, Plus, Trash2 } from 'lucide-react';

interface ReviewPageProps {
  bill: Bill;
  onUpdateBill: (bill: Bill) => void;
  onConfirm: () => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({ bill, onUpdateBill, onConfirm }) => {
  const [localBill, setLocalBill] = useState<Bill>(bill);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const runValidation = async () => {
      setIsValidating(true);
      try {
        const result = await validateBill(localBill);
        setValidation(result);
      } catch (err) {
        console.error(err);
      } finally {
        setIsValidating(false);
      }
    };
    const timer = setTimeout(runValidation, 500);
    return () => clearTimeout(timer);
  }, [localBill]);

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const newItems = [...localBill.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    setLocalBill({ ...localBill, items: newItems });
  };

  const addItem = () => {
    setLocalBill({
      ...localBill,
      items: [
        ...localBill.items,
        {
          id: `item-${Date.now()}`,
          name: 'New Item',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          confidence: 'high'
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...localBill.items];
    newItems.splice(index, 1);
    setLocalBill({ ...localBill, items: newItems });
  };

  const addTax = () => {
    setLocalBill({
      ...localBill,
      taxes: [
        ...localBill.taxes,
        { name: 'Tax', rate: null, amount: 0, confidence: 'high' }
      ]
    });
  };

  const removeTax = (index: number) => {
    const newTaxes = [...localBill.taxes];
    newTaxes.splice(index, 1);
    setLocalBill({ ...localBill, taxes: newTaxes });
  };

  const updateTax = (index: number, field: keyof Tax, value: any) => {
    const newTaxes = [...localBill.taxes];
    newTaxes[index] = { ...newTaxes[index], [field]: value };
    setLocalBill({ ...localBill, taxes: newTaxes });
  };

  const handleConfirm = () => {
    onUpdateBill(localBill);
    onConfirm();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Review Bill Items</h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Restaurant:</label>
            <input 
              type="text" 
              value={localBill.restaurant_name || ''} 
              onChange={e => setLocalBill({...localBill, restaurant_name: e.target.value})}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Restaurant Name"
            />
          </div>
        </div>
        
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500">
                <th className="pb-3 font-medium w-1/2">Item Name</th>
                <th className="pb-3 font-medium w-16 text-center">Qty</th>
                <th className="pb-3 font-medium w-32 text-right">Unit Price</th>
                <th className="pb-3 font-medium w-32 text-right">Total</th>
                <th className="pb-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {localBill.items.map((item, idx) => (
                <tr key={item.id} className={`border-b border-gray-100 ${item.confidence !== 'high' ? 'bg-orange-50' : ''}`}>
                  <td className="py-3 pr-2">
                    <div className="flex items-center">
                      {item.confidence !== 'high' && (
                        <span title="Low confidence extraction">
                          <AlertTriangle className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0" />
                        </span>
                      )}
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={e => updateItem(idx, 'name', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-colors"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-2 py-1 outline-none text-center"
                      min="1"
                    />
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-end">
                      <span className="text-gray-500 mr-1 text-sm">₹</span>
                      <input 
                        type="number" 
                        value={toRupees(item.unit_price)} 
                        onChange={e => updateItem(idx, 'unit_price', toPaise(e.target.value))}
                        className="w-24 bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-2 py-1 outline-none text-right"
                        step="0.01"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-gray-900">
                    {formatMoney(item.total_price, localBill.currency)}
                  </td>
                  <td className="py-3 pl-2 text-right">
                    <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button 
            onClick={addItem}
            className="mt-4 flex items-center text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Totals & Taxes</h3>
        
        <div className="space-y-4 max-w-md mx-auto sm:mx-0 sm:ml-auto">
          {/* Subtotal */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Subtotal</span>
            <div className="flex items-center">
              <span className="text-gray-500 mr-1 text-sm">₹</span>
              <input 
                type="number" 
                value={localBill.subtotal !== null ? toRupees(localBill.subtotal) : ''} 
                onChange={e => setLocalBill({...localBill, subtotal: e.target.value ? toPaise(e.target.value) : null})}
                className="w-24 border border-gray-300 rounded px-2 py-1 outline-none text-right focus:border-indigo-500"
                step="0.01"
              />
            </div>
          </div>

          {/* Discount */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Discount</span>
            <div className="flex items-center">
              <span className="text-gray-500 mr-1 text-sm">₹</span>
              <input 
                type="number" 
                value={localBill.discount !== null ? toRupees(localBill.discount) : ''} 
                onChange={e => setLocalBill({...localBill, discount: e.target.value ? toPaise(e.target.value) : null})}
                className="w-24 border border-gray-300 rounded px-2 py-1 outline-none text-right focus:border-indigo-500"
                step="0.01"
              />
            </div>
          </div>

          {/* Taxes */}
          {localBill.taxes.map((tax, idx) => (
            <div key={idx} className="flex justify-between items-center group">
              <div className="flex items-center">
                <button onClick={() => removeTax(idx)} className="text-gray-300 hover:text-red-500 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
                <input 
                  type="text" 
                  value={tax.name} 
                  onChange={e => updateTax(idx, 'name', e.target.value)}
                  className="w-32 bg-transparent border border-transparent hover:border-gray-300 rounded px-2 py-1 outline-none text-sm"
                />
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-1 text-sm">₹</span>
                <input 
                  type="number" 
                  value={toRupees(tax.amount)} 
                  onChange={e => updateTax(idx, 'amount', toPaise(e.target.value))}
                  className="w-24 border border-gray-300 rounded px-2 py-1 outline-none text-right focus:border-indigo-500"
                  step="0.01"
                />
              </div>
            </div>
          ))}
          <button 
            onClick={addTax}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-800 flex items-center justify-end w-full"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Tax
          </button>

          {/* Service Charge */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Service Charge</span>
            <div className="flex items-center">
              <span className="text-gray-500 mr-1 text-sm">₹</span>
              <input 
                type="number" 
                value={localBill.service_charge !== null ? toRupees(localBill.service_charge) : ''} 
                onChange={e => setLocalBill({...localBill, service_charge: e.target.value ? toPaise(e.target.value) : null})}
                className="w-24 border border-gray-300 rounded px-2 py-1 outline-none text-right focus:border-indigo-500"
                step="0.01"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 my-2 pt-2"></div>

          {/* Total */}
          <div className="flex justify-between items-center font-bold text-gray-900 text-lg">
            <span>Printed Total</span>
            <div className="flex items-center">
              <span className="text-gray-500 mr-1 text-base font-normal">₹</span>
              <input 
                type="number" 
                value={localBill.total !== null ? toRupees(localBill.total) : ''} 
                onChange={e => setLocalBill({...localBill, total: e.target.value ? toPaise(e.target.value) : null})}
                className="w-28 border border-gray-300 rounded px-2 py-1 outline-none text-right focus:border-indigo-500"
                step="0.01"
              />
            </div>
          </div>
        </div>
      </div>

      {validation && !isValidating && (
        <div className={`p-4 rounded-lg border flex items-start ${
          validation.is_valid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {validation.is_valid ? (
            <Check className="w-5 h-5 mr-3 mt-0.5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 text-amber-600 flex-shrink-0" />
          )}
          <div>
            <p className="font-medium text-sm">
              {validation.is_valid 
                ? '✓ Bill total verified' 
                : `⚠ Bill total mismatch — calculated ${formatMoney(validation.calculated_total)}, printed ${validation.printed_total ? formatMoney(validation.printed_total) : 'N/A'}, difference ${formatMoney(Math.abs(validation.difference))}`
              }
            </p>
            <p className="text-xs mt-1 opacity-80">
              The split will be based on line items and proportional taxes/discounts, not the printed total.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={handleConfirm}
          className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center"
        >
          Confirm Bill & Assign Items
        </button>
      </div>
    </div>
  );
};
