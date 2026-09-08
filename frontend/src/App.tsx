import { useState } from 'react';
import { Bill, Member, ItemAssignment, SplitResult, DemoData } from './types';
import { ProgressBar } from './components/ProgressBar';
import { UploadPage } from './components/UploadPage';
import { ReviewPage } from './components/ReviewPage';
import { AssignPage } from './components/AssignPage';
import { SplitPage } from './components/SplitPage';

function App() {
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3>(0);
  const [bill, setBill] = useState<Bill | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);

  const handleExtractSuccess = (extractedBill: Bill) => {
    setBill(extractedBill);
    setCurrentStep(1);
  };

  const handleDemoLoad = (data: DemoData) => {
    setBill(data.bill);
    setMembers(data.members);
    setAssignments(data.assignments);
    setCurrentStep(1);
  };

  const reset = () => {
    setBill(null);
    setMembers([]);
    setAssignments([]);
    setSplitResult(null);
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      {currentStep > 0 && (
        <div className="max-w-7xl mx-auto mb-4 flex justify-end">
          <button 
            onClick={reset}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Start Over
          </button>
        </div>
      )}
      
      <ProgressBar currentStep={currentStep} />
      
      <div className="max-w-7xl mx-auto">
        {currentStep === 0 && (
          <UploadPage 
            onExtractSuccess={handleExtractSuccess} 
            onDemoLoad={handleDemoLoad} 
          />
        )}
        
        {currentStep === 1 && bill && (
          <ReviewPage 
            bill={bill} 
            onUpdateBill={setBill} 
            onConfirm={() => setCurrentStep(2)} 
          />
        )}
        
        {currentStep === 2 && bill && (
          <AssignPage 
            bill={bill}
            members={members}
            assignments={assignments}
            onUpdateMembers={setMembers}
            onUpdateAssignments={setAssignments}
            onSplitCalculated={(result) => {
              setSplitResult(result);
              setCurrentStep(3);
            }}
          />
        )}
        
        {currentStep === 3 && splitResult && bill && (
          <SplitPage 
            result={splitResult} 
            currency={bill.currency}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}

export default App;
