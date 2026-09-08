import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertTriangle, RefreshCw, X, Image as ImageIcon } from 'lucide-react';
import { resizeImage } from '../utils/imageResize';
import { extractBill, loadDemo } from '../services/api';
import { Bill, DemoData } from '../types';

interface UploadPageProps {
  onExtractSuccess: (bill: Bill) => void;
  onDemoLoad: (data: DemoData) => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onExtractSuccess, onDemoLoad }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Prevent browser default behavior of opening dropped image files in the window
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault();
    const handleWindowDrop = (e: DragEvent) => e.preventDefault();

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Generate previews when files change
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const isValidImage = (f: File) => {
    return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|tiff?)$/i.test(f.name);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedImages = Array.from(e.dataTransfer.files).filter(isValidImage);
      if (droppedImages.length > 0) {
        setFiles(prev => [...prev, ...droppedImages]);
        setError(null);
      } else {
        setError('Please drop valid image files (JPG, PNG, WebP, etc.)');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedImages = Array.from(e.target.files).filter(isValidImage);
      setFiles(prev => [...prev, ...selectedImages]);
      setError(null);
    }
    // Reset file input so selecting the same file again works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtract = async () => {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const resizedBlobs = await Promise.all(files.map(f => resizeImage(f)));
      const bill = await extractBill(resizedBlobs);
      onExtractSuccess(bill);
    } catch (err: any) {
      setError(err.message || 'Failed to extract bill.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await loadDemo();
      onDemoLoad(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load demo data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SplitBill AI</h1>
        <p className="text-gray-500">Split restaurant bills fairly from a photograph</p>
      </div>

      {/* Dropzone area - clickable anywhere */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer select-none ${
          isDragging 
            ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100 scale-[1.01]' 
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50/70'
        }`}
      >
        <div className="flex justify-center mb-4 pointer-events-none">
          <div className="p-4 bg-indigo-50 rounded-full">
            <Upload className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        <p className="text-lg font-medium text-gray-900 mb-1 pointer-events-none">
          {isDragging ? 'Drop your bill photo here' : 'Drag & drop bill photograph(s)'}
        </p>
        <p className="text-sm text-gray-500 mb-4 pointer-events-none">
          or click anywhere in this area to browse from your device
        </p>
        
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
        
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-medium hover:bg-gray-50 shadow-sm transition-colors text-sm"
        >
          Choose Photos
        </button>
        <p className="text-xs text-gray-400 mt-3 pointer-events-none">
          Supports multiple photos if the bill spans more than one shot
        </p>
      </div>

      {/* Selected files preview */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Selected Photos ({files.length})
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
            >
              + Add another photo
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((file, i) => (
              <div 
                key={i} 
                className="relative group bg-gray-50 rounded-lg border border-gray-200 p-2 flex flex-col items-center overflow-hidden"
              >
                {previews[i] ? (
                  <img 
                    src={previews[i]} 
                    alt={`Bill photo ${i + 1}`} 
                    className="w-full h-24 object-cover rounded mb-1.5"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center mb-1.5">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                
                <span className="text-xs text-gray-700 truncate w-full text-center font-medium">
                  {file.name}
                </span>
                <span className="text-[10px] text-gray-400">
                  {(file.size / 1024).toFixed(0)} KB
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-90 hover:opacity-100 shadow transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <button 
              onClick={handleExtract}
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Extracting Bill Information...
                </>
              ) : (
                `Extract Bill from ${files.length} Photo${files.length > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start border border-red-100">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500 mb-2">Want to see how it works first?</p>
        <button 
          onClick={handleDemo}
          disabled={isLoading}
          className="text-indigo-600 font-semibold hover:text-indigo-800 text-sm transition-colors underline"
        >
          Try a demo bill instead (instant)
        </button>
      </div>
    </div>
  );
};
